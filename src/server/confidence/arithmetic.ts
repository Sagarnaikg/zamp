import { EXTRACTION, ExtractionField, FindingKind } from "@/server/constants";
import {
  type Extraction,
  type Finding,
  toCents,
  formatAmount,
} from "./types";

/**
 * Arithmetic consistency — the strongest signal we have (decisions.md §8).
 * Passing math is verifiable evidence the extraction is right; failing math
 * localizes which field is suspect instead of flagging everything.
 */

function eq(a: number, b: number): boolean {
  return Math.abs(a - b) <= EXTRACTION.arithmeticToleranceCents;
}

/** True when two amounts have the same digits in a different order. */
function looksLikeDigitSwap(a: number, b: number): boolean {
  const digits = (n: number) => String(n).split("").sort().join("");
  return a !== b && digits(a) === digits(b);
}

export function arithmeticSignal(extraction: Extraction): Finding[] {
  const findings: Finding[] = [];

  const subtotal = toCents(extraction.subtotal);
  const tax = toCents(extraction.tax);
  const total = toCents(extraction.total);

  // Per-line check: qty × unit price should equal the line amount.
  for (const [i, item] of extraction.line_items.entries()) {
    if (
      item.quantity !== null &&
      item.unit_price !== null &&
      item.amount !== null
    ) {
      const expected = Math.round(item.quantity * item.unit_price * 100);
      const actual = toCents(item.amount)!;
      if (!eq(expected, actual)) {
        findings.push({
          field: ExtractionField.LineItems,
          kind: FindingKind.Suspect,
          reason: `Line ${i + 1} ("${item.description ?? "?"}"): ${item.quantity} × ${item.unit_price} = ${formatAmount(expected)}, but the line amount reads ${formatAmount(actual)}`,
        });
      }
    }
  }

  const amounts = extraction.line_items.map((it) => toCents(it.amount));
  const allAmountsPresent =
    amounts.length > 0 && amounts.every((a) => a !== null);
  const itemSum = allAmountsPresent
    ? (amounts as number[]).reduce((a, b) => a + b, 0)
    : null;

  // Line items vs subtotal (or vs total when no subtotal is printed).
  let itemsMatchSubtotal: boolean | null = null;
  if (itemSum !== null && subtotal !== null) {
    itemsMatchSubtotal = eq(itemSum, subtotal);
    if (itemsMatchSubtotal) {
      findings.push({ field: ExtractionField.Subtotal, kind: FindingKind.Confirm });
      findings.push({ field: ExtractionField.LineItems, kind: FindingKind.Confirm });
    }
  }

  // Subtotal + tax vs total.
  let subtotalTaxMatchTotal: boolean | null = null;
  if (subtotal !== null && total !== null) {
    const expectedTotal = subtotal + (tax ?? 0);
    subtotalTaxMatchTotal = eq(expectedTotal, total);
    if (subtotalTaxMatchTotal) {
      findings.push({ field: ExtractionField.Total, kind: FindingKind.Confirm });
      if (tax !== null) findings.push({ field: ExtractionField.Tax, kind: FindingKind.Confirm });
      if (itemsMatchSubtotal === null) {
        findings.push({ field: ExtractionField.Subtotal, kind: FindingKind.Confirm });
      }
    }
  }

  // Localize the mismatches: prefer blaming the field the evidence points at.
  if (itemsMatchSubtotal === false) {
    const sumStr = formatAmount(itemSum!);
    const subStr = formatAmount(subtotal!);
    // If the item sum is consistent with the total, the subtotal is the odd one out.
    if (
      total !== null &&
      eq(itemSum! + (tax ?? 0), total) &&
      subtotalTaxMatchTotal === false
    ) {
      findings.push({
        field: ExtractionField.Subtotal,
        kind: FindingKind.Suspect,
        reason: `Line items sum to ${sumStr}, which is consistent with the total — but subtotal reads ${subStr}${looksLikeDigitSwap(itemSum!, subtotal!) ? " (possible digit swap)" : ""}`,
      });
    } else {
      const swap = looksLikeDigitSwap(itemSum!, subtotal!)
        ? " (possible digit swap)"
        : "";
      findings.push({
        field: ExtractionField.Subtotal,
        kind: FindingKind.Suspect,
        reason: `Line items sum to ${sumStr} but subtotal reads ${subStr}${swap}`,
      });
      findings.push({
        field: ExtractionField.LineItems,
        kind: FindingKind.Suspect,
        reason: `Line items sum to ${sumStr} but subtotal reads ${subStr} — one of them is misread, or the document's own math is wrong`,
      });
    }
  }

  if (subtotalTaxMatchTotal === false) {
    const expected = formatAmount(subtotal! + (tax ?? 0));
    const totStr = formatAmount(total!);
    // If line items agree with the subtotal, the total is the odd one out.
    const swap = looksLikeDigitSwap(subtotal! + (tax ?? 0), total!)
      ? " (possible digit swap)"
      : "";
    findings.push({
      field: ExtractionField.Total,
      kind: FindingKind.Suspect,
      reason: `Subtotal ${formatAmount(subtotal!)}${tax !== null ? ` + tax ${formatAmount(tax)}` : ""} = ${expected}, but total reads ${totStr}${swap}`,
    });
    if (itemsMatchSubtotal !== true && tax !== null) {
      findings.push({
        field: ExtractionField.Tax,
        kind: FindingKind.Suspect,
        reason: `Subtotal + tax does not equal the total — tax may be misread`,
      });
    }
  }

  return findings;
}
