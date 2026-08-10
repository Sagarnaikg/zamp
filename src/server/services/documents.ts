import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, extractions, lineItems } from "@/server/db/schema";
import { getStorage } from "@/server/storage";
import { detectFileKind } from "@/server/ingest/detect";
import { PipelineTrace } from "@/server/ingest/trace";
import {
  extract,
  extractFocused,
  type Extraction,
} from "@/server/llm/extraction";
import { classifyLlmError } from "@/server/llm/errors";
import { addUsage, emptyUsage, type TokenUsage } from "@/server/llm/usage";
import {
  computeConfidence,
  type ConfidenceResult,
} from "@/server/confidence/engine";
import { needsSecondReading } from "@/server/confidence/policy";
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
) {
  try {
    return await extract(kind, file, {
      secondOpinion: true,
      avoid: primaryProvider as never,
    });
  } catch {
    return null;
  }
}


/**
 * Third, focused reading of only the disputed fields. Like the second
 * reading, a failure here degrades gracefully — the dispute simply stays
 * flagged for a human instead of being auto-resolved.
 */
async function focusedRecheck(
  fields: readonly string[],
  file: { data: Buffer; mimeType: string; filename?: string },
  primaryProvider: string,
) {
  try {
    return await extractFocused(fields, file, {
      avoid: primaryProvider as never,
    });
  } catch {
    return null;
  }
}

/** Summarize what the deterministic checks concluded, for the trace. */
function describeValidation(confidence: ConfidenceResult): string {
  const meta = Object.entries(confidence.fieldMeta);
  const confirmed = meta.filter(([, m]) => m.confidence >= 0.9).length;
  const flagged = meta.filter(([, m]) => m.confidence < 0.7).length;
  const parts = [`${confirmed} field${confirmed === 1 ? "" : "s"} corroborated by arithmetic and format checks`];
  if (flagged > 0) parts.push(`${flagged} contradicted`);
  return parts.join(", ");
}

export function listDocuments(workspaceId: string) {
  return db.query.documents.findMany({
    where: eq(documents.workspaceId, workspaceId),
    orderBy: [desc(documents.createdAt)],
    // The pipeline trace is a per-document diagnostic view, fetched on
    // demand from its own endpoint — shipping one per row would dominate
    // this response for no benefit.
    columns: { pipeline: false },
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
  const trace = new PipelineTrace();
  trace.ok("store", trace.begin(), {
    detail: `${file.name} (${(file.data.length / 1024).toFixed(0)} KB) saved to ${process.env.BLOB_READ_WRITE_TOKEN ? "blob storage" : "local disk"}`,
  });

  try {
    let t = trace.begin();
    const { kind, text } = await detectFileKind(file.data, file.type);
    const KIND_DETAIL: Record<string, string> = {
      digital_pdf: "Digital PDF — has a text layer, so the text can be read exactly",
      scanned_pdf: "Scanned PDF — no text layer, needs a vision model",
      image: "Image — needs a vision model",
    };
    trace.ok("detect", t, { detail: KIND_DETAIL[kind] ?? kind });

    await db
      .update(documents)
      .set({ fileKind: kind, status: "processing", error: null, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    t = trace.begin();
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
    let usage: TokenUsage = addUsage(emptyUsage(), result.usage);
    trace.ok("extract", t, {
      detail:
        kind === "digital_pdf"
          ? "Read the PDF's text layer"
          : "Read the document visually",
      provider,
      model: result.modelId,
      usage: result.usage,
    });

    // Confidence: second reading (different provider when available, else a
    // different tier + modality), duplicate history, arithmetic and format
    // checks (decisions.md §8).
    const fileInput = {
      data: file.data,
      mimeType: file.type,
      text,
      filename: file.name,
    };
    t = trace.begin();
    const candidates = await duplicateCandidates(workspaceId, documentId);

    // Cheap deterministic checks first; they decide whether the expensive
    // ones are needed at all (decisions.md §21).
    let confidence = computeConfidence({ extraction, duplicateCandidates: candidates });
    trace.ok("validate", t, {
      detail: describeValidation(confidence),
    });

    let second: Extraction | null = null;
    if (needsSecondReading(kind, confidence)) {
      t = trace.begin();
      const reading = await secondOpinion(kind, fileInput, provider);
      if (reading) {
        second = reading.extraction;
        usage = addUsage(usage, reading.usage);
        confidence = computeConfidence({
          extraction,
          secondOpinion: second,
          duplicateCandidates: candidates,
        });
        trace.ok("second_reading", t, {
          detail:
            reading.provider === provider
              ? "Same provider, different model and input format — an independent look"
              : `Independent reading from a different provider (${reading.provider})`,
          provider: reading.provider,
          model: reading.modelId,
          usage: reading.usage,
        });
      } else {
        trace.failed("second_reading", t, "Second reading failed; relying on the remaining signals");
      }
    } else {
      trace.skipped(
        "second_reading",
        "Skipped — the document's own arithmetic reconciles and the text layer is exact, so a second opinion would add cost without adding evidence",
      );
    }

    if (second) {
      trace.ok("compare", trace.begin(), {
        detail:
          confidence.disputedFields.length === 0
            ? "Both readings agree on every field"
            : `Readings disagree on: ${confidence.disputedFields.join(", ")}`,
      });
    } else {
      trace.skipped("compare", "Nothing to compare — only one reading was taken");
    }

    // Escalation before humans: where the two readings disagree, re-read
    // just those fields and let majority voting settle it (decisions.md §20).
    if (second && confidence.disputedFields.length > 0) {
      t = trace.begin();
      const disputed = [...confidence.disputedFields];
      const tiebreak = await focusedRecheck(disputed, fileInput, provider);
      if (tiebreak) {
        usage = addUsage(usage, tiebreak.usage);
        confidence = computeConfidence({
          extraction,
          secondOpinion: second,
          tiebreak: tiebreak.fields,
          duplicateCandidates: candidates,
        });
        const corrected = Object.keys(confidence.corrections);
        trace.ok("tiebreak", t, {
          detail: `Re-read ${disputed.join(", ")} on their own. ${
            corrected.length > 0
              ? `Majority vote corrected: ${corrected.join(", ")}`
              : "Majority vote kept the first reading"
          }`,
          usage: tiebreak.usage,
        });
      } else {
        trace.failed("tiebreak", t, "Focused re-read failed; disputed fields go to review");
      }
    } else {
      trace.skipped(
        "tiebreak",
        second
          ? "Not needed — the readings already agree"
          : "Not applicable — only one reading was taken",
      );
    }

    trace.ok("duplicates", trace.begin(), {
      detail: confidence.matchedDuplicateId
        ? "Matches a document already in this workspace"
        : `Compared against ${candidates.length} existing document${candidates.length === 1 ? "" : "s"} — no match`,
    });

    trace.ok("score", trace.begin(), {
      detail:
        confidence.flaggedCount === 0
          ? "Every field passed — nothing needs your attention"
          : `${confidence.flaggedCount} field${confidence.flaggedCount === 1 ? "" : "s"} flagged for review`,
    });

    // Majority voting may have overruled the primary reading on a field.
    const resolved = { ...extraction, ...confidence.corrections } as Extraction;

    const row = {
      documentId,
      workspaceId,
      vendor: resolved.vendor,
      invoiceNumber: resolved.invoice_number,
      docDate: resolved.doc_date,
      currency: resolved.currency,
      subtotal: resolved.subtotal?.toString() ?? null,
      tax: resolved.tax?.toString() ?? null,
      total: resolved.total?.toString() ?? null,
      category: resolved.category,
      extraFields: extraction.extra_fields,
      fieldMeta: confidence.fieldMeta,
      usage,
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
      .set({
        status: "needs_review",
        pipeline: trace.toJSON(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();
    return { document: updated };
  } catch (err) {
    const { message, retryable, kind } = classifyLlmError(err);
    trace.failed("score", trace.begin(), message);
    const [failed] = await db
      .update(documents)
      .set({
        status: "failed",
        error: message,
        pipeline: trace.toJSON(),
        updatedAt: new Date(),
      })
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
