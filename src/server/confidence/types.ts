import { ExtractionField, FindingKind } from "@/server/constants";
import type { FieldMeta } from "@/server/db/schema";
import type { Extraction } from "@/server/llm/extraction";

export type { Extraction, FieldMeta };

/** A signal's verdict about one field. Signals are pure and side-effect free. */
export interface Finding {
  field: ExtractionField;
  kind: FindingKind;
  reason?: string;
}

/** Existing document compared against for duplicate detection. */
export interface DuplicateCandidate {
  documentId: string;
  filename: string;
  invoiceNumber: string | null;
  vendor: string | null;
  total: string | null;
  docDate: string | null;
}

/** Currency amount as integer cents; null-safe. */
export function toCents(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value * 100);
}

export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
