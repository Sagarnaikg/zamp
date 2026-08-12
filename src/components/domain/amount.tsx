import { formatAmount } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * A money figure, plus an honest marker when the currency isn't known.
 *
 * A bare number reads as an assumed default (usually dollars), which is
 * exactly the kind of quietly-wrong impression this product exists to avoid —
 * but saying so inline ("693.60 (currency unknown)") turns a headline figure
 * into a sentence.
 *
 * The marker therefore sits *under* the number rather than beside it. Beside
 * it, the marker joins the same line and the number stops sharing a right
 * edge with the other rows of a totals column — alignment is most of what
 * makes a column of figures readable. Stacked, every number stays aligned and
 * the caveat is still right there.
 *
 * Colour is inherited and dimmed with opacity rather than a fixed token, so
 * this works on the inverse (dark) summary card and on normal surfaces with
 * no variant. Alignment is inherited too: the stack fills its container, so
 * a right-aligned cell right-aligns both lines and a left-aligned card
 * left-aligns them.
 */
export const UNKNOWN_CURRENCY_HINT =
  "No currency was found on this document — open it to set one.";

/** The marker on its own, for figures that format their own text. */
export function UnknownCurrencyNote() {
  return (
    <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide leading-tight opacity-55">
      no currency
    </span>
  );
}

export interface AmountProps {
  value: string | null;
  currency: string | null;
  className?: string;
}

export function Amount({ value, currency, className }: AmountProps) {
  const text = formatAmount(value, currency);
  const hasFigure = value !== null && value !== "" && !Number.isNaN(Number(value));

  if (currency || !hasFigure) return <>{text}</>;

  return (
    <span
      title={UNKNOWN_CURRENCY_HINT}
      className={cn("inline-flex flex-col", className)}
    >
      <span>{text}</span>
      <UnknownCurrencyNote />
    </span>
  );
}
