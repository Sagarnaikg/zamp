import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The bento tile the reference is built from: generous radius, near-flat, its
 * edges defined tonally rather than by a hard border.
 */
export function Card({
  children,
  className,
  inverse = false,
}: {
  children: ReactNode;
  className?: string;
  /** The single black tile — reserve it for one focal figure per screen. */
  inverse?: boolean;
  }) {
  return (
    <div
      className={cn(
        "rounded-card p-5 shadow-card",
        inverse
          ? "bg-surface-inverse text-surface-inverse-foreground"
          : "bg-surface text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Card header in the reference's layout: a circled glyph on the left, controls
 * pushed to the right.
 */
export function CardHeader({
  icon: Icon,
  title,
  action,
}: {
  icon?: LucideIcon;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-raised text-foreground">
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
        )}
        {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
      </div>
      {action}
    </div>
  );
}

/** Label above, figure below — the reference's stat rhythm. */
export function Stat({
  label,
  value,
  prefix,
}: {
  label: string;
  value: string;
  /** Currency mark, set apart from the figure as in the reference. */
  prefix?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="flex items-baseline gap-1 text-2xl font-semibold tracking-tight">
        {prefix && <span className="text-lg font-medium text-muted">{prefix}</span>}
        {value}
      </p>
    </div>
  );
}
