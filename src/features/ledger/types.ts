import type { ExtraField } from "@/server/db/schema";
import type { QueryAggregate } from "@/server/constants";
import type { QueryDsl, QueryFilter } from "@/server/llm/query-translate";

/** One accepted document as it appears in the ledger. */
export interface LedgerRow {
  documentId: string;
  filename: string;
  vendor: string | null;
  invoiceNumber: string | null;
  docDate: string | null;
  currency: string | null;
  subtotal: string | null;
  tax: string | null;
  total: string | null;
  category: string | null;
  extraFields: ExtraField[];
}

export interface LedgerResponse {
  rows: LedgerRow[];
}

export interface QueryResponse {
  question: string;
  /** Rendered from the filters that actually ran, not the model's words (§5). */
  interpretation: string;
  dsl: QueryDsl;
  /** Filters the server could not apply — shown, never silently dropped. */
  ignoredFilters: QueryFilter[];
  rows: LedgerRow[];
  aggregate: { kind: QueryAggregate; value: number | null };
}
