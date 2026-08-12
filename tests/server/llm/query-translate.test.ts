import { describe, expect, it } from "vitest";
import { describeQuery } from "@/server/llm/query-translate";
import { QueryAggregate, QueryField, QueryOperator } from "@/server/constants";
import type { QueryFilter } from "@/server/llm/query-translate";

function filter(overrides: Partial<QueryFilter>): QueryFilter {
  return { field: QueryField.Vendor, key: null, op: QueryOperator.Eq, value: "", ...overrides };
}

/**
 * This sentence is the whole trust mechanism from §5: it must describe
 * exactly the filters that ran, in words a non-technical user reads
 * correctly on the first pass — not a pipe-separated filter dump.
 */
describe("describeQuery", () => {
  it("describes an aggregate with no filters as covering everything", () => {
    expect(describeQuery(QueryAggregate.SumTotal, [])).toBe("Total across all documents");
    expect(describeQuery(QueryAggregate.None, [])).toBe("All documents");
  });

  it("phrases a vendor filter as a natural clause", () => {
    const result = describeQuery(QueryAggregate.SumTotal, [
      filter({ field: QueryField.Vendor, op: QueryOperator.Contains, value: "Acme" }),
    ]);
    expect(result).toBe("Total from Acme");
  });

  it("phrases a category filter without the raw snake_case", () => {
    const result = describeQuery(QueryAggregate.SumTotal, [
      filter({ field: QueryField.Category, value: "office_supplies" }),
    ]);
    expect(result).toBe("Total in the office supplies category");
  });

  it("phrases an amount range as over/under, not a >= symbol", () => {
    const over = describeQuery(QueryAggregate.None, [
      filter({ field: QueryField.Total, op: QueryOperator.Gte, value: "500" }),
    ]);
    expect(over).toBe("Documents over $500");

    const under = describeQuery(QueryAggregate.None, [
      filter({ field: QueryField.Total, op: QueryOperator.Lte, value: "50" }),
    ]);
    expect(under).toBe("Documents under $50");
  });

  it("collapses a full-year date range to 'in <year>' instead of two dates", () => {
    const result = describeQuery(QueryAggregate.SumTotal, [
      filter({ field: QueryField.DocDate, op: QueryOperator.Gte, value: "2026-01-01" }),
      filter({ field: QueryField.DocDate, op: QueryOperator.Lte, value: "2026-12-31" }),
    ]);
    expect(result).toBe("Total in 2026");
  });

  it("phrases a partial date range as 'between <date> and <date>'", () => {
    const result = describeQuery(QueryAggregate.None, [
      filter({ field: QueryField.DocDate, op: QueryOperator.Gte, value: "2026-03-01" }),
      filter({ field: QueryField.DocDate, op: QueryOperator.Lte, value: "2026-03-15" }),
    ]);
    expect(result).toBe("Documents between Mar 1, 2026 and Mar 15, 2026");
  });

  it("phrases a one-sided date bound as since/before", () => {
    expect(
      describeQuery(QueryAggregate.None, [
        filter({ field: QueryField.DocDate, op: QueryOperator.Gte, value: "2026-06-01" }),
      ]),
    ).toBe("Documents since Jun 1, 2026");

    expect(
      describeQuery(QueryAggregate.None, [
        filter({ field: QueryField.DocDate, op: QueryOperator.Lte, value: "2026-06-01" }),
      ]),
    ).toBe("Documents before Jun 1, 2026");
  });

  it("phrases an extra-field filter using its own key, not the word 'extra'", () => {
    const exists = describeQuery(QueryAggregate.None, [
      filter({ field: QueryField.Extra, key: "po_number", op: QueryOperator.Exists }),
    ]);
    expect(exists).toBe("Documents with po_number present");

    const eq = describeQuery(QueryAggregate.None, [
      filter({ field: QueryField.Extra, key: "po_number", op: QueryOperator.Eq, value: "PO-42" }),
    ]);
    expect(eq).toBe("Documents where po_number is PO-42");
  });

  it("joins two clauses with 'and', not a separator dot", () => {
    const result = describeQuery(QueryAggregate.None, [
      filter({ field: QueryField.Vendor, op: QueryOperator.Contains, value: "Acme" }),
      filter({ field: QueryField.Total, op: QueryOperator.Gte, value: "500" }),
    ]);
    expect(result).toBe("Documents from Acme and over $500");
    expect(result).not.toContain("·");
  });

  it("joins three or more clauses with an Oxford comma", () => {
    const result = describeQuery(QueryAggregate.None, [
      filter({ field: QueryField.Vendor, op: QueryOperator.Contains, value: "Acme" }),
      filter({ field: QueryField.Total, op: QueryOperator.Gte, value: "500" }),
      filter({ field: QueryField.Currency, value: "usd" }),
    ]);
    expect(result).toBe("Documents from Acme, over $500, and in USD");
  });
});
