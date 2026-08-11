import { ExtractionField, FindingKind } from "@/server/constants";
import {
  type DuplicateCandidate,
  type Extraction,
  type Finding,
  toCents,
} from "./types";

/**
 * Duplicate detection (decisions.md §8): ~2.5% of invoices submitted to
 * businesses are duplicates, and paying one twice is real money lost. We
 * compare against existing documents in the workspace on the fields we
 * already extract.
 */

export interface DuplicateResult {
  findings: Finding[];
  /** The strongest matched existing document, if any. */
  matchedDocumentId: string | null;
}

function normText(value: string | null): string | null {
  if (value === null) return null;
  const n = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return n.length > 0 ? n : null;
}

export function duplicateSignal(
  extraction: Extraction,
  candidates: DuplicateCandidate[],
): DuplicateResult {
  const invoiceNo = normText(extraction.invoice_number);
  const vendor = normText(extraction.vendor);
  const total = toCents(extraction.total);
  const docDate = extraction.doc_date;

  for (const candidate of candidates) {
    const cInvoiceNo = normText(candidate.invoiceNumber);
    const cVendor = normText(candidate.vendor);
    const cTotal =
      candidate.total !== null ? toCents(parseFloat(candidate.total)) : null;

    // Strongest: same invoice number from the same vendor.
    if (invoiceNo !== null && invoiceNo === cInvoiceNo) {
      const sameVendor = vendor !== null && vendor === cVendor;
      return {
        findings: [
          {
            field: ExtractionField.Duplicate,
            kind: FindingKind.Suspect,
            reason: sameVendor
              ? `Same invoice number and vendor as "${candidate.filename}" — this looks like a duplicate upload`
              : `Invoice number matches "${candidate.filename}" — possible duplicate`,
          },
        ],
        matchedDocumentId: candidate.documentId,
      };
    }

    // Near-miss: same vendor, same amount, same date (invoice number absent
    // or misread — common on receipts).
    if (
      vendor !== null &&
      vendor === cVendor &&
      total !== null &&
      total === cTotal &&
      docDate !== null &&
      docDate === candidate.docDate
    ) {
      return {
        findings: [
          {
            field: ExtractionField.Duplicate,
            kind: FindingKind.Suspect,
            reason: `Same vendor, amount, and date as "${candidate.filename}" — possible duplicate`,
          },
        ],
        matchedDocumentId: candidate.documentId,
      };
    }
  }

  return {
    findings: [{ field: ExtractionField.Duplicate, kind: FindingKind.Confirm }],
    matchedDocumentId: null,
  };
}
