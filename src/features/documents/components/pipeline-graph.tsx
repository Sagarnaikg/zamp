"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { formatDuration } from "@/lib/utils/format";
import { layoutPipeline } from "../pipeline-layout";
import { PipelineNodeCard } from "./pipeline-node-card";
import type { DocumentPipeline } from "../types";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.25;
const ZOOM_STEP = 0.15;
/**
 * Fitting must never shrink the graph into illegibility — below roughly this
 * scale the card text stops being readable, at which point panning a legible
 * graph beats seeing an unreadable whole. Manual zoom can still go lower.
 */
const FIT_MIN_ZOOM = 0.5;

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
  const [zoom, setZoom] = useState(0.6);

  const { nodes, edges, width, height } = layoutPipeline(pipeline.nodes);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const available = viewport.clientWidth - 24;
    setZoom(Math.min(MAX_ZOOM, Math.max(FIT_MIN_ZOOM, available / width)));
  }, [width]);

  // Refit when the viewport changes size, not just on mount — otherwise the
  // zoom stays wrong after a window resize or a sidebar opening.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div className="space-y-4">
      <Totals totals={pipeline.totals} />

      <div className="relative overflow-hidden rounded-card bg-surface-raised">
        <div
          ref={viewportRef}
          className="overflow-auto"
          style={{
            // Max, not fixed: a short pipeline shouldn't leave half a screen
            // of empty canvas below it.
            maxHeight: "min(62vh, 620px)",
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

        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-card">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Minus className="size-4" strokeWidth={2} aria-hidden />
            </button>
            <span
              aria-live="polite"
              className="min-w-11 text-center text-[12px] font-medium tabular-nums text-foreground"
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Plus className="size-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={fit}
            aria-label="Fit pipeline to view"
            className="inline-flex size-10 items-center justify-center rounded-full bg-surface text-muted shadow-card transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Maximize2 className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
