import { Info } from "lucide-react";
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
  const hasDetail = reasons.length > 0 || Boolean(hint);

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          CONFIDENCE_STYLES[level],
        )}
        // Kept as a native tooltip fallback; the icon below is the intended,
        // discoverable way to reach the same detail.
        title={reasons.length > 0 ? reasons.join(" · ") : label}
      >
        {label}
      </span>

      {/* A dedicated trigger rather than the whole pill reacting to hover —
          only this icon promises more detail, so only it should look
          interactive. Visible on hover and on focus (reachable by Tab),
          states the reason plus what to actually do about it, not just that
          something's wrong (decisions.md §8). */}
      {hasDetail && (
        <span className="group relative inline-flex">
          <button
            type="button"
            aria-label={`Why: ${label}`}
            className="inline-flex size-3.5 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Info className="size-3" strokeWidth={2} aria-hidden />
          </button>

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
        </span>
      )}
    </span>
  );
}
