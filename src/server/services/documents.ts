import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, extractions, lineItems } from "@/server/db/schema";
import { getStorage } from "@/server/storage";
import { detectFileKind } from "@/server/ingest/detect";
import { extract } from "@/server/llm/extraction";

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

  try {
    const { kind, text } = await detectFileKind(file.data, file.type);
    await db
      .update(documents)
      .set({ fileKind: kind, updatedAt: new Date() })
      .where(eq(documents.id, doc.id));

    const result = await extract(kind, {
      data: file.data,
      mimeType: file.type,
      text,
    });
    if (!result) {
      throw new Error("No extraction result returned");
    }
    const { extraction } = result;

    await db.insert(extractions).values({
      documentId: doc.id,
      workspaceId,
      vendor: extraction.vendor,
      invoiceNumber: extraction.invoice_number,
      docDate: extraction.doc_date,
      currency: extraction.currency,
      subtotal: extraction.subtotal?.toString() ?? null,
      tax: extraction.tax?.toString() ?? null,
      total: extraction.total?.toString() ?? null,
      category: extraction.category,
    });

    if (extraction.line_items.length > 0) {
      await db.insert(lineItems).values(
        extraction.line_items.map((item, i) => ({
          documentId: doc.id,
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
      .where(eq(documents.id, doc.id))
      .returning();
    return { document: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    const [failed] = await db
      .update(documents)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(documents.id, doc.id))
      .returning();
    return { document: failed, error: message };
  }
}
