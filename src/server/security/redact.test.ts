import { describe, expect, it } from "vitest";
import { redactSensitive } from "./redact";

// Publicly documented test/dummy numbers — safe to use in source and tests,
// never real cardholder data. Both pass Luhn, as any valid-looking card
// number must.
const VISA_TEST = "4111111111111111";
const AMEX_TEST = "378282246310005"; // 15 digits, Amex's own test number
const VALID_IBAN = "GB29NWBK60161331926819"; // textbook example, checksum-valid

describe("redactSensitive — card numbers", () => {
  it("masks a valid card number, keeping the last 4 digits", () => {
    const result = redactSensitive(`Paid by card ${VISA_TEST} thanks`);
    expect(result.text).toContain("•••• •••• •••• 1111");
    expect(result.text).not.toContain(VISA_TEST);
    expect(result.matches).toEqual([{ kind: "card", masked: "•••• •••• •••• 1111" }]);
  });

  it("matches cards grouped with spaces or dashes, as usually printed", () => {
    const spaced = redactSensitive("4111 1111 1111 1111");
    expect(spaced.matches).toHaveLength(1);
    const dashed = redactSensitive("4111-1111-1111-1111");
    expect(dashed.matches).toHaveLength(1);
  });

  it("handles a 15-digit Amex number", () => {
    const result = redactSensitive(AMEX_TEST);
    expect(result.matches[0].masked).toContain("0005");
  });

  it("does not touch a digit string that fails the Luhn checksum", () => {
    // One digit off from the valid test number above.
    const invalid = "4111111111111112";
    const result = redactSensitive(invalid);
    expect(result.matches).toHaveLength(0);
    expect(result.text).toBe(invalid);
  });

  it("leaves an invoice number untouched — the false-positive case that matters most", () => {
    // Short, hyphenated, doesn't reach 13 digits — nowhere near a card.
    const result = redactSensitive("Invoice INV-2041, total due");
    expect(result.matches).toHaveLength(0);
    expect(result.text).toContain("INV-2041");
  });

  it("leaves a long non-card reference number untouched", () => {
    // 16 digits, but not Luhn-valid — must not be masked just for length.
    const reference = "Reference: 1234567890123456";
    const result = redactSensitive(reference);
    expect(result.matches).toHaveLength(0);
  });

  it("masks more than one card number in the same text", () => {
    const result = redactSensitive(`${VISA_TEST} and also ${AMEX_TEST}`);
    expect(result.matches).toHaveLength(2);
  });
});

describe("redactSensitive — IBAN", () => {
  it("masks a checksum-valid IBAN, keeping first 4 and last 4", () => {
    const result = redactSensitive(`Transfer to ${VALID_IBAN} please`);
    expect(result.text).toContain("GB29");
    expect(result.text).toContain("6819");
    expect(result.text).not.toContain(VALID_IBAN);
    expect(result.matches[0].kind).toBe("iban");
  });

  it("does not touch an IBAN-shaped string with a bad checksum", () => {
    const bad = "GB00NWBK60161331926819"; // checksum digits changed
    const result = redactSensitive(bad);
    expect(result.matches).toHaveLength(0);
  });
});

describe("redactSensitive — combined and edge cases", () => {
  it("masks both a card and an IBAN appearing in the same document", () => {
    const result = redactSensitive(
      `Card ${VISA_TEST}, wire to ${VALID_IBAN}`,
    );
    const kinds = result.matches.map((m) => m.kind).sort();
    expect(kinds).toEqual(["card", "iban"]);
  });

  it("returns the input unchanged, with no matches, on ordinary invoice text", () => {
    const text = "Acme Cloud Services Inc. — Invoice NG-88361 — Total $836.00";
    const result = redactSensitive(text);
    expect(result.text).toBe(text);
    expect(result.matches).toHaveLength(0);
  });

  it("never includes the original value in a match — matches carry only the masked form", () => {
    const result = redactSensitive(VISA_TEST);
    for (const match of result.matches) {
      expect(JSON.stringify(match)).not.toContain(VISA_TEST);
    }
  });

  it("handles an empty string without throwing", () => {
    expect(() => redactSensitive("")).not.toThrow();
    expect(redactSensitive("").matches).toHaveLength(0);
  });
});
