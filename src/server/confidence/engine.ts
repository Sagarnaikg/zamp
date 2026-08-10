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
 * Combines the independent signals into per-field confidence + reasons
 * (decisions.md §8). Scores are deliberately coarse buckets, not fake
 * precision — what matters to the user is verified / unverified / suspect
 * and the plain-English reason.
 */

export const CONFIDENCE = {
  /** At least one checkable signal contradicts the value. */
  SUSPECT: 0.3,
  /** Extracted and plausible, but nothing independently confirms it. */
  UNVERIFIED: 0.7,
  /** One independent signal confirms the value. */
  VERIFIED: 0.9,
  /** Two or more independent signals agree. */
  STRONG: 0.98,
  /** Nothing was extracted. */
  MISSING: 0,
} as const;

/** A field below this needs the user's eyes; at/above it renders as clean. */
export const REVIEW_THRESHOLD = 0.7;

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

const TRACKED_FIELDS = [
  "vendor",
  "invoice_number",
  "doc_date",
  "currency",
  "subtotal",
  "tax",
  "total",
  "category",
  "line_items",
  "duplicate",
] as const;

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const findings: Finding[] = [];
  let disputedFields: ComparableField[] = [];
  let corrections: Partial<Record<ComparableField, unknown>> = {};

  // Resolve disputes first, because majority voting can change values —
  // and validation must judge the value we are actually going to store,
  // not the one the first reading proposed.
  if (input.secondOpinion) {
    disputedFields = findDisputes(input.extraction, input.secondOpinion);

    if (input.tiebreak) {
      // A third reading has already run: its verdict replaces the raw
      // disagreement rather than stacking another flag on top of it.
      const resolutions = resolveDisputes(
        input.extraction,
        input.secondOpinion,
        input.tiebreak,
        disputedFields,
      );
      corrections = correctedValues(resolutions);
      const settled = new Set(
        resolutions
          .filter((r) => r.outcome === "resolved")
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
    const suspects = own.filter((f) => f.kind === "suspect");
    const confirms = own.filter((f) => f.kind === "confirm");
    const missing = own.some((f) => f.kind === "missing");

    let confidence: number;
    let reasons: string[];

    if (suspects.length > 0) {
      confidence = CONFIDENCE.SUSPECT;
      // Include any correction note: "we changed this, and the new value
      // still looks wrong" is a materially different story from either half.
      reasons = [...suspects, ...confirms]
        .map((f) => f.reason)
        .filter((r): r is string => !!r);
      flaggedCount++;
    } else if (missing) {
      confidence = CONFIDENCE.MISSING;
      reasons = ["Not found in the document"];
    } else {
      // A confirmation usually needs no explanation, but the tiebreaker's
      // does: silently rewriting a value the user never saw disputed is the
      // opposite of the transparency this product is for.
      reasons = confirms.map((f) => f.reason).filter((r): r is string => !!r);
      confidence =
        confirms.length >= 2
          ? CONFIDENCE.STRONG
          : confirms.length === 1
            ? CONFIDENCE.VERIFIED
            : CONFIDENCE.UNVERIFIED;
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
