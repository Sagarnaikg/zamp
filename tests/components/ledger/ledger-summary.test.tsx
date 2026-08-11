import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerSummary } from "@/features/ledger/components/ledger-summary";
import type { LedgerRow } from "@/features/ledger/types";

function row(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    documentId: crypto.randomUUID(),
    filename: "invoice.pdf",
    vendor: "Acme Cloud Services Inc.",
    invoiceNumber: "INV-1",
    docDate: "2026-07-28",
    currency: "USD",
    subtotal: "100.00",
    tax: "10.00",
    total: "110.00",
    category: "software",
    extraFields: [],
    ...overrides,
  };
}

/**
 * The summary card is the first thing a finance user reads, so its one hard
 * rule is pinned here: never combine currencies into a single number. Adding
 * USD to INR produces a figure that looks authoritative and means nothing —
 * exactly the kind of silent wrong answer this product exists to prevent.
 */
describe("LedgerSummary", () => {
  it("sums a single currency into one figure", () => {
    render(<LedgerSummary rows={[row({ total: "100.00" }), row({ total: "50.00" })]} />);
    expect(screen.getByText("$150.00")).toBeInTheDocument();
  });

  it("never combines two currencies into one total", () => {
    render(
      <LedgerSummary
        rows={[
          row({ total: "100.00", currency: "USD" }),
          row({ total: "500.00", currency: "INR" }),
        ]}
      />,
    );
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    // The wrong-answer case: adding the two raw numbers together.
    expect(screen.queryByText("$600.00")).toBeNull();
    expect(screen.queryByText(/600\.00/)).toBeNull();
  });

  it("ignores rows with no total rather than treating them as zero", () => {
    render(<LedgerSummary rows={[row({ total: "100.00" }), row({ total: null })]} />);
    expect(screen.getByText("$100.00")).toBeInTheDocument();
  });

  it("counts distinct vendors, not rows", () => {
    render(
      <LedgerSummary
        rows={[row({ vendor: "Acme" }), row({ vendor: "Acme" }), row({ vendor: "Globex" })]}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows a dash rather than a fabricated total when nothing has a value", () => {
    render(<LedgerSummary rows={[row({ total: null })]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
