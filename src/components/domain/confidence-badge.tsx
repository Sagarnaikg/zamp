import {
  CONFIDENCE_HINTS,
  CONFIDENCE_LABELS,
  CONFIDENCE_STYLES,
  confidenceLevelOf,
} from "@/constants";
import { cn } from "@/lib/utils/cn";

/**
 * Domain components sit between the design system and features: reused
 * across screens, but meaningless outside this product.
 *
 * The badge never shows a bare number. "0.7" tells a finance user nothing;
 * "Unverified — nothing independently confirms this" tells them whether to
 * look (decisions.md §8).
 */
export interface ConfidenceBadgeProps {
  score: number;
  reasons?: string[];
}

export function ConfidenceBadge({ score, reasons = [] }: ConfidenceBadgeProps) {
  const level = confidenceLevelOf(score);
  const label = CONFIDENCE_LABELS[level];
  const hint = CONFIDENCE_HINTS[level];

  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        className={cn(
          "inline-flex cursor-help items-center rounded-full px-2 py-0.5 text-xs font-medium",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          CONFIDENCE_STYLES[level],
        )}
        // The reasons are the trust story; kept as a native tooltip too, as a
        // fallback for anything that doesn't render the panel below.
        title={reasons.length > 0 ? reasons.join(" · ") : label}
      >
        {label}
      </span>

      {/* Same content, made discoverable: a native title tooltip needs a
          mouse and a wait — this shows on focus too, so it's reachable by
          keyboard, and states the reason plus what to actually do about it,
          not just that something's wrong (decisions.md §8). */}
      {(reasons.length > 0 || hint) && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-56 -translate-x-1/2",
            "rounded-panel bg-surface-inverse px-3 py-2 text-[12px] leading-snug text-surface-inverse-foreground shadow-shell",
            "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          {reasons.length > 0 && <span className="block">{reasons.join(" · ")}</span>}
          {hint && (
            <span
              className={cn(
                "block",
                reasons.length > 0 && "mt-1 text-surface-inverse-foreground/70",
              )}
            >
              {hint}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
