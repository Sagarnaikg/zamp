import { type Extraction, type Finding, toCents } from "./types";

/**
 * Cross-model agreement (decisions.md §8): two models from different
 * providers reading the same document. Where they agree, confidence rises;
 * where they disagree, the user sees both readings. Only runs when a second
 * provider key is configured — with one key this signal is simply absent.
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
        reason: `Two models disagree: one read ${display(a)}, the other ${display(b)}`,
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

  return findings;
}
