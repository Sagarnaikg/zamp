import { type Extraction, type Finding } from "./types";

/**
 * Format/plausibility validation (decisions.md §8): values that parse and
 * make sense in the real world. Cheap, deterministic, no false authority —
 * a failure here is always explainable to the user.
 */

const ISO_CURRENCIES = new Set([
  "USD", "EUR", "GBP", "INR", "JPY", "CNY", "AUD", "CAD", "CHF", "SGD",
  "HKD", "NZD", "SEK", "NOK", "DKK", "AED", "SAR", "BRL", "MXN", "ZAR",
  "KRW", "THB", "MYR", "IDR", "PHP", "VND", "PLN", "CZK", "TRY", "ILS",
]);

/** How far in the past a document date stays plausible. */
const MAX_AGE_YEARS = 20;

export function formatSignal(
  extraction: Extraction,
  today: Date = new Date(),
): Finding[] {
  const findings: Finding[] = [];

  // Missing core fields: not "wrong", but the user should know we found nothing.
  const core: Array<[string, unknown]> = [
    ["vendor", extraction.vendor],
    ["invoice_number", extraction.invoice_number],
    ["doc_date", extraction.doc_date],
    ["currency", extraction.currency],
    ["subtotal", extraction.subtotal],
    ["tax", extraction.tax],
    ["total", extraction.total],
    ["category", extraction.category],
  ];
  for (const [field, value] of core) {
    if (value === null || value === undefined) {
      findings.push({
        field,
        kind: "missing",
        reason: "Not found in the document",
      });
    }
  }

  if (extraction.doc_date !== null) {
    const parsed = new Date(extraction.doc_date + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extraction.doc_date) || isNaN(+parsed)) {
      findings.push({
        field: "doc_date",
        kind: "suspect",
        reason: `Date "${extraction.doc_date}" is not a valid YYYY-MM-DD date`,
      });
    } else {
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const oldest = new Date(today);
      oldest.setUTCFullYear(oldest.getUTCFullYear() - MAX_AGE_YEARS);
      if (parsed > tomorrow) {
        findings.push({
          field: "doc_date",
          kind: "suspect",
          reason: `Date ${extraction.doc_date} is in the future`,
        });
      } else if (parsed < oldest) {
        findings.push({
          field: "doc_date",
          kind: "suspect",
          reason: `Date ${extraction.doc_date} is over ${MAX_AGE_YEARS} years old — likely misread`,
        });
      } else {
        findings.push({ field: "doc_date", kind: "confirm" });
      }
    }
  }

  if (extraction.currency !== null) {
    if (!ISO_CURRENCIES.has(extraction.currency.toUpperCase())) {
      findings.push({
        field: "currency",
        kind: "suspect",
        reason: `"${extraction.currency}" is not a recognized ISO currency code`,
      });
    } else {
      findings.push({ field: "currency", kind: "confirm" });
    }
  }

  for (const field of ["subtotal", "tax", "total"] as const) {
    const value = extraction[field];
    if (value !== null && value < 0) {
      findings.push({
        field,
        kind: "suspect",
        reason: `${field} is negative (${value}) — credit notes aren't supported, so this is likely a misread`,
      });
    }
  }

  if (
    extraction.tax !== null &&
    extraction.subtotal !== null &&
    extraction.subtotal > 0 &&
    extraction.tax > extraction.subtotal
  ) {
    findings.push({
      field: "tax",
      kind: "suspect",
      reason: `Tax (${extraction.tax}) is larger than the subtotal (${extraction.subtotal}) — very unusual`,
    });
  }

  return findings;
}
