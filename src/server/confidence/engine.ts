import {
  CONFIDENCE,
  DisputeOutcome,
  ExtractionField,
  FIELD_REASONS,
  FindingKind,
} from "@/server/constants";
import {
  type DuplicateCandidate,
  type Extraction,
  type FieldMeta,
  type Finding,
} from "./types";
import { arithmeticSignal } from "./arithmetic";
import { formatSignal } from "./format";
import { agreementSignal } from "./agreement";
import { correctedValues, findDisputes, resolveDisputes } from "./tiebreak";
import type { ComparableField } from "./compare";
import { duplicateSignal } from "./duplicates";

/**
 * Combines the independent signals into per-field confidence and reasons
 * (decisions.md §8). Scores are coarse buckets, not fake precision.
 */

export interface ConfidenceInput {
  extraction: Extraction;
  secondOpinion?: Extraction | null;
  /** Focused third reading of disputed fields (decisions.md §20). */
  tiebreak?: Partial<Extraction> | null;
  duplicateCandidates?: DuplicateCandidate[];
  today?: Date;
}

export interface ConfidenceResult {
  fieldMeta: FieldMeta;
  matchedDuplicateId: string | null;
  /** Number of fields below the review threshold (excluding missing). */
  flaggedCount: number;
  /** Fields the two readings disagree on — the tiebreaker's work list. */
  disputedFields: ComparableField[];
  /** Values majority voting corrected, to persist instead of the primary's. */
  corrections: Partial<Record<ComparableField, unknown>>;
}

const TRACKED_FIELDS = Object.values(ExtractionField);

/** Score from how many independent signals corroborated the field. */
function scoreFrom(confirmCount: number): number {
  if (confirmCount >= 2) return CONFIDENCE.strong;
  if (confirmCount === 1) return CONFIDENCE.verified;
  return CONFIDENCE.unverified;
}

function reasonsOf(findings: Finding[]): string[] {
  return findings.map((f) => f.reason).filter((r): r is string => !!r);
}

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const findings: Finding[] = [];
  let disputedFields: ComparableField[] = [];
  let corrections: Partial<Record<ComparableField, unknown>> = {};

  // Disputes resolve first: majority voting can change values, and
  // validation must judge what we will actually store.
  if (input.secondOpinion) {
    disputedFields = findDisputes(input.extraction, input.secondOpinion);

    if (input.tiebreak) {
      // The third reading's verdict replaces the raw disagreement.
      const resolutions = resolveDisputes(
        input.extraction,
        input.secondOpinion,
        input.tiebreak,
        disputedFields,
      );
      corrections = correctedValues(resolutions);
      const settled = new Set(
        resolutions
          .filter((r) => r.outcome === DisputeOutcome.Resolved)
          .map((r) => r.field as string),
      );
      // Agreement findings for fields the tiebreaker settled are superseded.
      findings.push(
        ...agreementSignal(input.extraction, input.secondOpinion).filter(
          (f) => !settled.has(f.field),
        ),
        ...resolutions.map((r) => r.finding),
      );
    } else {
      findings.push(...agreementSignal(input.extraction, input.secondOpinion));
    }
  }

  const resolved = { ...input.extraction, ...corrections } as Extraction;

  findings.push(
    ...arithmeticSignal(resolved),
    ...formatSignal(resolved, input.today),
  );

  const dup = duplicateSignal(resolved, input.duplicateCandidates ?? []);
  findings.push(...dup.findings);

  const fieldMeta: FieldMeta = {};
  let flaggedCount = 0;

  for (const field of TRACKED_FIELDS) {
    const own = findings.filter((f) => f.field === field);
    const suspects = own.filter((f) => f.kind === FindingKind.Suspect);
    const confirms = own.filter((f) => f.kind === FindingKind.Confirm);
    const missing = own.some((f) => f.kind === FindingKind.Missing);

    let confidence: number;
    let reasons: string[];

    if (suspects.length > 0) {
      // Both halves matter: "we changed this, and it still looks wrong".
      confidence = CONFIDENCE.suspect;
      reasons = reasonsOf([...suspects, ...confirms]);
      flaggedCount++;
    } else if (missing) {
      confidence = CONFIDENCE.missing;
      reasons = [FIELD_REASONS.notFound];
    } else {
      // Confirmations are usually silent, but a tiebreaker correction must
      // be visible — rewriting a value the user never saw disputed isn't.
      confidence = scoreFrom(confirms.length);
      reasons = reasonsOf(confirms);
    }

    fieldMeta[field] = { confidence, reasons };
  }

  return {
    fieldMeta,
    matchedDuplicateId: dup.matchedDocumentId,
    flaggedCount,
    disputedFields,
    corrections,
  };
}
