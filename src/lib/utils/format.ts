/** Display formatting. Values arrive as strings from the DB's numeric columns. */

const EM_DASH = "—";

/**
 * Money is formatted for reading, never for recomputation — the stored string
 * stays authoritative. A missing value renders as a dash rather than "0.00",
 * because "we didn't find this" and "this is zero" are different facts.
 */
export function formatAmount(value: string | null, currency: string | null): string {
  if (value === null || value === "") return EM_DASH;
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;

  try {
    return new Intl.NumberFormat(undefined, {
      style: currency ? "currency" : "decimal",
      currency: currency ?? undefined,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unrecognised currency code is a data problem, not a reason to crash.
    return `${currency ?? ""} ${amount.toFixed(2)}`.trim();
  }
}

export function formatDate(value: string | null): string {
  if (!value) return EM_DASH;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

export function formatText(value: string | null): string {
  return value && value.trim() !== "" ? value : EM_DASH;
}

/** "PO number" from "po_number" — extra-field keys are normalized snake_case. */
export function humanizeKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
