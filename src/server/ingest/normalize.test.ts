import { describe, expect, it } from "vitest";
import {
  canonicalKey,
  normalizeExtraFields,
  slugifyKey,
} from "./normalize";

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
});
