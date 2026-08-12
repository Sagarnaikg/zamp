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

export function TableRow({
  children,
  onClick,
}: {
  children: ReactNode;
  /** Makes the whole row a navigation target, not just whatever link is in it. */
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "link" : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              // Space would otherwise scroll the page instead of activating the row.
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "transition-colors",
        // Hovering only reads as an affordance when the row actually does
        // something — otherwise it's a highlight promising a click that
        // has nowhere to go.
        onClick &&
          "cursor-pointer hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  children,
  numeric = false,
  dense = false,
}: {
  children: ReactNode;
  numeric?: boolean;
  /** Tighter padding for lists that don't need the ledger's roomier density. */
  dense?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        dense ? "px-4 py-2.5" : "px-5 py-3.5",
        "font-semibold",
        numeric && "text-right",
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  numeric = false,
  dense = false,
}: {
  children: ReactNode;
  numeric?: boolean;
  dense?: boolean;
}) {
  return (
    <td
      className={cn(
        dense ? "px-4 py-2.5 text-[13px]" : "px-5 py-4",
        "text-foreground",
        // Tabular figures keep decimal points aligned down a column of money.
        numeric && "text-right tabular-nums",
      )}
    >
      {children}
    </td>
  );
}
