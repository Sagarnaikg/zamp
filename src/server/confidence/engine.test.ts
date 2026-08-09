import { describe, expect, it } from "vitest";
import { CONFIDENCE, computeConfidence } from "./engine";
import type { Extraction } from "./types";

const TODAY = new Date("2026-08-10T00:00:00Z");

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
    line_items: [
      { description: "Hosting", quantity: 1, unit_price: 420, amount: 420 },
      { description: "Storage", quantity: 2, unit_price: 95, amount: 190 },
      { description: "Support", quantity: 1, unit_price: 150, amount: 150 },
    ],
    ...overrides,
  };
}

describe("computeConfidence", () => {
  it("verifies math-checked fields and leaves uncheckable ones unverified", () => {
    const { fieldMeta, flaggedCount } = computeConfidence({
      extraction: extraction(),
      today: TODAY,
    });
    expect(flaggedCount).toBe(0);
    // Math confirms these.
    expect(fieldMeta.subtotal.confidence).toBeGreaterThanOrEqual(
      CONFIDENCE.VERIFIED,
    );
    expect(fieldMeta.total.confidence).toBeGreaterThanOrEqual(
      CONFIDENCE.VERIFIED,
    );
    // Nothing can independently confirm the vendor with one model.
    expect(fieldMeta.vendor.confidence).toBe(CONFIDENCE.UNVERIFIED);
  });

  it("drops a field to suspect with the reason attached on bad math", () => {
    const { fieldMeta, flaggedCount } = computeConfidence({
      extraction: extraction({ total: 863 }),
      today: TODAY,
    });
    expect(fieldMeta.total.confidence).toBe(CONFIDENCE.SUSPECT);
    expect(fieldMeta.total.reasons[0]).toContain("digit swap");
    expect(flaggedCount).toBeGreaterThan(0);
  });

  it("raises to STRONG when a second model also agrees", () => {
    const { fieldMeta } = computeConfidence({
      extraction: extraction(),
      secondOpinion: extraction(),
      today: TODAY,
    });
    // Arithmetic + agreement = two independent confirmations.
    expect(fieldMeta.total.confidence).toBe(CONFIDENCE.STRONG);
    // Vendor now has exactly one confirmation (agreement).
    expect(fieldMeta.vendor.confidence).toBe(CONFIDENCE.VERIFIED);
  });

  it("suspects a field the second model read differently even when math passes for the primary", () => {
    const { fieldMeta } = computeConfidence({
      extraction: extraction(),
      secondOpinion: extraction({ vendor: "Acme Fresh Produce" }),
      today: TODAY,
    });
    expect(fieldMeta.vendor.confidence).toBe(CONFIDENCE.SUSPECT);
    expect(fieldMeta.vendor.reasons[0]).toContain("disagree");
  });

  it("scores missing fields 0 with a not-found reason, without flagging them", () => {
    const { fieldMeta, flaggedCount } = computeConfidence({
      extraction: extraction({ invoice_number: null }),
      today: TODAY,
    });
    expect(fieldMeta.invoice_number.confidence).toBe(CONFIDENCE.MISSING);
    expect(fieldMeta.invoice_number.reasons).toEqual([
      "Not found in the document",
    ]);
    expect(flaggedCount).toBe(0);
  });

  it("surfaces duplicates with the matched document id", () => {
    const { fieldMeta, matchedDuplicateId } = computeConfidence({
      extraction: extraction(),
      duplicateCandidates: [
        {
          documentId: "prior-doc",
          filename: "july-invoice.pdf",
          invoiceNumber: "INV-2041",
          vendor: "Acme Cloud Services Inc.",
          total: "836.00",
          docDate: "2026-07-28",
        },
      ],
      today: TODAY,
    });
    expect(matchedDuplicateId).toBe("prior-doc");
    expect(fieldMeta.duplicate.confidence).toBe(CONFIDENCE.SUSPECT);
    expect(fieldMeta.duplicate.reasons[0]).toContain("july-invoice.pdf");
  });
});
