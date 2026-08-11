import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ButtonSize, ButtonVariant } from "@/constants";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./spinner";

/**
 * Fully-rounded pill, per the reference. Emphasis is carried by fill weight
 * — solid near-black, light grey, or bare — never by hue.
 */
const VARIANT_STYLES: Record<ButtonVariant, string> = {
  [ButtonVariant.Primary]:
    "bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-40",
  [ButtonVariant.Secondary]:
    "bg-surface-raised text-foreground hover:bg-surface-sunken disabled:opacity-40",
  [ButtonVariant.Ghost]:
    "text-muted hover:bg-surface-raised hover:text-foreground disabled:opacity-40",
  [ButtonVariant.Danger]:
    "bg-danger text-danger-foreground hover:opacity-90 disabled:opacity-40",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  [ButtonSize.Small]: "h-9 px-4 text-[13px] gap-1.5",
  [ButtonSize.Medium]: "h-11 px-6 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = ButtonVariant.Primary,
  size = ButtonSize.Medium,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-accent disabled:cursor-not-allowed",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
