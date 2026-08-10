import { type Extraction, toCents } from "./types";

/**
 * Field-aware value comparison, shared by the agreement signal and the
 * tiebreaker so both judge "same reading" identically. Comparison is
 * normalized per field type: "ACME CLOUD, INC" and "Acme Cloud Inc." are
 * the same vendor; 836 and 836.00 are the same amount.
 */

/** Fields that two independent readings are compared on. */
export const COMPARABLE_FIELDS = [
  "vendor",
  "invoice_number",
  "doc_date",
  "currency",
  "subtotal",
  "tax",
  "total",
  "category",
] as const;

export type ComparableField = (typeof COMPARABLE_FIELDS)[number];

const MONEY_FIELDS = new Set<string>(["subtotal", "tax", "total"]);
const TEXT_FIELDS = new Set<string>(["vendor", "invoice_number"]);

/** Reduce a value to the form used for equality checks. */
export function normalizeValue(field: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (MONEY_FIELDS.has(field)) return toCents(value as number);
  if (TEXT_FIELDS.has(field)) {
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, "") || null;
  }
  if (field === "currency") return String(value).toUpperCase();
  return value;
}

/**
 * Do two readings agree on this field? `null` means "can't tell" — one side
 * didn't produce a value, which is a missing-field problem, not a conflict.
 */
export function valuesMatch(
  field: string,
  a: unknown,
  b: unknown,
): boolean | null {
  const left = normalizeValue(field, a);
  const right = normalizeValue(field, b);
  if (left === null || right === null) return null;
  return left === right;
}

/** Human-facing rendering of a value inside a reason string. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "nothing";
  return typeof value === "string" ? `"${value}"` : String(value);
}

export function fieldValue(
  extraction: Extraction,
  field: ComparableField,
): unknown {
  return extraction[field];
}
