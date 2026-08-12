import { QueryAggregate } from "@/server/constants";
import { formatAmount } from "@/lib/utils/format";
import type { ConversationMessage } from "./types";

/**
 * How an answer's headline figure is rendered.
 *
 * Two rules worth pinning: a count is a plain number and must never be dressed
 * as currency, and an aggregate with no value shows nothing rather than a
 * fabricated "$0.00" — "nothing matched" and "the total is zero" are
 * different facts.
 */
export function formatAnswerFigure(message: ConversationMessage): string | null {
  const { answer, rows } = message;
  if (!answer || answer.aggregateValue === null) return null;

  if (answer.aggregateKind === QueryAggregate.Count) {
    return String(answer.aggregateValue);
  }
  // The aggregate has no currency of its own; take it from the matched rows.
  return formatAmount(String(answer.aggregateValue), rows[0]?.currency ?? null);
}
