import {
  DocumentStatus,
  ExtractionField,
  FileKind,
  MessageRole,
  PipelineStageKey,
  Provider,
  QueryAggregate,
  StageStatus,
} from "@/server/constants";
import type { QueryDsl, QueryFilter } from "@/server/llm/query-translate";
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

export const documentStatus = pgEnum(
  "document_status",
  Object.values(DocumentStatus) as [string, ...string[]],
);

export const fileKind = pgEnum(
  "file_kind",
  Object.values(FileKind) as [string, ...string[]],
);

export const messageRole = pgEnum(
  "message_role",
  Object.values(MessageRole) as [string, ...string[]],
);

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  calls: number;
}

/** Runtime result of one pipeline stage; labels and edges live in the graph. */
export interface StageResult {
  key: PipelineStageKey;
  status: StageStatus;
  detail: string;
  durationMs: number;
  provider?: Provider;
  model?: string;
  usage?: TokenUsage;
}

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: text("workspace_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  // Detected after upload: digital PDFs route to a text model, scans/images to a vision model.
  fileKind: fileKind("file_kind"),
  // Disk driver: relative key under uploads/. Blob driver: full URL.
  storagePath: text("storage_path").notNull(),
  status: documentStatus("status").notNull().default(DocumentStatus.Processing),
  error: text("error"),
  /** What ingestion actually did, stage by stage — surfaced in the UI. */
  pipeline: jsonb("pipeline").$type<StageResult[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export interface FieldConfidence {
  confidence: number;
  reasons: string[];
}

/** Per-field confidence, keyed by extraction field. Displayed, never filtered. */
export type FieldMeta = Partial<Record<ExtractionField, FieldConfidence>>;

/**
 * Document data outside the fixed schema, so nothing legible is lost.
 * `key` is the normalized name (po_number) for querying; `label` is the
 * text as printed (PO No.) for display.
 */
export interface ExtraField {
  key: string;
  label: string;
  value: string;
}

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
 * A saved ask-the-ledger thread. Scoped to a workspace like everything else
 * (§10), so conversations don't leak between anonymous sessions.
 */
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: text("workspace_id").notNull(),
  /** Derived from the opening question — a thread with no name is unfindable. */
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Bumped on every turn, so the list can sort by most recently used. */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * What the assistant answered, kept structurally rather than as prose.
 *
 * The rows themselves are deliberately *not* stored — only the ids that
 * matched. A ledger row can be corrected after the fact, and replaying a
 * stale copy of it would be exactly the kind of quietly-wrong answer this
 * product exists to avoid. Re-reading by id shows today's truth; the
 * interpretation and figures record what was said at the time.
 */
export interface StoredAnswer {
  interpretation: string;
  aggregateKind: QueryAggregate;
  aggregateValue: number | null;
  matchedDocumentIds: string[];
  /** Filters the server could not apply — surfaced, never silently dropped. */
  ignoredFilters: QueryFilter[];
  /** Retained so a past question can be re-run rather than retyped. */
  dsl: QueryDsl;
}

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").notNull(),
  role: messageRole("role").notNull(),
  /** The question as asked, or the assistant's interpretation of it. */
  content: text("content").notNull(),
  /** Assistant turns only; null on the user's side of the exchange. */
  answer: jsonb("answer").$type<StoredAnswer>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
