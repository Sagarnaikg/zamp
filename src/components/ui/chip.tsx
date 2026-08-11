import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ChipProps {
  label: string;
  /** Renders a dismiss control; omit for a static tag. */
  onRemove?: () => void;
  /** The small filled dot used in the reference for an active filter. */
  dot?: boolean;
  className?: string;
}

/** Filter tag, as in the reference's activity manager. */
export function Chip({ label, onRemove, dot = false, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full bg-surface-raised px-3.5",
        "text-[13px] font-medium text-foreground",
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-accent" aria-hidden />}
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="-mr-1 rounded-full p-0.5 text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden />
        </button>
      )}
    </span>
  );
}
