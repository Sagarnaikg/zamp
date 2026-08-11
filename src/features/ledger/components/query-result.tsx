import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EMPTY_STATES } from "@/constants";
import { QueryAggregate } from "@/server/constants";
import { formatAmount } from "@/lib/utils/format";
import { LedgerTable } from "./ledger-table";
import type { QueryResponse } from "../types";

/** "sum of totals" → a formatted figure; "count of documents" → a plain number. */
function formatAggregate(result: QueryResponse): string | null {
  const { kind, value } = result.aggregate;
  if (value === null) return null;
  if (kind === QueryAggregate.Count) return String(value);
  // Sum/average carry money; pull the currency off the first matching row
  // since the aggregate itself has no currency of its own.
  const currency = result.rows[0]?.currency ?? null;
  return formatAmount(String(value), currency);
}

/**
 * The answer is always shown with the filters that actually ran (§5) — never
 * just the model's restatement of the question. That's what lets a user catch
 * a misinterpreted query instead of trusting a wrong answer.
 */
export function QueryResult({
  result,
  onClear,
}: {
  result: QueryResponse;
  /** Escape hatch back to the unfiltered ledger. */
  onClear?: ReactNode;
}) {
  const aggregateValue = formatAggregate(result);

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] text-muted">Interpreted as</p>
            <p className="mt-1.5 text-sm font-medium text-foreground">
              {result.interpretation}
            </p>
          </div>
          {onClear}
        </div>
        {aggregateValue !== null && (
          <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
            {aggregateValue}
          </p>
        )}
        {result.ignoredFilters.length > 0 && (
          <p className="mt-4 text-[13px] text-confidence-unverified">
            Couldn&apos;t apply: {result.ignoredFilters.map((f) => f.field).join(", ")}
          </p>
        )}
      </Card>

      {result.rows.length === 0 ? (
        <EmptyState
          title={EMPTY_STATES.queryResults.title}
          body={EMPTY_STATES.queryResults.body}
        />
      ) : (
        <LedgerTable rows={result.rows} />
      )}
    </div>
  );
}
