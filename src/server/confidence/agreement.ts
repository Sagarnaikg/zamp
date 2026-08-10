import { type Extraction, type Finding, toCents } from "./types";

/**
 * Independent-reading agreement (decisions.md §8): the document is read
 * twice and the results compared field-by-field — like a second human
 * reviewer checking the first one's work. The second reading is made as
 * independent as the configured keys allow: a different provider when one
 * is available, otherwise the same provider with a different model tier
 * AND a different input modality (vision vs text layer for digital PDFs),
 * so the two readings don't share a single pipeline's blind spots. Where
 * they agree, confidence rises; where they disagree, the user sees both
 * readings.
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
    field: string,
    a: unknown,
    b: unknown,
    display: (v: unknown) => string = String,
  ) => {
    // Only compare when both models produced a value; a single-sided miss
    // is already covered by the missing-field finding.
    if (a === null || b === null) return;
    if (a === b) {
      findings.push({ field, kind: "confirm" });
    } else {
      findings.push({
        field,
        kind: "suspect",
        reason: `Two independent readings disagree: one read ${display(a)}, the other ${display(b)}`,
      });
    }
  };

  compare("vendor", normText(primary.vendor), normText(second.vendor), () =>
    `"${primary.vendor}" vs "${second.vendor}"`.slice(0),
  );
  compare(
    "invoice_number",
    normText(primary.invoice_number),
    normText(second.invoice_number),
    () => `"${primary.invoice_number}" vs "${second.invoice_number}"`,
  );
  compare("doc_date", primary.doc_date, second.doc_date);
  compare(
    "currency",
    primary.currency?.toUpperCase() ?? null,
    second.currency?.toUpperCase() ?? null,
  );
  compare("subtotal", toCents(primary.subtotal), toCents(second.subtotal), () =>
    `${primary.subtotal} vs ${second.subtotal}`,
  );
  compare("tax", toCents(primary.tax), toCents(second.tax), () =>
    `${primary.tax} vs ${second.tax}`,
  );
  compare("total", toCents(primary.total), toCents(second.total), () =>
    `${primary.total} vs ${second.total}`,
  );
  compare("category", primary.category, second.category);

  return findings;
}
