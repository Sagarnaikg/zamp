import { describe, expect, it } from "vitest";
import { duplicateSignal } from "./duplicates";
import type { DuplicateCandidate, Extraction } from "./types";

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    vendor: "Acme Cloud Services Inc.",
    invoice_number: "INV-2041",
    doc_date: "2026-07-28",
    currency: "USD",
    subtotal: 760,
    tax: 76,
    total: 836,
    category: "software",
    line_items: [],
    ...overrides,
  };
}

function candidate(
  overrides: Partial<DuplicateCandidate> = {},
): DuplicateCandidate {
  return {
    documentId: "doc-1",
    filename: "earlier-invoice.pdf",
    invoiceNumber: "INV-2041",
    vendor: "Acme Cloud Services Inc.",
    total: "836.00",
    docDate: "2026-07-28",
    ...overrides,
  };
}

describe("duplicateSignal", () => {
  it("flags a same-invoice-number, same-vendor match as a duplicate upload", () => {
    const result = duplicateSignal(extraction(), [candidate()]);
    expect(result.matchedDocumentId).toBe("doc-1");
    expect(result.findings[0].kind).toBe("suspect");
    expect(result.findings[0].reason).toContain("earlier-invoice.pdf");
    expect(result.findings[0].reason).toContain("duplicate upload");
  });

  it("matches invoice numbers despite formatting differences", () => {
    const result = duplicateSignal(extraction({ invoice_number: "inv 2041" }), [
      candidate({ invoiceNumber: "INV-2041" }),
    ]);
    expect(result.matchedDocumentId).toBe("doc-1");
  });

  it("flags vendor + amount + date matches when invoice numbers are absent", () => {
    const result = duplicateSignal(extraction({ invoice_number: null }), [
      candidate({ invoiceNumber: null }),
    ]);
    expect(result.matchedDocumentId).toBe("doc-1");
    expect(result.findings[0].reason).toContain("Same vendor, amount, and date");
  });

  it("does not flag the same vendor with a different amount", () => {
    const result = duplicateSignal(extraction({ invoice_number: null }), [
      candidate({ invoiceNumber: null, total: "412.00" }),
    ]);
    expect(result.matchedDocumentId).toBeNull();
    expect(result.findings[0].kind).toBe("confirm");
  });

  it("confirms cleanly when there is no history", () => {
    const result = duplicateSignal(extraction(), []);
    expect(result.matchedDocumentId).toBeNull();
    expect(result.findings[0]).toEqual({ field: "duplicate", kind: "confirm" });
  });
});
