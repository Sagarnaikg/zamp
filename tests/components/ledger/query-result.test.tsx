import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryResult } from "@/features/ledger/components/query-result";
import { QueryAggregate, QueryField, QueryOperator } from "@/server/constants";
import type { LedgerRow, QueryResponse } from "@/features/ledger/types";

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

function result(overrides: Partial<QueryResponse> = {}): QueryResponse {
  return {
    question: "how much on software?",
    interpretation: 'sum of totals · category is "software"',
    dsl: { filters: [], aggregate: QueryAggregate.SumTotal },
    ignoredFilters: [],
    rows: [row()],
    aggregate: { kind: QueryAggregate.SumTotal, value: 110 },
    ...overrides,
  };
}

/**
 * The answer always shows the filters that actually ran (§5), never just the
 * model's restatement — that's what lets a user catch a misread question
 * instead of trusting a wrong number.
 */
describe("QueryResult", () => {
  it("always shows the interpretation, not just the raw answer", () => {
    render(<QueryResult result={result()} />);
    expect(screen.getByText(/category is "software"/)).toBeInTheDocument();
  });

  it("formats a money aggregate using the matching rows' currency", () => {
    render(
      <QueryResult
        result={result({ aggregate: { kind: QueryAggregate.SumTotal, value: 250 } })}
      />,
    );
    // A distinct value from the row's own total, so the assertion can only
    // pass by reading the aggregate figure, not the table underneath it.
    expect(screen.getByText("$250.00")).toBeInTheDocument();
  });

  it("renders a count aggregate as a plain number, not currency", () => {
    render(
      <QueryResult
        result={result({ aggregate: { kind: QueryAggregate.Count, value: 3 } })}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("$3.00")).toBeNull();
  });

  it("shows no figure at all when nothing matched, rather than a misleading $0.00", () => {
    render(
      <QueryResult
        result={result({
          rows: [],
          aggregate: { kind: QueryAggregate.SumTotal, value: null },
        })}
      />,
    );
    expect(screen.queryByText("$0.00")).toBeNull();
    expect(screen.getByText("No matching documents")).toBeInTheDocument();
  });

  it("surfaces filters the server couldn't apply instead of dropping them silently", () => {
    render(
      <QueryResult
        result={result({
          ignoredFilters: [
            {
              field: QueryField.DocDate,
              key: null,
              op: QueryOperator.Gte,
              value: "not-a-date",
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Couldn't apply/)).toBeInTheDocument();
  });
});
