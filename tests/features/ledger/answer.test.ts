import { describe, expect, it } from "vitest";
import { formatAnswerFigure } from "@/features/ledger/answer";
import { MessageRole, QueryAggregate } from "@/server/constants";
import type { ConversationMessage, LedgerRow } from "@/features/ledger/types";

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

function answerMessage(
  aggregateKind: QueryAggregate,
  aggregateValue: number | null,
  rows: LedgerRow[] = [row()],
): ConversationMessage {
  return {
    id: crypto.randomUUID(),
    role: MessageRole.Assistant,
    content: 'sum of totals · category is "software"',
    createdAt: new Date().toISOString(),
    rows,
    answer: {
      interpretation: 'sum of totals · category is "software"',
      aggregateKind,
      aggregateValue,
      matchedDocumentIds: rows.map((r) => r.documentId),
      ignoredFilters: [],
      dsl: { filters: [], aggregate: aggregateKind },
    },
  };
}

/**
 * The headline figure is the part a user reads first and is least likely to
 * double-check, so the two ways of getting it silently wrong are pinned here.
 */
describe("formatAnswerFigure", () => {
  it("formats a money aggregate using the matched rows' currency", () => {
    expect(formatAnswerFigure(answerMessage(QueryAggregate.SumTotal, 250))?.text).toBe(
      "$250.00",
    );
  });

  it("renders a count as a plain number, never dressed as currency", () => {
    const figure = formatAnswerFigure(answerMessage(QueryAggregate.Count, 3));
    expect(figure?.text).toBe("3");
    expect(figure?.text).not.toContain("$");
    // A count has no currency to be unsure about, so it must never be marked.
    expect(figure?.currencyUnknown).toBe(false);
  });

  it("shows nothing when nothing matched, rather than a fabricated $0.00", () => {
    expect(formatAnswerFigure(answerMessage(QueryAggregate.SumTotal, null, []))).toBeNull();
  });

  it("returns nothing for a user turn, which carries no answer", () => {
    const userTurn: ConversationMessage = {
      id: crypto.randomUUID(),
      role: MessageRole.User,
      content: "how much on software?",
      answer: null,
      createdAt: new Date().toISOString(),
      rows: [],
    };
    expect(formatAnswerFigure(userTurn)).toBeNull();
  });

  it("follows the rows' own currency rather than assuming dollars", () => {
    const inr = [row({ currency: "INR", total: "500.00" })];
    const figure = formatAnswerFigure(answerMessage(QueryAggregate.SumTotal, 500, inr));
    expect(figure?.text).toContain("500");
    expect(figure?.text).not.toContain("$");
    expect(figure?.currencyUnknown).toBe(false);
  });

  /**
   * The case that reaches production: a document whose currency genuinely
   * isn't printed anywhere. The figure must stay a clean number — the caller
   * marks it — rather than carrying prose into a headline.
   */
  it("marks a money figure whose rows have no currency, without altering the number", () => {
    const noCurrency = [row({ currency: null, total: "346.80" })];
    const figure = formatAnswerFigure(
      answerMessage(QueryAggregate.SumTotal, 693.6, noCurrency),
    );
    expect(figure?.text).toBe("693.60");
    expect(figure?.currencyUnknown).toBe(true);
  });
});
