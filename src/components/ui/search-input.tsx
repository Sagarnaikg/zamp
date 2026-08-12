import { useId, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  label: string;
}

/**
 * Search field with the reference's circled glyph sitting inside the pill.
 * `type="search"` so browsers offer clear-and-escape behaviour for free.
 */
export function SearchInput({ label, className, ...props }: SearchInputProps) {
  const id = useId();

  return (
    <div className="relative flex w-full items-center">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span
        className="pointer-events-none absolute left-1 inline-flex size-7 items-center justify-center rounded-full bg-surface-raised text-muted"
        aria-hidden
      >
        <Search className="size-3.5" strokeWidth={1.75} />
      </span>
      <input
        id={id}
        type="search"
        className={cn(
          "h-9 w-full rounded-full bg-surface pl-9 pr-3.5 text-[13px] text-foreground",
          "placeholder:text-subtle",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          className,
        )}
        {...props}
      />
    </div>
  );
}
