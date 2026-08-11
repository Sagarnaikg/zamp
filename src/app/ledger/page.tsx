"use client";

import { BookOpen, X } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { ButtonSize, ButtonVariant, EMPTY_STATES, ROUTES } from "@/constants";
import { features } from "@/config/features";
import { useLedger } from "@/features/ledger/hooks";
import { useAskLedger } from "@/features/ledger/hooks";
import { AskForm } from "@/features/ledger/components/ask-form";
import { LedgerSummary } from "@/features/ledger/components/ledger-summary";
import { LedgerTable } from "@/features/ledger/components/ledger-table";
import { QueryResult } from "@/features/ledger/components/query-result";

/**
 * The ledger and the question box are one page (decisions.md §5): the whole
 * reason for pairing natural language with a structured table is that the
 * table is the ground truth a user checks the interpretation against. Split
 * across two routes, asking a question meant losing sight of the data it was
 * asked about.
 *
 * Asking narrows what's shown rather than navigating away, so the answer and
 * the rows behind it stay on screen together.
 */
export default function LedgerPage() {
  const { data: rows, isPending, isError, error, refetch } = useLedger();
  const ask = useAskLedger();

  const asking = ask.isPending;
  const answered = ask.data !== undefined;

  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle="Every document you've reviewed and accepted."
      />

      <div className="space-y-6">
        {features.naturalLanguageQuery && rows && rows.length > 0 && (
          <AskForm onAsk={(question) => ask.mutate(question)} pending={asking} />
        )}

        {isPending ? (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <Skeleton className="h-28 rounded-card" />
              <Skeleton className="h-28 rounded-card" />
              <Skeleton className="h-28 rounded-card" />
            </div>
            <SkeletonRows rows={4} />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={EMPTY_STATES.ledger.title}
            body={EMPTY_STATES.ledger.body}
            action={
              <Link
                href={ROUTES.documents}
                className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Go to documents
              </Link>
            }
          />
        ) : asking ? (
          <SkeletonRows rows={3} />
        ) : ask.isError ? (
          <ErrorState error={ask.error} onRetry={() => ask.reset()} />
        ) : answered ? (
          <QueryResult
            result={ask.data}
            onClear={
              <Button
                variant={ButtonVariant.Ghost}
                size={ButtonSize.Small}
                onClick={() => ask.reset()}
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden />
                Show all
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            <LedgerSummary rows={rows} />
            <LedgerTable rows={rows} />
          </div>
        )}
      </div>
    </>
  );
}
