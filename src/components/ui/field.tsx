import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  /** Shown under the input when there's no error — units, format hints. */
  hint?: string;
  /** Rendered beside the label; the confidence badge lives here in review. */
  annotation?: ReactNode;
  /** Marks the field visually and for assistive tech. */
  required?: boolean;
}

/**
 * A labelled input with its error wired up for assistive tech. Every form
 * control goes through this so `aria-describedby`/`aria-invalid` can't be
 * forgotten at an individual call site.
 */
export function Field({
  label,
  error,
  hint,
  annotation,
  required,
  className,
  ...props
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
        {annotation}
      </div>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 rounded-control border bg-surface px-4 text-sm text-foreground",
          "placeholder:text-subtle transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "disabled:bg-surface-raised disabled:text-muted",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
