import {
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

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        CONFIDENCE_STYLES[level],
      )}
      // The reasons are the trust story; keep them reachable on hover/focus.
      title={reasons.length > 0 ? reasons.join(" · ") : label}
    >
      {label}
    </span>
  );
}
