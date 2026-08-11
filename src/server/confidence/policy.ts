import type { ConfidenceResult } from "./engine";
import { MONEY_FIELDS } from "./compare";
import { CONFIDENCE, FileKind } from "@/server/constants";

/**
 * Verification cost policy (decisions.md §21). A digital PDF's text layer is
 * exact characters, so there's no OCR error for a second reading to catch;
 * when its arithmetic also reconciles, the second call adds cost not
 * evidence. Scans and photos always get it — misreads dominate there.
 */
export function needsSecondReading(
  kind: FileKind,
  firstPass: ConfidenceResult,
): boolean {
  if (kind !== FileKind.DigitalPdf) return true;
  if (firstPass.flaggedCount > 0) return true;
  return !MONEY_FIELDS.every(
    (field) =>
      (firstPass.fieldMeta[field]?.confidence ?? 0) >= CONFIDENCE.verified,
  );
}
