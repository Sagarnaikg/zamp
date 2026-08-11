import { cn } from "@/lib/utils/cn";

export interface SpinnerProps {
  className?: string;
  /** Announced to screen readers; omit when a parent already labels the wait. */
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "inline-block size-5 shrink-0 animate-spin rounded-full",
        "border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
