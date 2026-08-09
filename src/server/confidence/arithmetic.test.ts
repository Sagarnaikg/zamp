import { describe, expect, it } from "vitest";
import { arithmeticSignal } from "./arithmetic";
import type { Extraction } from "./types";

function invoice(overrides: Partial<Extraction> = {}): Extraction {
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

const suspects = (fs: ReturnType<typeof arithmeticSignal>) =>
  fs.filter((f) => f.kind === "suspect");
const confirmsFor = (fs: ReturnType<typeof arithmeticSignal>, field: string) =>
  fs.filter((f) => f.field === field && f.kind === "confirm");

describe("arithmeticSignal", () => {
  it("confirms subtotal, tax, total and line items on a clean invoice", () => {
    const findings = arithmeticSignal(invoice());
    expect(suspects(findings)).toHaveLength(0);
    expect(confirmsFor(findings, "subtotal").length).toBeGreaterThan(0);
    expect(confirmsFor(findings, "total").length).toBeGreaterThan(0);
    expect(confirmsFor(findings, "tax").length).toBeGreaterThan(0);
    expect(confirmsFor(findings, "line_items").length).toBeGreaterThan(0);
  });

  it("tolerates 1–2 cents of rounding drift", () => {
    const findings = arithmeticSignal(
      invoice({ subtotal: 760.01, total: 836.01 }),
    );
    expect(suspects(findings)).toHaveLength(0);
  });

  it("flags the total when subtotal + tax does not reach it, naming both numbers", () => {
    const findings = arithmeticSignal(invoice({ total: 863 })); // digit swap of 836
    const totalSuspects = suspects(findings).filter((f) => f.field === "total");
    expect(totalSuspects).toHaveLength(1);
    expect(totalSuspects[0].reason).toContain("836.00");
    expect(totalSuspects[0].reason).toContain("863.00");
    expect(totalSuspects[0].reason).toContain("digit swap");
  });

  it("blames the subtotal specifically when line items agree with the total", () => {
    // Items sum 760; subtotal misread as 706; 760 + 76 = 836 = total.
    const findings = arithmeticSignal(invoice({ subtotal: 706 }));
    const subtotalSuspects = suspects(findings).filter(
      (f) => f.field === "subtotal",
    );
    expect(subtotalSuspects).toHaveLength(1);
    expect(subtotalSuspects[0].reason).toContain("consistent with the total");
    // Total itself should not carry a confirm in this state, but the blame
    // must not land on line_items.
    expect(
      suspects(findings).filter((f) => f.field === "line_items"),
    ).toHaveLength(0);
  });

  it("flags a line whose qty × unit price disagrees with its amount", () => {
    const findings = arithmeticSignal(
      invoice({
        line_items: [
          { description: "Widgets", quantity: 3, unit_price: 10, amount: 35 },
        ],
        subtotal: null,
        tax: null,
        total: null,
      }),
    );
    const lineSuspects = suspects(findings).filter(
      (f) => f.field === "line_items",
    );
    expect(lineSuspects).toHaveLength(1);
    expect(lineSuspects[0].reason).toContain("Widgets");
    expect(lineSuspects[0].reason).toContain("30.00");
    expect(lineSuspects[0].reason).toContain("35.00");
  });

  it("flags both subtotal and line items when they disagree and the total decides nothing", () => {
    // The document's own math may genuinely be wrong (decisions.md §8) —
    // items sum 760 but subtotal reads 700, and total follows the subtotal.
    const findings = arithmeticSignal(invoice({ subtotal: 700, total: 776 }));
    expect(
      suspects(findings).filter((f) => f.field === "subtotal"),
    ).toHaveLength(1);
    expect(
      suspects(findings).filter((f) => f.field === "line_items"),
    ).toHaveLength(1);
  });

  it("produces no findings when the document has no checkable amounts", () => {
    const findings = arithmeticSignal(
      invoice({ subtotal: null, tax: null, total: 42, line_items: [] }),
    );
    expect(findings).toHaveLength(0);
  });

  it("verifies total against subtotal alone when no tax is printed", () => {
    const findings = arithmeticSignal(
      invoice({ tax: null, total: 760, line_items: [] }),
    );
    expect(suspects(findings)).toHaveLength(0);
    expect(confirmsFor(findings, "total").length).toBeGreaterThan(0);
  });
});
