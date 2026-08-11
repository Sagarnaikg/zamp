"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { EMPTY_STATES, ROUTES } from "@/constants";
import { useLedger } from "@/features/ledger/hooks";
import { LedgerSummary } from "@/features/ledger/components/ledger-summary";
import { LedgerTable } from "@/features/ledger/components/ledger-table";

export default function LedgerPage() {
  const { data: rows, isPending, isError, error, refetch } = useLedger();

  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle="Every document you've reviewed and accepted."
      />

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
      ) : (
        <div className="space-y-5">
          <LedgerSummary rows={rows} />
          <LedgerTable rows={rows} />
        </div>
      )}
    </>
  );
}
