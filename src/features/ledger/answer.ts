import { QueryAggregate } from "@/server/constants";
import { formatAmount } from "@/lib/utils/format";
import type { ConversationMessage } from "./types";

export interface AnswerFigure {
  text: string;
  /**
   * Money whose currency couldn't be determined, so the caller can mark it.
   * False for a count, which has no currency to be unsure about.
   */
  currencyUnknown: boolean;
}

/**
 * How an answer's headline figure is rendered.
 *
 * Two rules worth pinning: a count is a plain number and must never be dressed
 * as currency, and an aggregate with no value shows nothing rather than a
 * fabricated "$0.00" — "nothing matched" and "the total is zero" are
 * different facts.
 */
export function formatAnswerFigure(message: ConversationMessage): AnswerFigure | null {
  const { answer, rows } = message;
  if (!answer || answer.aggregateValue === null) return null;

  if (answer.aggregateKind === QueryAggregate.Count) {
    return { text: String(answer.aggregateValue), currencyUnknown: false };
  }
  // The aggregate has no currency of its own; take it from the matched rows.
  const currency = rows[0]?.currency ?? null;
  return {
    text: formatAmount(String(answer.aggregateValue), currency),
    currencyUnknown: !currency,
  };
}
