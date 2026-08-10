import type { TokenUsage } from "@/server/llm/usage";

/**
 * Pipeline trace (decisions.md §23).
 *
 * Ingestion makes a series of decisions the user never sees — which model
 * read the document, whether a second reading was worth paying for, what
 * the tiebreaker concluded. This records them as a graph so the UI can draw
 * the architecture, and doubles as the observability that makes a failure
 * diagnosable after the fact.
 */

/** A status a stage can actually report while running. */
export type RecordedStatus = "ok" | "skipped" | "failed";

/** Adds the view-only state for nodes that never reported at all. */
export type StageStatus = RecordedStatus | "pending";

/** Static shape of the pipeline — known before anything runs. */
export interface PipelineNode {
  key: string;
  label: string;
  /** Top-level grouping for display: "Intake", "Reading", ... */
  phase: string;
  /** Parallel track within a phase, when there is one. */
  branch?: string;
  /** Node keys with an edge into this one; empty means it's a root. */
  dependsOn: string[];
}

/**
 * The pipeline as an actual DAG. Verification and duplicate checking are
 * genuinely independent — the duplicate check compares against workspace
 * history and never looks at the readings — so they fan out after the first
 * reading and merge again at scoring.
 *
 *   store → detect → extract ─┬→ validate → second_reading → compare → tiebreak ─┬→ score
 *                             └→ duplicates ──────────────────────────────────────┘
 */
export const PIPELINE_GRAPH: PipelineNode[] = [
  { key: "store", label: "Store original", phase: "Intake", dependsOn: [] },
  { key: "detect", label: "Detect document type", phase: "Intake", dependsOn: ["store"] },
  { key: "extract", label: "First reading", phase: "Reading", dependsOn: ["detect"] },
  {
    key: "validate",
    label: "Validate",
    phase: "Verification",
    branch: "Checks",
    dependsOn: ["extract"],
  },
  {
    key: "second_reading",
    label: "Second reading",
    phase: "Verification",
    branch: "Checks",
    dependsOn: ["validate"],
  },
  {
    key: "compare",
    label: "Compare readings",
    phase: "Verification",
    branch: "Checks",
    dependsOn: ["second_reading"],
  },
  {
    key: "tiebreak",
    label: "Focused re-read",
    phase: "Verification",
    branch: "Checks",
    dependsOn: ["compare"],
  },
  {
    key: "duplicates",
    label: "Duplicate check",
    phase: "Verification",
    branch: "History",
    dependsOn: ["extract"],
  },
  {
    key: "score",
    label: "Score confidence",
    phase: "Decision",
    dependsOn: ["tiebreak", "duplicates"],
  },
];

/** What actually happened at one node. */
export interface StageResult {
  key: string;
  status: RecordedStatus;
  /** Plain-English account of what this stage did or why it was skipped. */
  detail: string;
  durationMs: number;
  provider?: string;
  model?: string;
  usage?: TokenUsage;
}

/** A node with its runtime result merged in — what the UI renders. */
export type PipelineViewNode = PipelineNode &
  Omit<StageResult, "key" | "status"> & { status: StageStatus };

export interface PipelineView {
  nodes: PipelineViewNode[];
  edges: Array<{ from: string; to: string }>;
  totals: { durationMs: number; calls: number; tokens: number };
}

export interface StageDetail {
  detail: string;
  provider?: string;
  model?: string;
  usage?: TokenUsage;
}

export class PipelineTrace {
  private readonly results: StageResult[] = [];

  /** Timestamp to measure a stage from. */
  begin(): number {
    return Date.now();
  }

  private push(
    key: string,
    status: RecordedStatus,
    since: number,
    info: StageDetail,
  ): void {
    this.results.push({ key, status, durationMs: Date.now() - since, ...info });
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

  toJSON(): StageResult[] {
    return this.results;
  }
}

/**
 * Merge recorded results onto the static graph. Nodes that never reported a
 * result come back as `pending` rather than being omitted, so the UI always
 * draws the same shape and greys out what didn't run.
 */
export function buildPipelineView(results: StageResult[]): PipelineView {
  const byKey = new Map(results.map((r) => [r.key, r]));

  const nodes: PipelineViewNode[] = PIPELINE_GRAPH.map((node) => {
    const result = byKey.get(node.key);
    return {
      ...node,
      status: result?.status ?? "pending",
      detail: result?.detail ?? "",
      durationMs: result?.durationMs ?? 0,
      provider: result?.provider,
      model: result?.model,
      usage: result?.usage,
    };
  });

  const edges = PIPELINE_GRAPH.flatMap((node) =>
    node.dependsOn.map((from) => ({ from, to: node.key })),
  );

  const totals = results.reduce(
    (acc, r) => ({
      durationMs: acc.durationMs + r.durationMs,
      calls: acc.calls + (r.usage?.calls ?? 0),
      tokens: acc.tokens + (r.usage?.total ?? 0),
    }),
    { durationMs: 0, calls: 0, tokens: 0 },
  );

  return { nodes, edges, totals };
}
