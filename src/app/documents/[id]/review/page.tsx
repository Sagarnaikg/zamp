"use client";

import { useParams, useRouter } from "next/navigation";
import { FileText, ListChecks } from "lucide-react";
import { DocumentStatus } from "@/server/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ACTIONS,
  ButtonVariant,
  ROUTES,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/constants";
import { cn } from "@/lib/utils/cn";
import {
  useAcceptDocument,
  useDocument,
  useRejectDocument,
} from "@/features/documents/hooks";
import { ReviewForm } from "@/features/documents/components/review-form";
import { DocumentPreview } from "@/features/documents/components/document-preview";
import { ExtractionExtras } from "@/features/documents/components/extraction-extras";

/**
 * Review: the extracted values on the left, the document they came from on the
 * right. Side by side is the point — verifying a total against a scan is the
 * job, and making the user hold one in their head while looking at the other
 * is where trust breaks down.
 */
export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isPending, isError, error, refetch } = useDocument(id);
  const accept = useAcceptDocument(id);
  const reject = useRejectDocument(id);

  if (isPending) {
    return (
      <>
        <PageHeader title="Review" back={{ href: ROUTES.documents, label: "Documents" }} />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-150 rounded-card" />
          <Skeleton className="h-150 rounded-card" />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Review" back={{ href: ROUTES.documents, label: "Documents" }} />
        <ErrorState error={error} onRetry={() => refetch()} />
      </>
    );
  }

  const { document, extraction, lineItems, auditLog } = data;
  const status = document.status as DocumentStatus;

  // Accepting is only legal from needs_review (§9) — offering the button
  // otherwise guarantees a 409 the user can do nothing about.
  const canAccept = status === DocumentStatus.NeedsReview;
  const canReject = status !== DocumentStatus.Processing;
  const actionError = accept.error ?? reject.error;

  return (
    <>
      <PageHeader
        back={{ href: ROUTES.documents, label: "Documents" }}
        title="Review document"
        subtitle={document.filename}
        actions={
          <>
            <span
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium",
                STATUS_STYLES[status],
              )}
            >
              {STATUS_LABELS[status]}
            </span>
            {canReject && (
              <Button
                variant={ButtonVariant.Secondary}
                loading={reject.isPending}
                // mutate, not mutateAsync: a rejected promise here would be
                // unhandled and crash the page instead of showing the reason.
                onClick={() =>
                  reject.mutate(undefined, {
                    onSuccess: () => router.push(ROUTES.documents),
                  })
                }
              >
                {ACTIONS.reject}
              </Button>
            )}
            {canAccept && (
              <Button
                loading={accept.isPending}
                onClick={() =>
                  accept.mutate(undefined, {
                    onSuccess: () => router.push(ROUTES.documents),
                  })
                }
              >
                {ACTIONS.accept}
              </Button>
            )}
          </>
        }
      />

      {actionError && (
        <div
          role="alert"
          className="mb-5 rounded-panel bg-danger/10 px-5 py-4 text-[13px] text-danger"
        >
          {actionError instanceof Error
            ? actionError.message
            : "That action didn't go through."}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-6 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-raised">
              <ListChecks className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="text-sm font-semibold text-foreground">Extracted values</h2>
          </div>

          {extraction ? (
            <ReviewForm documentId={id} extraction={extraction} />
          ) : (
            <EmptyState
              title="Nothing was extracted"
              body="This document failed to process. Retry it from the documents list."
            />
          )}
        </Card>

        <Card className="p-6 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-raised">
              <FileText className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="text-sm font-semibold text-foreground">Original document</h2>
          </div>
          <DocumentPreview
            documentId={id}
            filename={document.filename}
            mimeType={document.mimeType}
          />
        </Card>
      </div>

      {extraction && (
        <ExtractionExtras
          extraction={extraction}
          lineItems={lineItems}
          auditLog={auditLog}
        />
      )}
    </>
  );
}
