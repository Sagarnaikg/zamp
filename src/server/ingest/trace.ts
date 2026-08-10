import type { TokenUsage } from "@/server/llm/usage";

/**
 * Pipeline trace (decisions.md §23).
 *
 * Ingestion makes a series of decisions the user never sees — which model
 * read the document, whether a second reading was worth paying for, what
 * the tiebreaker concluded. Recording them turns "Processing…" into an
 * account of what actually happened, and doubles as the observability that
 * makes a failure diagnosable after the fact.
 */

export type StageStatus = "ok" | "skipped" | "failed";

export interface PipelineStage {
  /** Stable identifier — the UI keys off this, not the label. */
  key: string;
  label: string;
  status: StageStatus;
  /** Plain-English account of what this stage did or why it was skipped. */
  detail: string;
  durationMs: number;
  provider?: string;
  model?: string;
  usage?: TokenUsage;
}

/**
 * The canonical stage order, including stages that may be skipped — so the
 * UI can draw the whole pipeline and grey out the parts that didn't run,
 * rather than only showing what happened to execute.
 */
export const PIPELINE_STAGES: Array<{ key: string; label: string }> = [
  { key: "store", label: "Store original" },
  { key: "detect", label: "Detect document type" },
  { key: "extract", label: "First reading" },
  { key: "validate", label: "Validate" },
  { key: "second_reading", label: "Second reading" },
  { key: "compare", label: "Compare readings" },
  { key: "tiebreak", label: "Focused re-read" },
  { key: "duplicates", label: "Duplicate check" },
  { key: "score", label: "Score confidence" },
];

export interface StageDetail {
  detail: string;
  provider?: string;
  model?: string;
  usage?: TokenUsage;
}

export class PipelineTrace {
  private readonly stages: PipelineStage[] = [];

  /** Timestamp to measure a stage from. */
  begin(): number {
    return Date.now();
  }

  private push(
    key: string,
    status: StageStatus,
    since: number,
    info: StageDetail,
  ): void {
    const label =
      PIPELINE_STAGES.find((s) => s.key === key)?.label ?? key;
    this.stages.push({
      key,
      label,
      status,
      durationMs: Date.now() - since,
      ...info,
    });
  }

  ok(key: string, since: number, info: StageDetail): void {
    this.push(key, "ok", since, info);
  }

  /** A stage that deliberately did not run — the reason is the interesting part. */
  skipped(key: string, reason: string): void {
    this.push(key, "skipped", Date.now(), { detail: reason });
  }

  failed(key: string, since: number, reason: string): void {
    this.push(key, "failed", since, { detail: reason });
  }

  toJSON(): PipelineStage[] {
    return this.stages;
  }

  /** Totals for a summary line above the graph. */
  summary(): { durationMs: number; calls: number; tokens: number } {
    return this.stages.reduce(
      (acc, s) => ({
        durationMs: acc.durationMs + s.durationMs,
        calls: acc.calls + (s.usage?.calls ?? 0),
        tokens: acc.tokens + (s.usage?.total ?? 0),
      }),
      { durationMs: 0, calls: 0, tokens: 0 },
    );
  }
}
