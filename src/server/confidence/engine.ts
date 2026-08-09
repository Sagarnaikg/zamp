import {
  type DuplicateCandidate,
  type Extraction,
  type FieldMeta,
  type Finding,
} from "./types";
import { arithmeticSignal } from "./arithmetic";
import { formatSignal } from "./format";
import { agreementSignal } from "./agreement";
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
  duplicateCandidates?: DuplicateCandidate[];
  today?: Date;
}

export interface ConfidenceResult {
  fieldMeta: FieldMeta;
  matchedDuplicateId: string | null;
  /** Number of fields below the review threshold (excluding missing). */
  flaggedCount: number;
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
  const findings: Finding[] = [
    ...arithmeticSignal(input.extraction),
    ...formatSignal(input.extraction, input.today),
  ];

  if (input.secondOpinion) {
    findings.push(...agreementSignal(input.extraction, input.secondOpinion));
  }

  const dup = duplicateSignal(
    input.extraction,
    input.duplicateCandidates ?? [],
  );
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
      reasons = suspects.map((f) => f.reason!).filter(Boolean);
      flaggedCount++;
    } else if (missing) {
      confidence = CONFIDENCE.MISSING;
      reasons = ["Not found in the document"];
    } else if (confirms.length >= 2) {
      confidence = CONFIDENCE.STRONG;
      reasons = [];
    } else if (confirms.length === 1) {
      confidence = CONFIDENCE.VERIFIED;
      reasons = [];
    } else {
      confidence = CONFIDENCE.UNVERIFIED;
      reasons = [];
    }

    fieldMeta[field] = { confidence, reasons };
  }

  return {
    fieldMeta,
    matchedDuplicateId: dup.matchedDocumentId,
    flaggedCount,
  };
}
