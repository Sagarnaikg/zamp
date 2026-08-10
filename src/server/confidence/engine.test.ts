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
    extra_fields: [],
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

  it("reports disputed fields so the tiebreaker knows what to re-read", () => {
    const { disputedFields } = computeConfidence({
      extraction: extraction(),
      secondOpinion: extraction({ total: 863 }),
      today: TODAY,
    });
    expect(disputedFields).toEqual(["total"]);
  });

  it("clears the flag when a focused re-read settles the dispute", () => {
    const disputed = {
      extraction: extraction(),
      secondOpinion: extraction({ vendor: "Globex Corp" }),
      today: TODAY,
    };
    // Without a tiebreaker the field is suspect and needs a human.
    expect(computeConfidence(disputed).fieldMeta.vendor.confidence).toBe(
      CONFIDENCE.SUSPECT,
    );

    // With one that backs the primary, it resolves without human attention.
    const settled = computeConfidence({
      ...disputed,
      tiebreak: { vendor: "Acme Cloud Services Inc." },
    });
    expect(settled.fieldMeta.vendor.confidence).toBeGreaterThanOrEqual(
      CONFIDENCE.VERIFIED,
    );
    expect(settled.fieldMeta.vendor.reasons[0]).toContain("2 of 3");
    expect(settled.corrections).toEqual({});
  });

  it("corrects the value and says so when the primary reading loses the vote", () => {
    const result = computeConfidence({
      extraction: extraction(),
      secondOpinion: extraction({ total: 863 }),
      tiebreak: { total: 863 },
      today: TODAY,
    });
    expect(result.corrections).toEqual({ total: 863 });
    // Silently rewriting a value would defeat the point — the user is told.
    expect(result.fieldMeta.total.reasons.join(" ")).toContain("Corrected to");
  });

  it("re-validates a corrected value instead of trusting the vote blindly", () => {
    // Majority voting can install a value that fails validation: two of three
    // readings preferring a future date doesn't make it a real invoice date.
    // Validation must judge what we're about to store, not what we discarded.
    const result = computeConfidence({
      extraction: extraction({ doc_date: "2026-03-09" }),
      secondOpinion: extraction({ doc_date: "2027-09-03" }),
      tiebreak: { doc_date: "2027-09-03" },
      today: TODAY,
    });
    expect(result.corrections).toEqual({ doc_date: "2027-09-03" });
    expect(result.fieldMeta.doc_date.confidence).toBe(CONFIDENCE.SUSPECT);
    const reasons = result.fieldMeta.doc_date.reasons.join(" ");
    expect(reasons).toContain("future");
    // The user needs both halves: it was changed, and the change looks wrong.
    expect(reasons).toContain("Corrected to");
  });

  it("re-checks arithmetic against corrected amounts", () => {
    // Primary's total is consistent; the correction breaks the sum, so the
    // arithmetic signal has to notice.
    const result = computeConfidence({
      extraction: extraction(),
      secondOpinion: extraction({ total: 999 }),
      tiebreak: { total: 999 },
      today: TODAY,
    });
    expect(result.corrections).toEqual({ total: 999 });
    expect(result.fieldMeta.total.confidence).toBe(CONFIDENCE.SUSPECT);
    expect(result.fieldMeta.total.reasons.join(" ")).toMatch(/836|total reads/i);
  });

  it("keeps the field flagged when three readings disagree", () => {
    const result = computeConfidence({
      extraction: extraction(),
      secondOpinion: extraction({ total: 863 }),
      tiebreak: { total: 638 },
      today: TODAY,
    });
    expect(result.fieldMeta.total.confidence).toBe(CONFIDENCE.SUSPECT);
    expect(result.corrections).toEqual({});
    expect(result.flaggedCount).toBeGreaterThan(0);
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
