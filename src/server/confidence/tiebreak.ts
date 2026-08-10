import { type Extraction, type Finding } from "./types";
import {
  COMPARABLE_FIELDS,
  type ComparableField,
  displayValue,
  valuesMatch,
} from "./compare";

/**
 * Targeted re-extraction tiebreaker (decisions.md §20).
 *
 * When two readings disagree on a field, ask a third time — focused on just
 * the disputed fields — before spending a human's attention. The third read
 * is deliberately *blind*: it is never shown the two candidate values, so it
 * can't be anchored into rubber-stamping one. Majority then decides:
 * 2-of-3 resolves the field, 3 different answers means it is genuinely
 * ambiguous and a person should look.
 */

export type DisputeOutcome =
  | "resolved" // tiebreaker matched one of the two candidates
  | "unresolved" // three different readings
  | "abstained"; // tiebreaker produced nothing for this field

export interface DisputeResolution {
  field: ComparableField;
  outcome: DisputeOutcome;
  /** The value majority voting settled on, when resolved. */
  winner: unknown;
  /** True when the winner came from the second reading, not the primary. */
  correctsPrimary: boolean;
  finding: Finding;
}

/** Fields where the two readings produced different values. */
export function findDisputes(
  primary: Extraction,
  second: Extraction,
): ComparableField[] {
  return COMPARABLE_FIELDS.filter(
    (field) => valuesMatch(field, primary[field], second[field]) === false,
  );
}

/**
 * Resolve disputed fields by majority vote across the three readings.
 * Returns one resolution per disputed field.
 */
export function resolveDisputes(
  primary: Extraction,
  second: Extraction,
  tiebreak: Partial<Extraction>,
  disputes: ComparableField[],
): DisputeResolution[] {
  return disputes.map((field) => {
    const primaryValue = primary[field];
    const secondValue = second[field];
    const thirdValue = tiebreak[field];

    const base = { field, winner: null as unknown, correctsPrimary: false };

    if (thirdValue === null || thirdValue === undefined) {
      return {
        ...base,
        outcome: "abstained" as const,
        finding: {
          field,
          kind: "suspect",
          reason: `Two readings disagree (${displayValue(primaryValue)} vs ${displayValue(secondValue)}) and a focused re-read could not find this field — please confirm it`,
        },
      };
    }

    if (valuesMatch(field, thirdValue, primaryValue)) {
      return {
        field,
        outcome: "resolved" as const,
        winner: primaryValue,
        correctsPrimary: false,
        finding: {
          field,
          kind: "confirm",
          reason: `A focused re-read agreed with ${displayValue(primaryValue)} over ${displayValue(secondValue)} (2 of 3 readings)`,
        },
      };
    }

    if (valuesMatch(field, thirdValue, secondValue)) {
      return {
        field,
        outcome: "resolved" as const,
        winner: secondValue,
        // The first reading was wrong; the value we store gets corrected.
        correctsPrimary: true,
        finding: {
          field,
          kind: "confirm",
          reason: `Corrected to ${displayValue(secondValue)} — a focused re-read agreed with the second reading (2 of 3)`,
        },
      };
    }

    return {
      ...base,
      outcome: "unresolved" as const,
      finding: {
        field,
        kind: "suspect",
        reason: `Three readings, three different values (${displayValue(primaryValue)}, ${displayValue(secondValue)}, ${displayValue(thirdValue)}) — this field needs your eyes`,
      },
    };
  });
}

/** Values to write instead of the primary reading's, after majority voting. */
export function correctedValues(
  resolutions: DisputeResolution[],
): Partial<Record<ComparableField, unknown>> {
  const corrections: Partial<Record<ComparableField, unknown>> = {};
  for (const resolution of resolutions) {
    if (resolution.outcome === "resolved" && resolution.correctsPrimary) {
      corrections[resolution.field] = resolution.winner;
    }
  }
  return corrections;
}
