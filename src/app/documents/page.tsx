"use client";

import { FileStack } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EMPTY_STATES } from "@/constants";
import { useDocuments } from "@/features/documents/hooks";
import { UploadPanel } from "@/features/documents/components/upload-panel";
import { DocumentList } from "@/features/documents/components/document-list";

export default function DocumentsPage() {
  const { data: documents, isPending, isError, error, refetch } = useDocuments();

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Upload an invoice or receipt, then check what was read out of it."
      />

      <div className="space-y-5">
        <UploadPanel />

        {isPending ? (
          <SkeletonRows rows={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileStack}
            title={EMPTY_STATES.documents.title}
            body={EMPTY_STATES.documents.body}
          />
        ) : (
          <DocumentList documents={documents} />
        )}
      </div>
    </>
  );
}
