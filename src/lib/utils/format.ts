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

  if (!currency) {
    // ¤ is the ISO-standard glyph for "currency unspecified" — a bare number
    // reads as an assumed default (usually USD), which is a worse guess than
    // admitting the currency wasn't found.
    const decimal = new Intl.NumberFormat(undefined, {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(amount);
    return `¤${decimal}`;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unrecognised currency code is a data problem, not a reason to crash.
    return `${currency} ${amount.toFixed(2)}`.trim();
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

/**
 * Stage durations span three orders of magnitude — a disk write is sub-
 * millisecond, a vision call is seconds — so the unit changes rather than
 * printing "0.00 sec" or "3400 ms".
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} sec`;
}

/** "PO number" from "po_number" — extra-field keys are normalized snake_case. */
export function humanizeKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "A", "A and B", or "A, B, and C" — an Oxford-comma list. */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
