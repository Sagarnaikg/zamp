import { describe, expect, it } from "vitest";
import { needsSecondReading } from "@/server/confidence/policy";
import { computeConfidence } from "@/server/confidence/engine";
import { CONFIDENCE, ExpenseCategory, ExtractionField, FileKind } from "@/server/constants";
import type { Extraction } from "@/server/confidence/types";

/**
 * The second reading is the single most expensive step in ingestion, and
 * skipping it is only defensible when cheaper evidence already covers the
 * same ground. These tests pin exactly when that holds — a regression here
 * would quietly trade correctness for cost.
 */

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    vendor: "Acme Cloud Services Inc.",
    invoice_number: "INV-2041",
    doc_date: "2026-07-28",
    currency: "USD",
    subtotal: 760,
    tax: 76,
    total: 836,
    category: ExpenseCategory.Software,
    line_items: [
      { description: "Hosting", quantity: 1, unit_price: 420, amount: 420 },
      { description: "Storage", quantity: 2, unit_price: 95, amount: 190 },
      { description: "Support", quantity: 1, unit_price: 150, amount: 150 },
    ],
    extra_fields: [],
    ...overrides,
  };
}

const TODAY = new Date("2026-08-10T00:00:00Z");
const firstPass = (e: Extraction) => computeConfidence({ extraction: e, today: TODAY });

describe("needsSecondReading", () => {
  it("skips the second call on a clean digital PDF whose math reconciles", () => {
    // The text layer is exact characters and the document proves its own
    // numbers — a second opinion adds cost, not evidence.
    expect(needsSecondReading(FileKind.DigitalPdf, firstPass(extraction()))).toBe(false);
  });

  it("always reads a photo twice, however clean it looks", () => {
    // Vision misreads are the dominant error mode; arithmetic passing only
    // means the misread digits happened to be self-consistent.
    expect(needsSecondReading(FileKind.Image, firstPass(extraction()))).toBe(true);
    expect(needsSecondReading(FileKind.ScannedPdf, firstPass(extraction()))).toBe(true);
  });

  it("reads twice when a digital PDF's arithmetic does not reconcile", () => {
    const broken = extraction({ total: 863 });
    expect(needsSecondReading(FileKind.DigitalPdf, firstPass(broken))).toBe(true);
  });

  it("reads twice when a validation rule flags anything", () => {
    const futureDated = extraction({ doc_date: "2027-01-01" });
    expect(needsSecondReading(FileKind.DigitalPdf, firstPass(futureDated))).toBe(true);
  });

  it("reads twice when amounts are missing and nothing can be corroborated", () => {
    const noTotals = extraction({ subtotal: null, tax: null, total: null, line_items: [] });
    expect(needsSecondReading(FileKind.DigitalPdf, firstPass(noTotals))).toBe(true);
  });

  it("reads twice when a duplicate was detected", () => {
    const withDuplicate = computeConfidence({
      extraction: extraction(),
      today: TODAY,
      duplicateCandidates: [
        {
          documentId: "prior",
          filename: "earlier.pdf",
          invoiceNumber: "INV-2041",
          vendor: "Acme Cloud Services Inc.",
          total: "836.00",
          docDate: "2026-07-28",
        },
      ],
    });
    expect(needsSecondReading(FileKind.DigitalPdf, withDuplicate)).toBe(true);
  });

  it("leaves skipped documents unflagged, so cost savings never create review work", () => {
    const result = firstPass(extraction());
    expect(needsSecondReading(FileKind.DigitalPdf, result)).toBe(false);
    expect(result.flaggedCount).toBe(0);
    // Money fields stay corroborated by arithmetic even without a second read.
    for (const field of [ExtractionField.Subtotal, ExtractionField.Tax, ExtractionField.Total]) {
      expect(result.fieldMeta[field]!.confidence).toBeGreaterThanOrEqual(
        CONFIDENCE.verified,
      );
    }
  });
});
