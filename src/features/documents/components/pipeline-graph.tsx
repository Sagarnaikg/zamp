"use client";

import { useRef, useState, type WheelEvent } from "react";
import { RotateCcw } from "lucide-react";
import { formatDuration } from "@/lib/utils/format";
import { layoutPipeline } from "../pipeline-layout";
import { PipelineNodeCard } from "./pipeline-node-card";
import type { DocumentPipeline } from "../types";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.25;
/** How much one wheel notch/pinch step changes the zoom. */
const ZOOM_WHEEL_SENSITIVITY = 0.0015;
/**
 * The starting zoom, and what "Reset view" returns to. Near-true-size rather
 * than an auto-fit-to-width ratio — a computed fit shrank small pipelines
 * down for no reason and made the cards harder to read on load.
 */
const DEFAULT_ZOOM = 0.95;

function Totals({ totals }: { totals: DocumentPipeline["totals"] }) {
  const items = [
    { label: "Time", value: formatDuration(totals.durationMs) },
    { label: "Model calls", value: String(totals.calls) },
    { label: "Tokens", value: totals.tokens.toLocaleString() },
  ];

  return (
    <dl className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline gap-2 rounded-full bg-surface px-4 py-2"
        >
          <dt className="text-[12px] text-muted">{item.label}</dt>
          <dd className="text-[13px] font-semibold text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The ingestion pipeline as a graph (§23): what ran, what was deliberately
 * skipped, which model read the document, and what each step cost.
 *
 * The canvas is wider than any viewport, so it pans and zooms rather than
 * being squeezed to fit — a legible subgraph beats an unreadable whole.
 */
export function PipelineGraph({ pipeline }: { pipeline: DocumentPipeline }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const { nodes, edges, width, height } = layoutPipeline(pipeline.nodes);

  const resetView = () => setZoom(DEFAULT_ZOOM);

  // Ctrl/Cmd+wheel is how trackpad pinch and mouse-wheel zoom both arrive in
  // the browser; a plain wheel is left alone so it keeps scrolling the
  // viewport's native overflow — that's the panning.
  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom((z) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - event.deltaY * ZOOM_WHEEL_SENSITIVITY)),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Totals totals={pipeline.totals} />

      <div
        className="relative overflow-hidden rounded-card bg-surface-raised"
        // Fills essentially all the room below the totals bar, rather than
        // the previous fixed cap — the graph is the point of this tab.
        style={{ height: "calc(100vh - 20rem)", minHeight: "32rem" }}
      >
        <div
          ref={viewportRef}
          onWheel={onWheel}
          className="size-full overflow-auto"
          style={{
            // The reference's dotted canvas, which also makes panning legible.
            backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          <div
            style={{
              width: width * zoom,
              height: height * zoom,
              // Scaling a wrapper keeps text crisp and avoids re-layout on zoom.
              minWidth: "100%",
            }}
          >
            <div
              style={{
                width,
                height,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
              className="relative"
            >
              <svg
                width={width}
                height={height}
                className="pointer-events-none absolute inset-0"
                aria-hidden
              >
                {edges.map((path) => (
                  <path
                    key={path}
                    d={path}
                    fill="none"
                    stroke="var(--border-strong)"
                    strokeWidth={1.5}
                  />
                ))}
              </svg>

              {nodes.map(({ node, x, y }) => (
                <div key={node.key} className="absolute" style={{ left: x, top: y }}>
                  <PipelineNodeCard node={node} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-surface py-1 pl-4 pr-1 shadow-card">
          <span
            aria-live="polite"
            className="text-[12px] font-medium tabular-nums text-muted"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={resetView}
            aria-label="Reset view"
            title="Reset view"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
