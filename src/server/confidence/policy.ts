import { CONFIDENCE, type ConfidenceResult } from "./engine";
import type { FileKind } from "@/server/ingest/detect";

/**
 * Verification cost policy (decisions.md §21).
 *
 * The second reading is the most expensive step in ingestion. Skipping it is
 * only defensible where cheaper evidence already covers the same ground, so
 * the decision runs *after* the deterministic checks and reads their result.
 */

/**
 * A digital PDF's text layer is exact characters, not pixels — there is no
 * OCR error for a second reading to catch. When the document's own
 * arithmetic also reconciles and nothing looks implausible, the numbers are
 * corroborated by evidence stronger than another model's opinion.
 *
 * Scans and photos always get the second reading: misread digits are the
 * dominant failure there, and disagreement is exactly what catches them.
 */
export function needsSecondReading(
  kind: FileKind,
  firstPass: ConfidenceResult,
): boolean {
  if (kind !== "digital_pdf") return true;
  if (firstPass.flaggedCount > 0) return true;
  return !["subtotal", "tax", "total"].every(
    (field) =>
      (firstPass.fieldMeta[field]?.confidence ?? 0) >= CONFIDENCE.VERIFIED,
  );
}
