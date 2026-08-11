import { useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectPillProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "id"> {
  /** Visually hidden when `showLabel` is false, but always present for a11y. */
  label: string;
  options: SelectOption[];
  showLabel?: boolean;
}

/**
 * The reference's "Weekly ▾" pill. A real `<select>` underneath a styled
 * shell: native keyboard behaviour, native mobile pickers, and no custom
 * listbox to get wrong — the chevron is decorative.
 */
export function SelectPill({
  label,
  options,
  showLabel = false,
  className,
  ...props
}: SelectPillProps) {
  const id = useId();

  return (
    <div className="inline-flex items-center gap-2">
      <label
        htmlFor={id}
        className={cn("text-[13px] text-muted", !showLabel && "sr-only")}
      >
        {label}
      </label>
      <div className="relative inline-flex items-center">
        <select
          id={id}
          className={cn(
            "h-9 appearance-none rounded-full bg-surface-raised pl-4 pr-9",
            "text-[13px] font-medium text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 size-3.5 text-muted"
          strokeWidth={2}
          aria-hidden
        />
      </div>
    </div>
  );
}
