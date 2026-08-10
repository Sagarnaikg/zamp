import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  documents,
  extractions,
  lineItems,
  type FieldMeta,
} from "@/server/db/schema";

/** Fields a human may correct in review. Allow-list, not reflection. */
const CORRECTABLE_FIELDS = [
  "vendor",
  "invoiceNumber",
  "docDate",
  "currency",
  "subtotal",
  "tax",
  "total",
  "category",
] as const;

export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

export function isCorrectableField(field: string): field is CorrectableField {
  return (CORRECTABLE_FIELDS as readonly string[]).includes(field);
}

export async function getDocumentDetail(workspaceId: string, documentId: string) {
  const doc = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, documentId),
      eq(documents.workspaceId, workspaceId),
    ),
  });
  if (!doc) return null;

  const [extraction, items, history] = await Promise.all([
    db.query.extractions.findFirst({
      where: eq(extractions.documentId, documentId),
    }),
    db.query.lineItems.findMany({
      where: eq(lineItems.documentId, documentId),
      orderBy: [asc(lineItems.position)],
    }),
    db.query.auditLogs.findMany({
      where: eq(auditLogs.documentId, documentId),
      orderBy: [asc(auditLogs.createdAt)],
    }),
  ]);

  return { document: doc, extraction, lineItems: items, auditLog: history };
}

/**
 * Apply human corrections: update the extraction, record each change in the
 * insert-only audit trail, and mark the field human-verified (confidence 1)
 * — a person looked at the document; that outranks every signal.
 */
export async function correctFields(
  workspaceId: string,
  documentId: string,
  changes: Partial<Record<CorrectableField, string | null>>,
) {
  const extraction = await db.query.extractions.findFirst({
    where: and(
      eq(extractions.documentId, documentId),
      eq(extractions.workspaceId, workspaceId),
    ),
  });
  if (!extraction) return null;

  const fieldMeta: FieldMeta = { ...extraction.fieldMeta };
  const updates: Record<string, string | null> = {};

  for (const [field, newValue] of Object.entries(changes)) {
    if (!isCorrectableField(field)) continue;
    const oldValue = extraction[field] as string | null;
    if (oldValue === newValue) continue;

    updates[field] = newValue;
    await db.insert(auditLogs).values({
      documentId,
      workspaceId,
      field,
      oldValue,
      newValue,
    });

    // field_meta keys use the extraction's snake_case field names.
    const metaKey = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    fieldMeta[metaKey] = { confidence: 1, reasons: ["Corrected by you"] };
  }

  if (Object.keys(updates).length === 0) {
    return { extraction, corrected: [] };
  }

  const [updated] = await db
    .update(extractions)
    .set({ ...updates, fieldMeta, updatedAt: new Date() })
    .where(eq(extractions.id, extraction.id))
    .returning();

  return { extraction: updated, corrected: Object.keys(updates) };
}

/** Accept a reviewed document into the ledger. */
export async function acceptDocument(workspaceId: string, documentId: string) {
  const [updated] = await db
    .update(documents)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.workspaceId, workspaceId),
        eq(documents.status, "needs_review"),
      ),
    )
    .returning();
  return updated ?? null;
}

/** Reject a document: it never enters the ledger; rows cascade-delete. */
export async function rejectDocument(workspaceId: string, documentId: string) {
  const [deleted] = await db
    .delete(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.workspaceId, workspaceId)),
    )
    .returning();
  return deleted ?? null;
}
