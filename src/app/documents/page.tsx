"use client";

import { useState } from "react";
import { FileStack, SearchX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EMPTY_STATES } from "@/constants";
import { useDocuments } from "@/features/documents/hooks";
import { UploadPanel } from "@/features/documents/components/upload-panel";
import { DocumentFiltersBar } from "@/features/documents/components/document-filters-bar";
import { DocumentsTable } from "@/features/documents/components/documents-table";
import {
  defaultFilters,
  filterDocuments,
  type DocumentFilters,
} from "@/features/documents/document-filters";
import {
  DOCUMENTS_PAGE_SIZE,
  pageCount,
  paginate,
  rangeLabel,
} from "@/features/documents/pagination";

export default function DocumentsPage() {
  const { data: documents, isPending, isError, error, refetch } = useDocuments();
  const [filters, setFilters] = useState<DocumentFilters>(defaultFilters);
  const [page, setPage] = useState(1);

  // A new filter can easily leave the current page past the end of the
  // (now shorter) result set — back to page 1 whenever what's filtered for changes.
  function handleFiltersChange(next: DocumentFilters) {
    setFilters(next);
    setPage(1);
  }

  const filtered = documents ? filterDocuments(documents, filters) : [];
  const totalPages = pageCount(filtered.length, DOCUMENTS_PAGE_SIZE);
  const paged = paginate(filtered, page, DOCUMENTS_PAGE_SIZE);

  return (
    <>
      <PageHeader title="Documents" />

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
          <div className="space-y-3">
            <h2 className="px-1 text-[13px] font-semibold text-foreground">
              Uploaded documents
            </h2>
            <DocumentFiltersBar
              filters={filters}
              defaultFilters={defaultFilters}
              onChange={handleFiltersChange}
              resultCount={filtered.length}
            />

            {filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No documents match those filters"
                body="Try a different filename, status, or date range."
              />
            ) : (
              <>
                <DocumentsTable documents={paged} />
                <Pagination
                  page={page}
                  pageCount={totalPages}
                  onPageChange={setPage}
                  rangeLabel={rangeLabel(page, DOCUMENTS_PAGE_SIZE, filtered.length)}
                />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
