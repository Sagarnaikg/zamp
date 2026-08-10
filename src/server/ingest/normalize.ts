import type { ExtraField } from "@/server/db/schema";

/**
 * Canonicalizes extra-field keys so the same concept gets the same key
 * regardless of how a vendor labels it ("PO No" / "Purchase Order Number"
 * → po_number). Two layers: the LLM proposes a snake_case key (good at
 * semantics), then this deterministic alias table settles spelling variants
 * (good at consistency). The printed label is preserved for display.
 */

/** Variant → canonical key. Only genuinely-same concepts are merged. */
const ALIASES: Record<string, string> = {
  // Purchase order
  po: "po_number",
  po_no: "po_number",
  po_num: "po_number",
  po_number: "po_number",
  p_o_number: "po_number",
  purchase_order: "po_number",
  purchase_order_no: "po_number",
  purchase_order_number: "po_number",
  // Due date
  due_date: "due_date",
  date_due: "due_date",
  due_on: "due_date",
  payment_due: "due_date",
  payment_due_date: "due_date",
  // Payment terms
  terms: "payment_terms",
  payment_term: "payment_terms",
  payment_terms: "payment_terms",
  terms_of_payment: "payment_terms",
  // Tax identifiers — GSTIN / VAT / generic tax id are distinct concepts,
  // so variants map within each family but families are never merged.
  tax_id: "tax_id",
  tin: "tax_id",
  taxpayer_id: "tax_id",
  gst: "gstin",
  gstin: "gstin",
  gst_no: "gstin",
  gst_number: "gstin",
  vat_no: "vat_number",
  vat_id: "vat_number",
  vat_number: "vat_number",
  vat_reg_no: "vat_number",
  // Addresses
  bill_to: "bill_to",
  billed_to: "bill_to",
  billing_address: "bill_to",
  bill_to_address: "bill_to",
  ship_to: "ship_to",
  shipped_to: "ship_to",
  shipping_address: "ship_to",
  delivery_address: "ship_to",
  // References
  ref: "reference_number",
  ref_no: "reference_number",
  ref_number: "reference_number",
  reference: "reference_number",
  reference_no: "reference_number",
  reference_number: "reference_number",
  // Orders / accounts
  order_no: "order_number",
  order_id: "order_number",
  order_num: "order_number",
  order_number: "order_number",
  account_no: "account_number",
  acct_no: "account_number",
  acc_no: "account_number",
  account_number: "account_number",
};

/** Lowercase snake_case slug: "P.O. #" → "p_o", "Due-Date " → "due_date". */
export function slugifyKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function canonicalKey(rawKeyOrLabel: string): string {
  const slug = slugifyKey(rawKeyOrLabel);
  return ALIASES[slug] ?? slug;
}

export interface RawExtraField {
  key?: string | null;
  label: string;
  value: string;
}

/**
 * Normalize model output: canonical key per entry (from the model's key
 * when given, else the printed label), drop empties, first entry wins on
 * key collisions.
 */
export function normalizeExtraFields(raw: RawExtraField[]): ExtraField[] {
  const seen = new Set<string>();
  const result: ExtraField[] = [];
  for (const field of raw) {
    const value = field.value?.trim();
    if (!value) continue;
    const source = field.key?.trim() || field.label;
    const key = canonicalKey(source);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ key, label: field.label.trim(), value });
  }
  return result;
}
