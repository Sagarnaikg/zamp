export type { StageResult } from "@/server/db/schema";
import type { StageResult, TokenUsage } from "@/server/db/schema";
import {
  PIPELINE_GRAPH_DEFINITION,
  PipelineBranch,
  PipelinePhase,
  PipelineStageKey,
  Provider,
  StageStatus,
  StageViewStatus,
} from "@/server/constants";

/**
 * Pipeline trace (decisions.md §23). Ingestion decisions — which model read
 * the document, whether a second reading was worth paying for, what the
 * tiebreaker concluded — are recorded as a graph so a UI can draw the
 * architecture, and so a failure is diagnosable after the fact.
 */

export interface PipelineNode {
  key: PipelineStageKey;
  label: string;
  phase: PipelinePhase;
  /** Parallel track within a phase, when there is one. */
  branch?: PipelineBranch;
  /** Node keys with an edge into this one; empty means it's a root. */
  dependsOn: PipelineStageKey[];
}

export const PIPELINE_GRAPH: PipelineNode[] = PIPELINE_GRAPH_DEFINITION;

export type PipelineViewNode = PipelineNode &
  Omit<StageResult, "key" | "status"> & { status: StageViewStatus };

export interface PipelineView {
  nodes: PipelineViewNode[];
  edges: Array<{ from: PipelineStageKey; to: PipelineStageKey }>;
  totals: { durationMs: number; calls: number; tokens: number };
}

export interface StageDetail {
  detail: string;
  provider?: Provider;
  model?: string;
  usage?: TokenUsage;
}

export class PipelineTrace {
  private readonly results: StageResult[] = [];

  begin(): number {
    return Date.now();
  }

  private push(
    key: PipelineStageKey,
    status: StageStatus,
    since: number,
    info: StageDetail,
  ): void {
    this.results.push({ key, status, durationMs: Date.now() - since, ...info });
  }

  ok(key: PipelineStageKey, since: number, info: StageDetail): void {
    this.push(key, StageStatus.Ok, since, info);
  }

  /** A stage that deliberately did not run — the reason is the interesting part. */
  skipped(key: PipelineStageKey, reason: string): void {
    this.push(key, StageStatus.Skipped, Date.now(), { detail: reason });
  }

  failed(key: PipelineStageKey, since: number, reason: string): void {
    this.push(key, StageStatus.Failed, since, { detail: reason });
  }

  toJSON(): StageResult[] {
    return this.results;
  }
}

function toViewStatus(status: StageStatus): StageViewStatus {
  switch (status) {
    case StageStatus.Ok:
      return StageViewStatus.Ok;
    case StageStatus.Skipped:
      return StageViewStatus.Skipped;
    case StageStatus.Failed:
      return StageViewStatus.Failed;
  }
}

/**
 * Merge recorded results onto the static graph. A node that never reported
 * comes back `pending` rather than being omitted, so the UI always draws
 * the same shape and greys out what didn't run.
 */
export function buildPipelineView(results: StageResult[]): PipelineView {
  const byKey = new Map(results.map((r) => [r.key, r]));

  const nodes: PipelineViewNode[] = PIPELINE_GRAPH.map((node) => {
    const result = byKey.get(node.key);
    return {
      ...node,
      status: result ? toViewStatus(result.status) : StageViewStatus.Pending,
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
