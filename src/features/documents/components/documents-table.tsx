"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { FileEdit, Waypoints } from "lucide-react";
import { DocumentStatus } from "@/server/constants";
import { ReviewTab, ROUTES, STATUS_LABELS, STATUS_STYLES } from "@/constants";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import type { DocumentSummary } from "../types";

/**
 * Each row deep-links straight into the tab it names, rather than always
 * landing on "Extracted values" and making the user click again — the
 * pipeline icon is the point when what you actually want is to see why
 * something is still processing or got flagged.
 */
/** Stops a nested link's click from also firing the row's own navigation. */
function stopRowClick(event: MouseEvent) {
  event.stopPropagation();
}

function RowActions({ document }: { document: DocumentSummary }) {
  const processing = document.status === DocumentStatus.Processing;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={ROUTES.review(document.id, ReviewTab.Values)}
        onClick={stopRowClick}
        aria-label={`Review extracted values for ${document.filename}`}
        title="Extracted values"
        aria-disabled={processing || undefined}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-full text-muted transition-colors",
          "hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent",
          processing && "pointer-events-none opacity-40",
        )}
      >
        <FileEdit className="size-3.5" strokeWidth={1.75} aria-hidden />
      </Link>
      <Link
        href={ROUTES.review(document.id, ReviewTab.Pipeline)}
        onClick={stopRowClick}
        aria-label={`View extraction pipeline for ${document.filename}`}
        title="Extraction pipeline"
        className="inline-flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Waypoints className="size-3.5" strokeWidth={1.75} aria-hidden />
      </Link>
    </div>
  );
}

export function DocumentsTable({ documents }: { documents: DocumentSummary[] }) {
  const router = useRouter();

  return (
    <Table caption="Uploaded documents">
      <TableHead>
        <TableRow>
          <TableHeaderCell dense>File name</TableHeaderCell>
          <TableHeaderCell dense>Uploaded</TableHeaderCell>
          <TableHeaderCell dense>Status</TableHeaderCell>
          <TableHeaderCell dense numeric>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {documents.map((document) => {
          const status = document.status as DocumentStatus;
          const processing = status === DocumentStatus.Processing;

          return (
            <TableRow
              key={document.id}
              // A processing document has nothing to review yet — same reason
              // its filename below isn't a link either.
              onClick={
                processing
                  ? undefined
                  : () => router.push(ROUTES.review(document.id))
              }
            >
              <TableCell dense>
                {processing ? (
                  <span className="font-medium text-foreground">
                    {document.filename}
                  </span>
                ) : (
                  <Link
                    href={ROUTES.review(document.id)}
                    onClick={stopRowClick}
                    className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {document.filename}
                  </Link>
                )}
              </TableCell>
              <TableCell dense>{formatDate(document.createdAt.toString())}</TableCell>
              <TableCell dense>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                    STATUS_STYLES[status],
                  )}
                >
                  {STATUS_LABELS[status]}
                </span>
              </TableCell>
              <TableCell dense numeric>
                <RowActions document={document} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
