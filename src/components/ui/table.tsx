import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Semantic table primitives. A real `<table>` rather than a grid of divs so
 * screen readers announce row and column relationships for free — this is
 * the ledger's main surface, and it's dense numeric data.
 */

export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full border-collapse text-sm">
        {/* Named for assistive tech; visually redundant next to the heading. */}
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-surface-raised">{children}</tr>;
}

export function TableHeaderCell({
  children,
  numeric = false,
}: {
  children: ReactNode;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn("px-5 py-3.5 font-semibold", numeric && "text-right")}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  numeric = false,
}: {
  children: ReactNode;
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-5 py-4 text-foreground",
        // Tabular figures keep decimal points aligned down a column of money.
        numeric && "text-right tabular-nums",
      )}
    >
      {children}
    </td>
  );
}
