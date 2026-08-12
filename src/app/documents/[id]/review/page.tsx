"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FileEdit, FileText, Waypoints } from "lucide-react";
import { DocumentStatus } from "@/server/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import {
  ACTIONS,
  ButtonVariant,
  ConfidenceLevel,
  confidenceLevelOf,
  REJECT_CONFIRM,
  REVIEW_CONFIRM,
  ReviewTab,
  ROUTES,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/constants";
import { CORRECTABLE_TO_EXTRACTION_FIELD } from "@/server/constants";
import { cn } from "@/lib/utils/cn";
import { joinList } from "@/lib/utils/format";
import {
  useAcceptDocument,
  useDocument,
  useRejectDocument,
} from "@/features/documents/hooks";
import { ReviewForm } from "@/features/documents/components/review-form";
import { REVIEW_FIELDS } from "@/features/documents/review-fields";
import { DocumentPreview } from "@/features/documents/components/document-preview";
import { ExtraFields } from "@/features/documents/components/extra-fields";
import { AuditTrail } from "@/features/documents/components/audit-trail";
import { PipelinePanel } from "@/features/documents/components/pipeline-panel";

/** Levels the badge renders as a flag rather than a green light — the ones
 * worth a second thought before this document goes in the ledger as-is. */
const FLAGGED_LEVELS: ConfidenceLevel[] = [ConfidenceLevel.Suspect, ConfidenceLevel.Missing];

const TABS = [
  { value: ReviewTab.Values, label: "Extracted values", icon: FileEdit },
  { value: ReviewTab.Pipeline, label: "Extraction pipeline", icon: Waypoints },
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
  const searchParams = useSearchParams();

  const { data, isPending, isError, error, refetch } = useDocument(id);
  const accept = useAcceptDocument(id);
  const reject = useRejectDocument(id);

  // A document row can deep-link straight to a tab (?tab=pipeline); once the
  // user picks one by hand that always wins over the link they arrived on.
  const linkedTab = searchParams.get("tab");
  const initialTab =
    linkedTab === ReviewTab.Pipeline || linkedTab === ReviewTab.Values
      ? linkedTab
      : null;
  const [tab, setTab] = useState<ReviewTab | null>(initialTab);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

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

  const { document, extraction, auditLog } = data;
  const status = document.status as DocumentStatus;
  const processing = status === DocumentStatus.Processing;

  // Accepting is only legal from needs_review (§9) — offering the button
  // otherwise guarantees a 409 the user can do nothing about.
  const canAccept = status === DocumentStatus.NeedsReview;
  const canReject = !processing;
  const actionError = accept.error ?? reject.error;

  // Confidence flags exist to be looked at before the document goes in the
  // ledger — accepting straight past one silently defeats the point of
  // flagging it, so this is confirmed rather than blocked (§8).
  const flaggedLabels = extraction
    ? REVIEW_FIELDS.filter(({ field }) => {
        const meta = extraction.fieldMeta[CORRECTABLE_TO_EXTRACTION_FIELD[field]];
        return meta && FLAGGED_LEVELS.includes(confidenceLevelOf(meta.confidence));
      }).map(({ label }) => label)
    : [];

  function acceptNow() {
    setConfirmOpen(false);
    // Accepting is what puts a document in the ledger, so that's where it
    // should land — the user gets to see it arrive.
    accept.mutate(undefined, { onSuccess: () => router.push(ROUTES.ledger) });
  }

  function handleAcceptClick() {
    if (flaggedLabels.length > 0) {
      setConfirmOpen(true);
    } else {
      acceptNow();
    }
  }

  function rejectNow() {
    setRejectConfirmOpen(false);
    // mutate, not mutateAsync: a rejected promise here would be unhandled and
    // crash the page instead of showing the reason.
    reject.mutate(undefined, { onSuccess: () => router.push(ROUTES.documents) });
  }

  // Until the user picks a tab, follow the document: a half-read document has
  // nothing to review yet, so show what the pipeline is doing instead.
  const activeTab = tab ?? (processing ? ReviewTab.Pipeline : ReviewTab.Values);

  return (
    <>
      <PageHeader
        back={{ href: ROUTES.documents, label: "Documents" }}
        title="Review document"
        subtitle={document.filename}
        titleBadge={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium",
              STATUS_STYLES[status],
            )}
          >
            {processing && <Spinner className="size-3" />}
            {STATUS_LABELS[status]}
          </span>
        }
        actions={
          <>
            {canReject && (
              <Button
                variant={ButtonVariant.Secondary}
                loading={reject.isPending}
                onClick={() => setRejectConfirmOpen(true)}
              >
                {ACTIONS.reject}
              </Button>
            )}
            {canAccept && (
              <Button loading={accept.isPending} onClick={handleAcceptClick}>
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
                <FileEdit className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <h2 className="text-sm font-semibold text-foreground">Extracted values</h2>
            </div>

            {extraction ? (
              <ReviewForm documentId={id} extraction={extraction}>
                {extraction.extraFields.length > 0 && (
                  <ExtraFields fields={extraction.extraFields} />
                )}
              </ReviewForm>
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

        <AuditTrail entries={auditLog} />
      </TabPanel>

      <TabPanel value={ReviewTab.Pipeline} active={activeTab} idPrefix="review">
        <PipelinePanel documentId={id} />
      </TabPanel>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={REVIEW_CONFIRM.title}>
        <p className="text-[13px] text-foreground">
          {REVIEW_CONFIRM.body(joinList(flaggedLabels), flaggedLabels.length > 1)}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant={ButtonVariant.Secondary} onClick={() => setConfirmOpen(false)}>
            {ACTIONS.cancel}
          </Button>
          <Button loading={accept.isPending} onClick={acceptNow}>
            {ACTIONS.acceptAnyway}
          </Button>
        </div>
      </Modal>

      <Modal
        open={rejectConfirmOpen}
        onClose={() => setRejectConfirmOpen(false)}
        title={REJECT_CONFIRM.title}
      >
        <p className="text-[13px] text-foreground">{REJECT_CONFIRM.body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant={ButtonVariant.Secondary} onClick={() => setRejectConfirmOpen(false)}>
            {ACTIONS.cancel}
          </Button>
          <Button variant={ButtonVariant.Danger} loading={reject.isPending} onClick={rejectNow}>
            {ACTIONS.reject}
          </Button>
        </div>
      </Modal>
    </>
  );
}
