import {
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const documentStatus = pgEnum("document_status", [
  "processing",
  "needs_review",
  "accepted",
  "failed",
]);

export const fileKind = pgEnum("file_kind", [
  "digital_pdf",
  "scanned_pdf",
  "image",
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: text("workspace_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  // Detected after upload: digital PDFs route to a text model, scans/images to a vision model.
  fileKind: fileKind("file_kind"),
  // Disk driver: relative key under uploads/. Blob driver: full URL.
  storagePath: text("storage_path").notNull(),
  status: documentStatus("status").notNull().default("processing"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Per-field confidence metadata, keyed by extraction column name.
 * Displayed in the review UI, never filtered on — hence JSONB.
 */
export type FieldMeta = Record<
  string,
  { confidence: number; reasons: string[] }
>;

/**
 * Capture net for document data outside the fixed schema (PO numbers, due
 * dates, payment terms, tax IDs, ...). Guarantees no silent data loss at
 * ingestion. `key` is the normalized canonical name (po_number), `label`
 * the text as printed on the document (PO No.) — key for querying, label
 * for display.
 */
export type ExtraField = { key: string; label: string; value: string };

/** Token cost of the model calls that produced this extraction. */
export type TokenUsage = {
  input: number;
  output: number;
  total: number;
  calls: number;
};

export const extractions = pgTable("extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .unique()
    .references(() => documents.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").notNull(),
  vendor: text("vendor"),
  invoiceNumber: text("invoice_number"),
  docDate: date("doc_date"),
  currency: text("currency"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }),
  tax: numeric("tax", { precision: 14, scale: 2 }),
  total: numeric("total", { precision: 14, scale: 2 }),
  category: text("category"),
  extraFields: jsonb("extra_fields")
    .$type<ExtraField[]>()
    .notNull()
    .default([]),
  fieldMeta: jsonb("field_meta").$type<FieldMeta>().notNull().default({}),
  usage: jsonb("usage")
    .$type<TokenUsage>()
    .notNull()
    .default({ input: 0, output: 0, total: 0, calls: 0 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const lineItems = pgTable("line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").notNull(),
  position: integer("position").notNull(),
  description: text("description"),
  quantity: numeric("quantity", { precision: 14, scale: 3 }),
  unitPrice: numeric("unit_price", { precision: 14, scale: 4 }),
  amount: numeric("amount", { precision: 14, scale: 2 }),
});

/**
 * Audit log of human fixes made in the review UI.
 * Rows are only ever inserted — extraction values change, history doesn't.
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").notNull(),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
