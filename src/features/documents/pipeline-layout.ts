import type { PipelineStageKey } from "@/server/constants";
import type { PipelineViewNode } from "@/server/ingest/trace";

/**
 * Layout for the pipeline graph. Positions are derived from the dependency
 * edges rather than hard-coded, so adding a stage to PIPELINE_GRAPH draws
 * itself correctly instead of needing coordinates hand-tuned here.
 */

export const NODE_WIDTH = 252;
/**
 * Tall enough for the worst case: branch/phase label (24) + card padding
 * (32) + icon/title row (34) + gap (12) + a fully 3-line-clamped detail box
 * with its own label and padding (~96) + gap (12) + status/token footer
 * (24) ≈ 234, plus a real margin so it isn't a razor's edge. 172, then 220,
 * both undershot this and either spilled into the next card or — once
 * overflow-hidden was added to stop that — silently clipped the footer
 * badge instead.
 */
export const NODE_HEIGHT = 256;
const GAP_X = 76;
const GAP_Y = 28;
const PADDING = 32;

interface PositionedNode {
  node: PipelineViewNode;
  x: number;
  y: number;
}

export interface GraphLayout {
  nodes: PositionedNode[];
  /** Bezier path data, ready to drop into an SVG <path d={...}>. */
  edges: string[];
  width: number;
  height: number;
}

/**
 * Column = longest path from a root, so a node always sits to the right of
 * everything it depends on. One pass is enough because PIPELINE_GRAPH is
 * topologically sorted — a property its own test pins.
 */
function columnOf(nodes: PipelineViewNode[]): Map<PipelineStageKey, number> {
  const depth = new Map<PipelineStageKey, number>();
  for (const node of nodes) {
    const deepestParent = node.dependsOn.reduce(
      (max, key) => Math.max(max, depth.get(key) ?? 0),
      -1,
    );
    depth.set(node.key, deepestParent + 1);
  }
  return depth;
}

export function layoutPipeline(nodes: PipelineViewNode[]): GraphLayout {
  const column = columnOf(nodes);
  const usedRows = new Map<number, number>();
  const placed = new Map<PipelineStageKey, PositionedNode>();

  const positioned = nodes.map((node) => {
    const col = column.get(node.key) ?? 0;
    // Parallel branches (verification vs. duplicate history) share a column
    // and stack downward.
    const row = usedRows.get(col) ?? 0;
    usedRows.set(col, row + 1);

    const entry: PositionedNode = {
      node,
      x: PADDING + col * (NODE_WIDTH + GAP_X),
      y: PADDING + row * (NODE_HEIGHT + GAP_Y),
    };
    placed.set(node.key, entry);
    return entry;
  });

  const edges: string[] = [];
  for (const { node } of positioned) {
    const target = placed.get(node.key);
    if (!target) continue;
    for (const parentKey of node.dependsOn) {
      const source = placed.get(parentKey);
      if (!source) continue;

      const x1 = source.x + NODE_WIDTH;
      const y1 = source.y + NODE_HEIGHT / 2;
      const x2 = target.x;
      const y2 = target.y + NODE_HEIGHT / 2;
      // Horizontal control points keep the curve leaving and entering each
      // card side-on, which reads as flow rather than as a scribble.
      const bend = Math.max(36, (x2 - x1) / 2);
      edges.push(`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
    }
  }

  const columns = Math.max(...positioned.map((p) => column.get(p.node.key) ?? 0)) + 1;
  const rows = Math.max(...usedRows.values());

  return {
    nodes: positioned,
    edges,
    width: PADDING * 2 + columns * NODE_WIDTH + (columns - 1) * GAP_X,
    height: PADDING * 2 + rows * NODE_HEIGHT + (rows - 1) * GAP_Y,
  };
}
