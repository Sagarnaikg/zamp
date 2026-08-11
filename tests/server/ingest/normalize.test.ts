import { describe, expect, it } from "vitest";
import {
  canonicalKey,
  normalizeExtraFields,
  slugifyKey,
} from "@/server/ingest/normalize";

describe("slugifyKey", () => {
  it("converts printed labels to snake_case", () => {
    expect(slugifyKey("PO No.")).toBe("po_no");
    expect(slugifyKey("Due-Date ")).toBe("due_date");
    expect(slugifyKey("  Payment   Terms  ")).toBe("payment_terms");
  });
});

describe("canonicalKey", () => {
  it("maps every purchase-order variant to po_number", () => {
    for (const variant of [
      "PO No",
      "PO Number",
      "P.O. Number",
      "Purchase Order",
      "Purchase Order Number",
      "po_num",
    ]) {
      expect(canonicalKey(variant)).toBe("po_number");
    }
  });

  it("keeps distinct tax-identifier families separate", () => {
    expect(canonicalKey("GSTIN")).toBe("gstin");
    expect(canonicalKey("GST No")).toBe("gstin");
    expect(canonicalKey("VAT Number")).toBe("vat_number");
    expect(canonicalKey("Tax ID")).toBe("tax_id");
    // gstin must never collapse into vat_number or tax_id
    expect(canonicalKey("GSTIN")).not.toBe(canonicalKey("VAT Number"));
  });

  it("passes unknown keys through as slugs", () => {
    expect(canonicalKey("Warehouse Code")).toBe("warehouse_code");
  });
});

describe("normalizeExtraFields", () => {
  it("prefers the model's key but canonicalizes it through the alias table", () => {
    const result = normalizeExtraFields([
      { key: "purchase_order_number", label: "PO No.", value: "4500012345" },
    ]);
    expect(result).toEqual([
      { key: "po_number", label: "PO No.", value: "4500012345" },
    ]);
  });

  it("falls back to the label when the model omits the key", () => {
    const result = normalizeExtraFields([
      { label: "Due Date", value: "2026-09-01" },
    ]);
    expect(result[0].key).toBe("due_date");
  });

  it("drops empty values and deduplicates on canonical key", () => {
    const result = normalizeExtraFields([
      { key: "po_number", label: "PO No", value: "A-1" },
      { key: "purchase_order", label: "Purchase Order", value: "A-1" },
      { key: "notes", label: "Notes", value: "   " },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: "po_number", label: "PO No", value: "A-1" });
  });

  it("prevents the same concept from fragmenting into different keys across vendors", () => {
    // Two separate documents, two separate LLM extraction calls, two vendors
    // who print the exact same concept with different labels — this is the
    // scenario the alias table exists to solve. Without it, the ledger would
    // end up with both "po_no" and "purchase_order_number" as distinct keys,
    // and a query for one would silently miss documents using the other.
    const invoiceFromVendorX = normalizeExtraFields([
      { key: "po_no", label: "PO No:", value: "4500012" },
    ]);
    const invoiceFromVendorY = normalizeExtraFields([
      {
        key: "purchase_order_number",
        label: "Purchase Order Number:",
        value: "4500099",
      },
    ]);

    // Same canonical key on both, even though the model saw different text
    // and (plausibly) proposed a different raw key each time.
    expect(invoiceFromVendorX[0].key).toBe("po_number");
    expect(invoiceFromVendorY[0].key).toBe("po_number");

    // The original printed label is still preserved per-document for display.
    expect(invoiceFromVendorX[0].label).toBe("PO No:");
    expect(invoiceFromVendorY[0].label).toBe("Purchase Order Number:");

    // A ledger scan across both documents' extra_fields therefore reports a
    // single distinct key, not two — which is exactly what availableExtraKeys()
    // needs to be true for the query translator to find every match.
    const distinctKeysInLedger = new Set([
      ...invoiceFromVendorX.map((f) => f.key),
      ...invoiceFromVendorY.map((f) => f.key),
    ]);
    expect(distinctKeysInLedger.size).toBe(1);
  });
});
