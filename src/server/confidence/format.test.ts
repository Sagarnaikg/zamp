import { describe, expect, it } from "vitest";
import { formatSignal } from "./format";
import type { Extraction } from "./types";

const TODAY = new Date("2026-08-10T00:00:00Z");

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    vendor: "Acme",
    invoice_number: "INV-1",
    doc_date: "2026-07-28",
    currency: "USD",
    subtotal: 100,
    tax: 10,
    total: 110,
    category: "software",
    line_items: [],
    ...overrides,
  };
}

const forField = (fs: ReturnType<typeof formatSignal>, field: string) =>
  fs.filter((f) => f.field === field);

describe("formatSignal", () => {
  it("confirms a plausible date and known currency", () => {
    const findings = formatSignal(extraction(), TODAY);
    expect(forField(findings, "doc_date")).toEqual([
      { field: "doc_date", kind: "confirm" },
    ]);
    expect(forField(findings, "currency")).toEqual([
      { field: "currency", kind: "confirm" },
    ]);
  });

  it("flags a future date", () => {
    const findings = formatSignal(extraction({ doc_date: "2027-01-15" }), TODAY);
    const dateFindings = forField(findings, "doc_date");
    expect(dateFindings[0].kind).toBe("suspect");
    expect(dateFindings[0].reason).toContain("future");
  });

  it("flags an implausibly old date", () => {
    const findings = formatSignal(extraction({ doc_date: "1999-01-15" }), TODAY);
    expect(forField(findings, "doc_date")[0].kind).toBe("suspect");
  });

  it("flags a malformed date string", () => {
    const findings = formatSignal(extraction({ doc_date: "2026-13-45" }), TODAY);
    const dateFindings = forField(findings, "doc_date");
    expect(dateFindings[0].kind).toBe("suspect");
    expect(dateFindings[0].reason).toContain("2026-13-45");
  });

  it("flags an unknown currency code", () => {
    const findings = formatSignal(extraction({ currency: "US DOLLARS" }), TODAY);
    expect(forField(findings, "currency")[0].kind).toBe("suspect");
  });

  it("accepts lowercase ISO codes", () => {
    const findings = formatSignal(extraction({ currency: "inr" }), TODAY);
    expect(forField(findings, "currency")[0].kind).toBe("confirm");
  });

  it("flags negative amounts", () => {
    const findings = formatSignal(extraction({ total: -110 }), TODAY);
    expect(forField(findings, "total")[0].kind).toBe("suspect");
  });

  it("flags tax larger than subtotal", () => {
    const findings = formatSignal(extraction({ tax: 150 }), TODAY);
    const taxFindings = forField(findings, "tax");
    expect(taxFindings[0].kind).toBe("suspect");
    expect(taxFindings[0].reason).toContain("larger than the subtotal");
  });

  it("marks null fields as missing rather than suspect", () => {
    const findings = formatSignal(
      extraction({ invoice_number: null, tax: null }),
      TODAY,
    );
    expect(forField(findings, "invoice_number")).toEqual([
      {
        field: "invoice_number",
        kind: "missing",
        reason: "Not found in the document",
      },
    ]);
    expect(forField(findings, "tax")[0].kind).toBe("missing");
  });
});
