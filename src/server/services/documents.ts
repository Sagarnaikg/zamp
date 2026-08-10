import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, extractions, lineItems } from "@/server/db/schema";
import { getStorage } from "@/server/storage";
import { detectFileKind } from "@/server/ingest/detect";
import { extract, type Extraction } from "@/server/llm/extraction";
import { classifyLlmError } from "@/server/llm/errors";
import { computeConfidence } from "@/server/confidence/engine";
import type { DuplicateCandidate } from "@/server/confidence/types";

/** Existing workspace documents to compare against for duplicate detection. */
async function duplicateCandidates(
  workspaceId: string,
  excludeDocumentId: string,
): Promise<DuplicateCandidate[]> {
  const rows = await db
    .select({
      documentId: extractions.documentId,
      invoiceNumber: extractions.invoiceNumber,
      vendor: extractions.vendor,
      total: extractions.total,
      docDate: extractions.docDate,
      filename: documents.filename,
      status: documents.status,
    })
    .from(extractions)
    .innerJoin(documents, eq(extractions.documentId, documents.id))
    .where(
      and(
        eq(extractions.workspaceId, workspaceId),
        ne(extractions.documentId, excludeDocumentId),
        inArray(documents.status, ["needs_review", "accepted"]),
      ),
    );
  return rows;
}

/**
 * Independent second reading for the agreement signal — a different
 * provider when one is configured, else the same provider on a different
 * model tier and input modality (decisions.md §8). Always attempted;
 * a failure degrades to the remaining signals rather than failing ingestion.
 */
async function secondOpinion(
  kind: Awaited<ReturnType<typeof detectFileKind>>["kind"],
  file: { data: Buffer; mimeType: string; text?: string },
  primaryProvider: string,
): Promise<Extraction | null> {
  try {
    const result = await extract(kind, file, {
      secondOpinion: true,
      avoid: primaryProvider as never,
    });
    return result?.extraction ?? null;
  } catch {
    return null;
  }
}

export function listDocuments(workspaceId: string) {
  return db.query.documents.findMany({
    where: eq(documents.workspaceId, workspaceId),
    orderBy: [desc(documents.createdAt)],
  });
}

/**
 * Full ingestion flow: store the original, detect the file kind, run the
 * routed extraction, persist the results. Returns the document row in its
 * final state — `needs_review` on success, `failed` (with `error`) otherwise.
 */
export async function ingestDocument(
  workspaceId: string,
  file: { name: string; type: string; data: Buffer },
) {
  const storageKey = `${workspaceId}/${randomUUID()}-${file.name}`;
  const storagePath = await getStorage().put(storageKey, file.data, file.type);

  const [doc] = await db
    .insert(documents)
    .values({
      workspaceId,
      filename: file.name,
      mimeType: file.type,
      storagePath,
      status: "processing",
    })
    .returning();

  return processDocument(workspaceId, doc.id, {
    type: file.type,
    data: file.data,
    name: file.name,
  });
}

/**
 * Detect → extract → score → persist, for a document row whose file is
 * already stored. Shared by upload and retry so a transient provider
 * failure never requires re-uploading the file.
 */
async function processDocument(
  workspaceId: string,
  documentId: string,
  file: { type: string; data: Buffer; name: string },
) {
  try {
    const { kind, text } = await detectFileKind(file.data, file.type);
    await db
      .update(documents)
      .set({ fileKind: kind, status: "processing", error: null, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    const result = await extract(kind, {
      data: file.data,
      mimeType: file.type,
      text,
      filename: file.name,
    });
    if (!result) {
      throw new Error("No extraction result returned");
    }
    const { extraction, provider } = result;

    // Confidence: second reading (different provider when available, else a
    // different tier + modality), duplicate history, arithmetic and format
    // checks (decisions.md §8).
    const fileInput = {
      data: file.data,
      mimeType: file.type,
      text,
      filename: file.name,
    };
    const [second, candidates] = await Promise.all([
      secondOpinion(kind, fileInput, provider),
      duplicateCandidates(workspaceId, documentId),
    ]);
    const confidence = computeConfidence({
      extraction,
      secondOpinion: second,
      duplicateCandidates: candidates,
    });

    const row = {
      documentId,
      workspaceId,
      vendor: extraction.vendor,
      invoiceNumber: extraction.invoice_number,
      docDate: extraction.doc_date,
      currency: extraction.currency,
      subtotal: extraction.subtotal?.toString() ?? null,
      tax: extraction.tax?.toString() ?? null,
      total: extraction.total?.toString() ?? null,
      category: extraction.category,
      extraFields: extraction.extra_fields,
      fieldMeta: confidence.fieldMeta,
    };
    // A retry re-extracts the same document, so upsert rather than insert.
    await db
      .insert(extractions)
      .values(row)
      .onConflictDoUpdate({
        target: extractions.documentId,
        set: { ...row, updatedAt: new Date() },
      });

    await db.delete(lineItems).where(eq(lineItems.documentId, documentId));
    if (extraction.line_items.length > 0) {
      await db.insert(lineItems).values(
        extraction.line_items.map((item, i) => ({
          documentId,
          workspaceId,
          position: i,
          description: item.description,
          quantity: item.quantity?.toString() ?? null,
          unitPrice: item.unit_price?.toString() ?? null,
          amount: item.amount?.toString() ?? null,
        })),
      );
    }

    const [updated] = await db
      .update(documents)
      .set({ status: "needs_review", updatedAt: new Date() })
      .where(eq(documents.id, documentId))
      .returning();
    return { document: updated };
  } catch (err) {
    const { message, retryable, kind } = classifyLlmError(err);
    const [failed] = await db
      .update(documents)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(documents.id, documentId))
      .returning();
    return { document: failed, error: message, retryable, errorKind: kind };
  }
}

/**
 * Re-run extraction on a stored document. The file is already in storage,
 * so a rate limit or provider blip costs the user one click, not a re-upload.
 */
export async function retryDocument(workspaceId: string, documentId: string) {
  const doc = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, documentId),
      eq(documents.workspaceId, workspaceId),
    ),
  });
  if (!doc) return null;

  const data = await getStorage().get(doc.storagePath);
  return processDocument(workspaceId, doc.id, {
    type: doc.mimeType,
    data,
    name: doc.filename,
  });
}
