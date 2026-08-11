import { DisputeOutcome, FindingKind } from "@/server/constants";
import { type Extraction, type Finding } from "./types";
import {
  COMPARABLE_FIELDS,
  type ComparableField,
  displayValue,
  valuesMatch,
} from "./compare";

/**
 * Targeted re-extraction tiebreaker (decisions.md §20). The third read is
 * blind — never shown the two candidates — so it can't be anchored into
 * rubber-stamping one. 2-of-3 resolves; three answers means a human looks.
 */

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
        outcome: DisputeOutcome.Abstained,
        finding: {
          field,
          kind: FindingKind.Suspect,
          reason: `Two readings disagree (${displayValue(primaryValue)} vs ${displayValue(secondValue)}) and a focused re-read could not find this field — please confirm it`,
        },
      };
    }

    if (valuesMatch(field, thirdValue, primaryValue)) {
      return {
        field,
        outcome: DisputeOutcome.Resolved,
        winner: primaryValue,
        correctsPrimary: false,
        finding: {
          field,
          kind: FindingKind.Confirm,
          reason: `A focused re-read agreed with ${displayValue(primaryValue)} over ${displayValue(secondValue)} (2 of 3 readings)`,
        },
      };
    }

    if (valuesMatch(field, thirdValue, secondValue)) {
      return {
        field,
        outcome: DisputeOutcome.Resolved,
        winner: secondValue,
        // The first reading was wrong; the value we store gets corrected.
        correctsPrimary: true,
        finding: {
          field,
          kind: FindingKind.Confirm,
          reason: `Corrected to ${displayValue(secondValue)} — a focused re-read agreed with the second reading (2 of 3)`,
        },
      };
    }

    return {
      ...base,
      outcome: DisputeOutcome.Unresolved,
      finding: {
        field,
        kind: FindingKind.Suspect,
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
    if (resolution.outcome === DisputeOutcome.Resolved && resolution.correctsPrimary) {
      corrections[resolution.field] = resolution.winner;
    }
  }
  return corrections;
}
