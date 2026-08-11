import { describe, expect, it } from "vitest";
import { agreementSignal } from "@/server/confidence/agreement";
import type { Extraction } from "@/server/confidence/types";
import { ExpenseCategory } from "@/server/constants";

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    vendor: "Acme Cloud Services Inc.",
    invoice_number: "INV-2041",
    doc_date: "2026-07-28",
    currency: "USD",
    subtotal: 760,
    tax: 76,
    total: 836,
    category: ExpenseCategory.Software,
    line_items: [],
    extra_fields: [],
    ...overrides,
  };
}

describe("agreementSignal", () => {
  it("confirms fields where both models agree", () => {
    const findings = agreementSignal(extraction(), extraction());
    expect(findings.filter((f) => f.kind === "suspect")).toHaveLength(0);
    expect(
      findings.filter((f) => f.kind === "confirm").map((f) => f.field),
    ).toContain("total");
  });

  it("treats formatting differences in vendor and invoice number as agreement", () => {
    const second = extraction({
      vendor: "ACME CLOUD SERVICES, INC",
      invoice_number: "INV 2041",
    });
    const findings = agreementSignal(extraction(), second);
    expect(findings.filter((f) => f.kind === "suspect")).toHaveLength(0);
  });

  it("flags a disagreement and shows both readings", () => {
    const second = extraction({ total: 863 });
    const findings = agreementSignal(extraction(), second);
    const totalFindings = findings.filter((f) => f.field === "total");
    expect(totalFindings[0].kind).toBe("suspect");
    expect(totalFindings[0].reason).toContain("836");
    expect(totalFindings[0].reason).toContain("863");
  });

  it("compares category so a misclassification is caught, not silently trusted", () => {
    const findings = agreementSignal(
      extraction(),
      extraction({ category: ExpenseCategory.Meals }),
    );
    const categoryFindings = findings.filter((f) => f.field === "category");
    expect(categoryFindings).toHaveLength(1);
    expect(categoryFindings[0].kind).toBe("suspect");
  });

  it("stays silent on fields only one model produced", () => {
    const second = extraction({ tax: null });
    const findings = agreementSignal(extraction(), second);
    expect(findings.filter((f) => f.field === "tax")).toHaveLength(0);
  });
});
