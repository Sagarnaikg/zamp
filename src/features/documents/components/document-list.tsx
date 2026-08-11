"use client";

import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { DocumentStatus } from "@/server/constants";
import { ROUTES, STATUS_LABELS, STATUS_STYLES } from "@/constants";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import type { DocumentSummary } from "../types";

/**
 * Documents as rows, newest work first. Each row leads to review — the only
 * thing a user wants to do with a document that hasn't been checked yet.
 */
export function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  return (
    <ul className="space-y-2.5">
      {documents.map((document) => {
        const status = document.status as DocumentStatus;
        const processing = status === DocumentStatus.Processing;

        return (
          <li key={document.id}>
            <Link
              href={ROUTES.review(document.id)}
              className={cn(
                "flex items-center gap-4 rounded-panel bg-surface px-5 py-4 transition-colors",
                "hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                processing && "pointer-events-none opacity-60",
              )}
              aria-disabled={processing || undefined}
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-muted">
                <FileText className="size-4" strokeWidth={1.75} aria-hidden />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {document.filename}
                </span>
                <span className="block text-[13px] text-muted">
                  {formatDate(document.createdAt.toString())}
                </span>
              </span>

              <span
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[12px] font-medium",
                  STATUS_STYLES[status],
                )}
              >
                {STATUS_LABELS[status]}
              </span>

              <ChevronRight
                className="size-4 shrink-0 text-subtle"
                strokeWidth={2}
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
