import { Card } from "@/components/ui/card";
import { formatAmount } from "@/lib/utils/format";
import type { LedgerRow } from "../types";

/**
 * Totals are grouped by currency and never combined. Adding USD to INR
 * produces a number that looks authoritative and means nothing — the one
 * mistake a finance user would spot instantly.
 */
function totalsByCurrency(rows: LedgerRow[]): Array<[string, number]> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.total === null) continue;
    const amount = Number(row.total);
    if (Number.isNaN(amount)) continue;
    const currency = row.currency ?? "";
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

export function LedgerSummary({ rows }: { rows: LedgerRow[] }) {
  const totals = totalsByCurrency(rows);
  const vendors = new Set(rows.map((row) => row.vendor).filter(Boolean)).size;

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Card inverse className="p-6">
        <p className="text-[13px] text-surface-inverse-foreground/60">Total accepted</p>
        <div className="mt-2 space-y-1">
          {totals.length === 0 ? (
            <p className="text-2xl font-semibold tracking-tight">—</p>
          ) : (
            totals.map(([currency, amount]) => (
              <p key={currency} className="text-2xl font-semibold tracking-tight">
                {formatAmount(String(amount), currency || null)}
              </p>
            ))
          )}
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-[13px] text-muted">Documents</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{rows.length}</p>
      </Card>

      <Card className="p-6">
        <p className="text-[13px] text-muted">Vendors</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{vendors}</p>
      </Card>
    </div>
  );
}
