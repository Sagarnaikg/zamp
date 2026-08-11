import { describe, expect, it } from "vitest";
import { layoutPipeline, NODE_WIDTH } from "@/features/documents/pipeline-layout";
import { buildPipelineView } from "@/server/ingest/trace";
import { PipelineStageKey, StageViewStatus } from "@/server/constants";
import type { PipelineViewNode } from "@/server/ingest/trace";

function nodesFrom(): PipelineViewNode[] {
  // The real graph, with nothing run — layout must not depend on results.
  return buildPipelineView([]).nodes;
}

function byKey(nodes: PipelineViewNode[]) {
  const layout = layoutPipeline(nodes);
  return new Map(layout.nodes.map((n) => [n.node.key, n]));
}

/**
 * Positions are derived from the dependency edges rather than hard-coded, so
 * these pin the property that matters: a stage is always drawn to the right
 * of everything it waits on. Adding a stage to PIPELINE_GRAPH should keep
 * that true without anyone editing coordinates.
 */
describe("layoutPipeline", () => {
  it("places every node in the graph", () => {
    const nodes = nodesFrom();
    expect(layoutPipeline(nodes).nodes).toHaveLength(nodes.length);
  });

  it("draws each node to the right of everything it depends on", () => {
    const nodes = nodesFrom();
    const placed = byKey(nodes);

    for (const node of nodes) {
      for (const parent of node.dependsOn) {
        expect(placed.get(node.key)!.x).toBeGreaterThan(placed.get(parent)!.x);
      }
    }
  });

  it("separates parallel branches into different rows, not overlapping cards", () => {
    // validate (Checks) and duplicates (History) both hang off extract, so
    // they share a column and must not be drawn on top of each other.
    const placed = byKey(nodesFrom());
    const validate = placed.get(PipelineStageKey.Validate)!;
    const duplicates = placed.get(PipelineStageKey.Duplicates)!;

    expect(validate.x).toBe(duplicates.x);
    expect(validate.y).not.toBe(duplicates.y);
  });

  it("emits one edge per dependency", () => {
    const nodes = nodesFrom();
    const expected = nodes.reduce((sum, node) => sum + node.dependsOn.length, 0);
    expect(layoutPipeline(nodes).edges).toHaveLength(expected);
  });

  it("sizes the canvas to contain the rightmost card", () => {
    const layout = layoutPipeline(nodesFrom());
    const furthest = Math.max(...layout.nodes.map((n) => n.x));
    expect(layout.width).toBeGreaterThanOrEqual(furthest + NODE_WIDTH);
  });

  it("lays out an unrun pipeline identically to a completed one", () => {
    // The graph's shape is static (§23); only status differs. A user watching
    // ingestion should not see cards jump around as stages report in.
    const pending = layoutPipeline(nodesFrom());
    const nodes = nodesFrom().map((node) => ({ ...node, status: StageViewStatus.Ok }));
    const done = layoutPipeline(nodes);

    expect(done.nodes.map((n) => [n.x, n.y])).toEqual(
      pending.nodes.map((n) => [n.x, n.y]),
    );
  });
});
