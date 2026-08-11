"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, ListChecks, Workflow } from "lucide-react";
import { DocumentStatus } from "@/server/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import {
  ACTIONS,
  ButtonVariant,
  ReviewTab,
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
import { PipelinePanel } from "@/features/documents/components/pipeline-panel";

const TABS = [
  { value: ReviewTab.Values, label: "Extracted values", icon: ListChecks },
  { value: ReviewTab.Pipeline, label: "How it was read", icon: Workflow },
];

/**
 * Review: the extracted values on the left, the document they came from on the
 * right. Side by side is the point — verifying a total against a scan is the
 * job, and making the user hold one in their head while looking at the other
 * is where trust breaks down.
 *
 * The pipeline graph sits behind a second tab. While a document is still being
 * read there are no values to check yet, so that tab opens first: it's the
 * only thing with anything to say.
 */
export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isPending, isError, error, refetch } = useDocument(id);
  const accept = useAcceptDocument(id);
  const reject = useRejectDocument(id);
  const [tab, setTab] = useState<ReviewTab | null>(null);

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
  const processing = status === DocumentStatus.Processing;

  // Accepting is only legal from needs_review (§9) — offering the button
  // otherwise guarantees a 409 the user can do nothing about.
  const canAccept = status === DocumentStatus.NeedsReview;
  const canReject = !processing;
  const actionError = accept.error ?? reject.error;

  // Until the user picks a tab, follow the document: a half-read document has
  // nothing to review yet, so show what the pipeline is doing instead.
  const activeTab = tab ?? (processing ? ReviewTab.Pipeline : ReviewTab.Values);

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
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium",
                STATUS_STYLES[status],
              )}
            >
              {processing && <Spinner className="size-3" />}
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
                  // Accepting is what puts a document in the ledger, so that's
                  // where it should land — the user gets to see it arrive.
                  accept.mutate(undefined, {
                    onSuccess: () => router.push(ROUTES.ledger),
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

      <div className="mb-5">
        <Tabs tabs={TABS} active={activeTab} onChange={setTab} idPrefix="review" />
      </div>

      <TabPanel value={ReviewTab.Values} active={activeTab} idPrefix="review">
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
                title={processing ? "Still reading this document" : "Nothing was extracted"}
                body={
                  processing
                    ? "Values appear here as soon as the pipeline finishes. The other tab shows what it's doing."
                    : "This document failed to process. Retry it from the documents list."
                }
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
      </TabPanel>

      <TabPanel value={ReviewTab.Pipeline} active={activeTab} idPrefix="review">
        <PipelinePanel documentId={id} />
      </TabPanel>
    </>
  );
}
