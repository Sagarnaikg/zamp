import {
  EXTRACTION,
  ExtractionField,
  FIELD_REASONS,
  FindingKind,
} from "@/server/constants";
import { type Extraction, type Finding } from "./types";
import { MONEY_FIELDS } from "./compare";

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



export function formatSignal(
  extraction: Extraction,
  today: Date = new Date(),
): Finding[] {
  const findings: Finding[] = [];

  // Missing core fields: not "wrong", but the user should know we found nothing.
  const core: Array<[ExtractionField, unknown]> = [
    [ExtractionField.Vendor, extraction.vendor],
    [ExtractionField.InvoiceNumber, extraction.invoice_number],
    [ExtractionField.DocDate, extraction.doc_date],
    [ExtractionField.Currency, extraction.currency],
    [ExtractionField.Subtotal, extraction.subtotal],
    [ExtractionField.Tax, extraction.tax],
    [ExtractionField.Total, extraction.total],
    [ExtractionField.Category, extraction.category],
  ];
  for (const [field, value] of core) {
    if (value === null || value === undefined) {
      findings.push({
        field,
        kind: FindingKind.Missing,
        reason: FIELD_REASONS.notFound,
      });
    }
  }

  if (extraction.doc_date !== null) {
    const parsed = new Date(extraction.doc_date + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extraction.doc_date) || isNaN(+parsed)) {
      findings.push({
        field: ExtractionField.DocDate,
        kind: FindingKind.Suspect,
        reason: `Date "${extraction.doc_date}" is not a valid YYYY-MM-DD date`,
      });
    } else {
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const oldest = new Date(today);
      oldest.setUTCFullYear(oldest.getUTCFullYear() - EXTRACTION.maxDocumentAgeYears);
      if (parsed > tomorrow) {
        findings.push({
          field: ExtractionField.DocDate,
          kind: FindingKind.Suspect,
          reason: `Date ${extraction.doc_date} is in the future`,
        });
      } else if (parsed < oldest) {
        findings.push({
          field: ExtractionField.DocDate,
          kind: FindingKind.Suspect,
          reason: `Date ${extraction.doc_date} is over ${EXTRACTION.maxDocumentAgeYears} years old — likely misread`,
        });
      } else {
        findings.push({ field: ExtractionField.DocDate, kind: FindingKind.Confirm });
      }
    }
  }

  if (extraction.currency !== null) {
    if (!ISO_CURRENCIES.has(extraction.currency.toUpperCase())) {
      findings.push({
        field: ExtractionField.Currency,
        kind: FindingKind.Suspect,
        reason: `"${extraction.currency}" is not a recognized ISO currency code`,
      });
    } else {
      findings.push({ field: ExtractionField.Currency, kind: FindingKind.Confirm });
    }
  }

  for (const field of MONEY_FIELDS) {
    const value = extraction[field];
    if (value !== null && value < 0) {
      findings.push({
        field,
        kind: FindingKind.Suspect,
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
      field: ExtractionField.Tax,
      kind: FindingKind.Suspect,
      reason: `Tax (${extraction.tax}) is larger than the subtotal (${extraction.subtotal}) — very unusual`,
    });
  }

  return findings;
}
