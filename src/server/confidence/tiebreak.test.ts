import { describe, expect, it } from "vitest";
import { correctedValues, findDisputes, resolveDisputes } from "./tiebreak";
import type { Extraction } from "./types";

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    vendor: "Acme Cloud Services Inc.",
    invoice_number: "INV-2041",
    doc_date: "2026-07-28",
    currency: "USD",
    subtotal: 760,
    tax: 76,
    total: 836,
    category: "software",
    line_items: [],
    extra_fields: [],
    ...overrides,
  };
}

describe("findDisputes", () => {
  it("finds nothing when both readings agree", () => {
    expect(findDisputes(extraction(), extraction())).toEqual([]);
  });

  it("lists only the fields that actually differ", () => {
    const disputes = findDisputes(
      extraction(),
      extraction({ total: 863, vendor: "Acme Cloud Services, Inc" }),
    );
    // Vendor differs only in punctuation, so it is not a real dispute.
    expect(disputes).toEqual(["total"]);
  });

  it("ignores a field one reading left empty", () => {
    // Missing is a separate problem from conflicting — the tiebreaker
    // shouldn't spend a model call on it.
    expect(findDisputes(extraction(), extraction({ tax: null }))).toEqual([]);
  });
});

describe("resolveDisputes", () => {
  const primary = extraction();
  const second = extraction({ total: 863 });

  it("resolves in favour of the primary when the third read agrees with it", () => {
    const [resolution] = resolveDisputes(primary, second, { total: 836 }, [
      "total",
    ]);
    expect(resolution.outcome).toBe("resolved");
    expect(resolution.winner).toBe(836);
    expect(resolution.correctsPrimary).toBe(false);
    expect(resolution.finding.kind).toBe("confirm");
    expect(resolution.finding.reason).toContain("2 of 3");
  });

  it("corrects the stored value when the third read backs the second", () => {
    const [resolution] = resolveDisputes(primary, second, { total: 863 }, [
      "total",
    ]);
    expect(resolution.outcome).toBe("resolved");
    expect(resolution.winner).toBe(863);
    expect(resolution.correctsPrimary).toBe(true);
    expect(resolution.finding.reason).toContain("Corrected to");
  });

  it("escalates to a human when all three readings differ", () => {
    const [resolution] = resolveDisputes(primary, second, { total: 638 }, [
      "total",
    ]);
    expect(resolution.outcome).toBe("unresolved");
    expect(resolution.finding.kind).toBe("suspect");
    // All three candidates must be visible to whoever reviews it.
    for (const value of ["836", "863", "638"]) {
      expect(resolution.finding.reason).toContain(value);
    }
  });

  it("escalates when the focused re-read cannot find the field", () => {
    const [resolution] = resolveDisputes(primary, second, { total: null }, [
      "total",
    ]);
    expect(resolution.outcome).toBe("abstained");
    expect(resolution.finding.kind).toBe("suspect");
    expect(resolution.finding.reason).toMatch(/could not find/i);
  });

  it("matches on normalized values, not exact formatting", () => {
    const a = extraction({ vendor: "Acme Cloud Services Inc." });
    const b = extraction({ vendor: "Globex Corp" });
    const [resolution] = resolveDisputes(
      a,
      b,
      { vendor: "ACME CLOUD SERVICES, INC" },
      ["vendor"],
    );
    expect(resolution.outcome).toBe("resolved");
    expect(resolution.correctsPrimary).toBe(false);
  });

  it("resolves several disputed fields independently", () => {
    const p = extraction({ total: 836, invoice_number: "INV-2041" });
    const s = extraction({ total: 863, invoice_number: "INV-2047" });
    const resolutions = resolveDisputes(
      p,
      s,
      { total: 863, invoice_number: "INV-2041" },
      ["invoice_number", "total"],
    );
    const byField = Object.fromEntries(resolutions.map((r) => [r.field, r]));
    expect(byField.total.correctsPrimary).toBe(true);
    expect(byField.invoice_number.correctsPrimary).toBe(false);
  });
});

describe("correctedValues", () => {
  it("returns only the fields where the primary was overruled", () => {
    const p = extraction({ total: 836, invoice_number: "INV-2041" });
    const s = extraction({ total: 863, invoice_number: "INV-2047" });
    const resolutions = resolveDisputes(
      p,
      s,
      { total: 863, invoice_number: "INV-2041" },
      ["invoice_number", "total"],
    );
    expect(correctedValues(resolutions)).toEqual({ total: 863 });
  });

  it("returns nothing when no dispute overturned the primary", () => {
    const resolutions = resolveDisputes(
      extraction(),
      extraction({ total: 863 }),
      { total: 999 },
      ["total"],
    );
    expect(correctedValues(resolutions)).toEqual({});
  });
});
