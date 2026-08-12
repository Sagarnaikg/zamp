"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** e.g. "11–20 of 43" — the range actually shown, more useful than the bare page number. */
  rangeLabel: string;
}

/** Prev/next pager. No page-number buttons — for the list sizes this app deals with, "page 3 of 5" is all a user needs to orient. */
export function Pagination({ page, pageCount, onPageChange, rangeLabel }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-[13px] text-muted">{rangeLabel}</p>
      <div className="flex items-center gap-1 rounded-full bg-surface-raised p-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
        </button>
        <span
          aria-live="polite"
          className="min-w-20 text-center text-[13px] font-medium tabular-nums text-foreground"
        >
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
