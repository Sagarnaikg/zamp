/**
 * Sensitive-data redaction (decisions.md §24).
 *
 * Scoped deliberately narrow: credit/debit card numbers (Luhn-validated)
 * and IBANs (format + checksum validated). Both have a real checksum to
 * validate against, which keeps false positives low. A generic "bank
 * account number" pattern was considered and rejected — with no checksum
 * to check, it would misfire on invoice numbers and PO numbers, which is a
 * worse bug than the one this exists to fix.
 *
 * Two integration points, because they cover different failure modes:
 *  - Before the text-layer of a digital PDF is sent to an LLM, so card
 *    numbers don't leave our server in the first place.
 *  - After extraction, on every string value (works for the vision path
 *    too, where we can't redact pixels before the model reads them).
 */

export type SensitiveKind = "card" | "iban";

export interface RedactionMatch {
  kind: SensitiveKind;
  /** Masked form, safe to display — e.g. "•••• •••• •••• 4417". */
  masked: string;
}

export interface RedactionResult {
  text: string;
  /** What was found and masked, without the original values — safe to log. */
  matches: RedactionMatch[];
}

// 13–19 digits, optionally grouped with spaces or dashes — the full range
// of card number lengths in use (Amex 15, most cards 16, some debit 13/19).
const CARD_CANDIDATE = /\b(?:\d[ -]?){13,19}\b/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function maskCard(digits: string): string {
  const last4 = digits.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

// ISO 13616: 2-letter country + 2 check digits + up to 30 alphanumeric.
const IBAN_CANDIDATE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;

/** ISO 7064 mod-97-10 checksum, the standard IBAN validity check. */
function ibanValid(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }
  return remainder === 1;
}

function maskIban(iban: string): string {
  return `${iban.slice(0, 4)}${"•".repeat(Math.max(0, iban.length - 8))}${iban.slice(-4)}`;
}

/**
 * Find and mask sensitive values in a string. Safe to call on arbitrary
 * text — invoice numbers, PO numbers, and phone numbers don't pass Luhn or
 * the IBAN checksum, so they pass through untouched.
 */
export function redactSensitive(text: string): RedactionResult {
  const matches: RedactionMatch[] = [];
  let result = text;

  result = result.replace(CARD_CANDIDATE, (candidate) => {
    const digits = candidate.replace(/[ -]/g, "");
    if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) {
      return candidate;
    }
    const masked = maskCard(digits);
    matches.push({ kind: "card", masked });
    return masked;
  });

  result = result.replace(IBAN_CANDIDATE, (candidate) => {
    if (!ibanValid(candidate)) return candidate;
    const masked = maskIban(candidate);
    matches.push({ kind: "iban", masked });
    return masked;
  });

  return { text: result, matches };
}
