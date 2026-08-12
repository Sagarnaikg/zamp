import {
  CheckCheck,
  Eye,
  Files,
  FileText,
  Gauge,
  GitCompare,
  Save,
  Scale,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import { PipelineStageKey, StageViewStatus } from "@/server/constants";
import { STAGE_STATUS_LABELS, STAGE_STATUS_STYLES } from "@/constants";
import { cn } from "@/lib/utils/cn";
import { formatDuration } from "@/lib/utils/format";
import { NODE_HEIGHT, NODE_WIDTH } from "../pipeline-layout";
import type { PipelineViewNode } from "@/server/ingest/trace";

const STAGE_ICONS: Record<PipelineStageKey, LucideIcon> = {
  [PipelineStageKey.Store]: Save,
  [PipelineStageKey.Detect]: ScanSearch,
  [PipelineStageKey.Extract]: FileText,
  [PipelineStageKey.Validate]: CheckCheck,
  [PipelineStageKey.SecondReading]: Eye,
  [PipelineStageKey.Compare]: GitCompare,
  [PipelineStageKey.Tiebreak]: Scale,
  [PipelineStageKey.Duplicates]: Files,
  [PipelineStageKey.Score]: Gauge,
};

const DOT_STYLES: Record<StageViewStatus, string> = {
  [StageViewStatus.Ok]: "bg-confidence-strong",
  [StageViewStatus.Skipped]: "bg-muted",
  [StageViewStatus.Failed]: "bg-danger",
  [StageViewStatus.Pending]: "bg-subtle",
};

/**
 * One stage of ingestion. A stage that didn't run is drawn faded rather than
 * hidden, so the graph keeps the same shape whichever path executed and the
 * user can see what was skipped (§23).
 */
export function PipelineNodeCard({ node }: { node: PipelineViewNode }) {
  const Icon = STAGE_ICONS[node.key];
  const didNotRun =
    node.status === StageViewStatus.Pending || node.status === StageViewStatus.Skipped;
  const subtitle =
    node.provider && node.model ? `${node.provider} · ${node.model}` : node.phase;

  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      // Clips rather than spills into the next stacked card if content ever
      // runs longer than expected — the fixed height is a budget, not a hope.
      className="flex flex-col overflow-hidden"
    >
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <span className={cn("size-1.5 rounded-full", DOT_STYLES[node.status])} aria-hidden />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
          {node.branch ?? node.phase}
        </span>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col rounded-panel bg-surface p-4 shadow-card transition-opacity",
          didNotRun && "opacity-55",
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-foreground">
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-foreground">
              {node.label}
            </span>
            <span className="block truncate text-[11px] text-muted">{subtitle}</span>
          </span>
        </div>

        <div className="mt-3 flex-1 rounded-control bg-surface-raised p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
              {node.status === StageViewStatus.Failed ? "Reason" : "What happened"}
            </span>
            {node.durationMs > 0 && (
              <span className="shrink-0 text-[11px] text-muted">
                {formatDuration(node.durationMs)}
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-3 text-[12px] leading-[1.45] text-foreground">
            {node.detail || "—"}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              STAGE_STATUS_STYLES[node.status],
            )}
          >
            {STAGE_STATUS_LABELS[node.status]}
          </span>
          {node.usage && node.usage.total > 0 && (
            <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] text-muted">
              {node.usage.total.toLocaleString()} tokens
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
