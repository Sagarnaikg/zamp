import type { Extraction } from "@/server/llm/extraction";

/**
 * A signal's verdict about one field. Signals are pure functions — they
 * never touch the DB or network — so each is unit-testable in isolation
 * (decisions.md §8).
 */
export interface Finding {
  field: string;
  kind: "confirm" | "suspect" | "missing";
  reason?: string;
}

/** Per-field result persisted to extractions.field_meta (JSONB). */
export interface FieldConfidence {
  confidence: number;
  reasons: string[];
}

export type FieldMeta = Record<string, FieldConfidence>;

/** Minimal shape of an existing document used for duplicate checking. */
export interface DuplicateCandidate {
  documentId: string;
  filename: string;
  invoiceNumber: string | null;
  vendor: string | null;
  total: string | null;
  docDate: string | null;
}

export type { Extraction };

/** Convert a currency amount to integer cents; null-safe. */
export function toCents(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value * 100);
}

export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
