import { describe, expect, it } from "vitest";
import {
  PIPELINE_GRAPH,
  PipelineTrace,
  buildPipelineView,
  type StageResult,
} from "@/server/ingest/trace";
import {
  PipelineStageKey,
  Provider,
  StageStatus,
  StageViewStatus,
} from "@/server/constants";

describe("PIPELINE_GRAPH", () => {
  it("has no edge pointing at a node that doesn't exist", () => {
    const keys = new Set(PIPELINE_GRAPH.map((n) => n.key));
    for (const node of PIPELINE_GRAPH) {
      for (const dep of node.dependsOn) {
        expect(keys, `${node.key} depends on unknown "${dep}"`).toContain(dep);
      }
    }
  });

  it("declares every dependency before the node that needs it", () => {
    // Lets the UI lay the graph out left-to-right without sorting first.
    const seen = new Set<string>();
    for (const node of PIPELINE_GRAPH) {
      for (const dep of node.dependsOn) {
        expect(seen, `${node.key} listed before its dependency`).toContain(dep);
      }
      seen.add(node.key);
    }
  });

  it("has exactly one entry point and one exit point", () => {
    const roots = PIPELINE_GRAPH.filter((n) => n.dependsOn.length === 0);
    const depended = new Set(PIPELINE_GRAPH.flatMap((n) => n.dependsOn));
    const leaves = PIPELINE_GRAPH.filter((n) => !depended.has(n.key));
    expect(roots.map((n) => n.key)).toEqual([PipelineStageKey.Store]);
    expect(leaves.map((n) => n.key)).toEqual([PipelineStageKey.Score]);
  });

  it("fans out into parallel branches that merge again", () => {
    // Verification and duplicate checking are genuinely independent, which is
    // what makes this a graph rather than a list.
    const fanOut = PIPELINE_GRAPH.filter((n) => n.dependsOn.includes(PipelineStageKey.Extract));
    expect(fanOut.map((n) => n.key).sort()).toEqual([PipelineStageKey.Duplicates, PipelineStageKey.Validate]);

    const merge = PIPELINE_GRAPH.find((n) => n.key === PipelineStageKey.Score);
    expect(merge?.dependsOn.sort()).toEqual([PipelineStageKey.Duplicates, PipelineStageKey.Tiebreak]);
  });
});

describe("PipelineTrace", () => {
  it("records results in the order they ran", () => {
    const trace = new PipelineTrace();
    trace.ok(PipelineStageKey.Store, trace.begin(), { detail: "saved" });
    trace.ok(PipelineStageKey.Detect, trace.begin(), { detail: "digital pdf" });
    expect(trace.toJSON().map((r) => r.key)).toEqual([PipelineStageKey.Store, PipelineStageKey.Detect]);
  });

  it("keeps a skipped stage, with its reason", () => {
    // A skipped stage is the interesting part of the graph — the user should
    // see that the pipeline chose not to spend, and why.
    const trace = new PipelineTrace();
    trace.skipped(PipelineStageKey.SecondReading, "arithmetic already reconciles");
    const [result] = trace.toJSON();
    expect(result.status).toBe(StageStatus.Skipped);
    expect(result.detail).toBe("arithmetic already reconciles");
  });

  it("carries the model and token cost of stages that called one", () => {
    const trace = new PipelineTrace();
    trace.ok(PipelineStageKey.Extract, trace.begin(), {
      detail: "read the document",
      provider: Provider.Google,
      model: "gemini-flash-latest",
      usage: { input: 900, output: 100, total: 1000, calls: 1 },
    });
    const [result] = trace.toJSON();
    expect(result.provider).toBe(Provider.Google);
    expect(result.usage?.total).toBe(1000);
  });

  it("records a failure without losing stages that already succeeded", () => {
    const trace = new PipelineTrace();
    trace.ok(PipelineStageKey.Store, trace.begin(), { detail: "saved" });
    trace.failed(PipelineStageKey.Extract, trace.begin(), "provider rate limited");
    expect(trace.toJSON().map((r) => r.status)).toEqual([StageStatus.Ok, StageStatus.Failed]);
  });
});

describe("buildPipelineView", () => {
  const ran: StageResult[] = [
    { key: PipelineStageKey.Store, status: StageStatus.Ok, detail: "saved", durationMs: 2 },
    { key: PipelineStageKey.Detect, status: StageStatus.Ok, detail: "digital pdf", durationMs: 10 },
    {
      key: PipelineStageKey.Extract,
      status: StageStatus.Ok,
      detail: "read text layer",
      durationMs: 1800,
      provider: Provider.Google,
      model: "gemini-flash-lite-latest",
      usage: { input: 450, output: 440, total: 890, calls: 1 },
    },
    { key: PipelineStageKey.Validate, status: StageStatus.Ok, detail: "7 corroborated", durationMs: 5 },
    { key: PipelineStageKey.SecondReading, status: StageStatus.Skipped, detail: "not needed", durationMs: 0 },
  ];

  it("returns every node in the graph, even ones that never ran", () => {
    const view = buildPipelineView(ran);
    expect(view.nodes).toHaveLength(PIPELINE_GRAPH.length);
    const compare = view.nodes.find((n) => n.key === PipelineStageKey.Compare);
    expect(compare?.status).toBe(StageViewStatus.Pending);
  });

  it("merges runtime results onto their static node", () => {
    const view = buildPipelineView(ran);
    const extract = view.nodes.find((n) => n.key === PipelineStageKey.Extract);
    expect(extract?.label).toBe("First reading");
    expect(extract?.phase).toBe("Reading");
    expect(extract?.model).toBe("gemini-flash-lite-latest");
    expect(extract?.status).toBe(StageViewStatus.Ok);
  });

  it("emits one edge per dependency, ready to draw", () => {
    const view = buildPipelineView(ran);
    expect(view.edges).toContainEqual({ from: PipelineStageKey.Extract, to: PipelineStageKey.Validate });
    expect(view.edges).toContainEqual({ from: PipelineStageKey.Extract, to: PipelineStageKey.Duplicates });
    expect(view.edges).toContainEqual({ from: PipelineStageKey.Duplicates, to: PipelineStageKey.Score });
  });

  it("totals only the stages that actually spent tokens", () => {
    const view = buildPipelineView(ran);
    expect(view.totals.calls).toBe(1);
    expect(view.totals.tokens).toBe(890);
  });

  it("produces a full graph even from an empty trace", () => {
    // A document still processing should render the pipeline greyed out
    // rather than an empty canvas.
    const view = buildPipelineView([]);
    expect(view.nodes).toHaveLength(PIPELINE_GRAPH.length);
    expect(view.nodes.map((n) => n.status)).toEqual(
      view.nodes.map(() => StageViewStatus.Pending),
    );
    expect(view.edges.length).toBeGreaterThan(0);
  });
});
