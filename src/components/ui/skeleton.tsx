import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Placeholder matching the shape of what's loading. Preferred over a spinner
 * for lists and tables — the layout doesn't jump when real data lands.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn("animate-pulse rounded bg-surface-raised", className)}
    />
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
