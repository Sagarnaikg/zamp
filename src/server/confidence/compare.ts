import { ExtractionField } from "@/server/constants";
import { toCents } from "./types";

/**
 * Field-aware comparison shared by the agreement signal and the tiebreaker,
 * so both judge "same reading" identically: "ACME CLOUD, INC" and "Acme
 * Cloud Inc." are the same vendor; 836 and 836.00 are the same amount.
 */

/** Fields that two independent readings are compared on. */
/** Fields two independent readings are compared on. */
export const COMPARABLE_FIELDS = [
  ExtractionField.Vendor,
  ExtractionField.InvoiceNumber,
  ExtractionField.DocDate,
  ExtractionField.Currency,
  ExtractionField.Subtotal,
  ExtractionField.Tax,
  ExtractionField.Total,
  ExtractionField.Category,
] as const;

export type ComparableField = (typeof COMPARABLE_FIELDS)[number];

/** Amount fields — compared numerically, and checked together elsewhere. */
export const MONEY_FIELDS = [
  ExtractionField.Subtotal,
  ExtractionField.Tax,
  ExtractionField.Total,
] as const;

const MONEY_FIELD_SET = new Set<string>(MONEY_FIELDS);
const TEXT_FIELD_SET = new Set<string>([
  ExtractionField.Vendor,
  ExtractionField.InvoiceNumber,
]);

/** Reduce a value to the form used for equality checks. */
function normalizeValue(field: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (MONEY_FIELD_SET.has(field)) return toCents(value as number);
  if (TEXT_FIELD_SET.has(field)) {
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, "") || null;
  }
  if (field === ExtractionField.Currency) return String(value).toUpperCase();
  return value;
}

/** `null` means "can't tell" — a missing value, not a conflict. */
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
