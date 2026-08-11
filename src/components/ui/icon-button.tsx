import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The reference's circular icon button: a thin-stroke glyph centred in a
 * circle. Icon-only, so `label` is required — it becomes the accessible name
 * and the tooltip, and there is no way to render one without it.
 */
export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  label: string;
  /** A dot on the edge, for "there is something new here". */
  indicator?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  indicator = false,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full",
        "bg-surface text-foreground transition-colors hover:bg-surface-raised",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      {indicator && (
        <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-danger" />
      )}
    </button>
  );
}
