import { ExtractionField, FindingKind } from "@/server/constants";
import { type Extraction, type Finding, toCents } from "./types";

/**
 * Independent-reading agreement (decisions.md §8): the document is read
 * twice and compared field-by-field. The second reading is made as
 * independent as the configured keys allow — a different provider when
 * available, else a different model tier and input modality.
 */

function normText(value: string | null): string | null {
  if (value === null) return null;
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function agreementSignal(
  primary: Extraction,
  second: Extraction,
): Finding[] {
  const findings: Finding[] = [];

  const compare = (
    field: ExtractionField,
    a: unknown,
    b: unknown,
    display: (v: unknown) => string = String,
  ) => {
    // Only compare when both models produced a value; a single-sided miss
    // is already covered by the missing-field finding.
    if (a === null || b === null) return;
    if (a === b) {
      findings.push({ field, kind: FindingKind.Confirm });
    } else {
      findings.push({
        field,
        kind: FindingKind.Suspect,
        reason: `Two independent readings disagree: one read ${display(a)}, the other ${display(b)}`,
      });
    }
  };

  compare(ExtractionField.Vendor, normText(primary.vendor), normText(second.vendor), () =>
    `"${primary.vendor}" vs "${second.vendor}"`.slice(0),
  );
  compare(
    ExtractionField.InvoiceNumber,
    normText(primary.invoice_number),
    normText(second.invoice_number),
    () => `"${primary.invoice_number}" vs "${second.invoice_number}"`,
  );
  compare(ExtractionField.DocDate, primary.doc_date, second.doc_date);
  compare(
    ExtractionField.Currency,
    primary.currency?.toUpperCase() ?? null,
    second.currency?.toUpperCase() ?? null,
  );
  compare(ExtractionField.Subtotal, toCents(primary.subtotal), toCents(second.subtotal), () =>
    `${primary.subtotal} vs ${second.subtotal}`,
  );
  compare(ExtractionField.Tax, toCents(primary.tax), toCents(second.tax), () =>
    `${primary.tax} vs ${second.tax}`,
  );
  compare(ExtractionField.Total, toCents(primary.total), toCents(second.total), () =>
    `${primary.total} vs ${second.total}`,
  );
  compare(ExtractionField.Category, primary.category, second.category);

  return findings;
}
