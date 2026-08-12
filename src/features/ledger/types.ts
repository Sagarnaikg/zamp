import type { ExtraField, StoredAnswer } from "@/server/db/schema";
import type { MessageRole, QueryAggregate } from "@/server/constants";
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

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  answer: StoredAnswer | null;
  createdAt: string;
  /** Re-read at fetch time, so a corrected document shows its current value. */
  rows: LedgerRow[];
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
}

export interface QueryResponse {
  /** The thread this exchange was recorded into — new if none was passed. */
  conversationId: string;
  question: string;
  /** Rendered from the filters that actually ran, not the model's words (§5). */
  interpretation: string;
  dsl: QueryDsl;
  /** Filters the server could not apply — shown, never silently dropped. */
  ignoredFilters: QueryFilter[];
  rows: LedgerRow[];
  aggregate: { kind: QueryAggregate; value: number | null };
}
