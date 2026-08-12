import type {
  auditLogs,
  documents,
  extractions,
  lineItems,
} from "@/server/db/schema";
import type { PipelineView } from "@/server/ingest/trace";

/**
 * Wire types derived from the server's own definitions rather than restated
 * by hand — a column rename becomes a compile error here instead of a runtime
 * `undefined` in the UI. Type-only imports, so no server code is bundled.
 */

/** The list endpoint omits the pipeline trace at the query level (§23). */
export type DocumentSummary = Omit<typeof documents.$inferSelect, "pipeline">;

export type Extraction = typeof extractions.$inferSelect;
type LineItem = typeof lineItems.$inferSelect;
export type AuditLogEntry = typeof auditLogs.$inferSelect;

export interface DocumentDetail {
  document: DocumentSummary;
  extraction: Extraction | undefined;
  lineItems: LineItem[];
  auditLog: AuditLogEntry[];
}

export interface DocumentListResponse {
  documents: DocumentSummary[];
}

export interface IngestResponse {
  document: DocumentSummary;
  error?: string;
}

export type DocumentPipeline = PipelineView & {
  status: DocumentSummary["status"];
};
