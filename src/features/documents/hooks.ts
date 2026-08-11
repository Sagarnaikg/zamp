"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { reportError } from "@/lib/observability/report-error";
import { DocumentStatus, type CorrectableField } from "@/server/constants";
import { documentsApi } from "./api";

/**
 * The feature's public surface. Components import these and never touch the
 * query client, cache keys, or the API module directly.
 */

/**
 * A document only moves on its own while it is being read, so polling is
 * scoped to exactly that state — a finished document is immutable until the
 * user changes it, and polling it forever would be pure waste.
 *
 * The poll deliberately continues while the tab is backgrounded. React Query
 * pauses intervals on an unfocused page by default, and this app turns
 * `refetchOnWindowFocus` off globally (§28) — together those would leave a
 * user who tabbed away mid-ingestion staring at "Reading" forever. Processing
 * lasts seconds, so the cost of polling through it is negligible.
 */
const PROCESSING_POLL_MS = 2_000;

function pollWhileProcessing(status: string | undefined): number | false {
  return status === DocumentStatus.Processing ? PROCESSING_POLL_MS : false;
}

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents.list(),
    queryFn: ({ signal }) => documentsApi.list(signal),
    select: (data) => data.documents,
    refetchInterval: (query) =>
      query.state.data?.documents.some(
        (document) => document.status === DocumentStatus.Processing,
      )
        ? PROCESSING_POLL_MS
        : false,
    refetchIntervalInBackground: true,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id),
    queryFn: ({ signal }) => documentsApi.detail(id, signal),
    enabled: id.length > 0,
    refetchInterval: (query) =>
      pollWhileProcessing(query.state.data?.document.status),
    refetchIntervalInBackground: true,
  });
}

export function useDocumentPipeline(id: string) {
  return useQuery({
    queryKey: queryKeys.documents.pipeline(id),
    queryFn: ({ signal }) => documentsApi.pipeline(id, signal),
    enabled: id.length > 0,
    // The graph fills in stage by stage while ingestion runs.
    refetchInterval: (query) => pollWhileProcessing(query.state.data?.status),
    refetchIntervalInBackground: true,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (percent: number) => void;
    }) => documentsApi.upload(file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
    onError: (error) => reportError(error, "upload-document"),
  });
}

export function useCorrectFields(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changes: Partial<Record<CorrectableField, string | null>>) =>
      documentsApi.correct(id, changes),
    onSuccess: () => {
      // A correction rewrites confidence metadata too, so refetch rather than
      // patching the cache by hand and risking a stale badge.
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(id) });
    },
    onError: (error) => reportError(error, "correct-fields", { documentId: id }),
  });
}

export function useAcceptDocument(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => documentsApi.accept(id),
    onSuccess: () => {
      // Accepting moves the document into the ledger — both caches are stale.
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.ledger.all });
    },
    onError: (error) => reportError(error, "accept-document", { documentId: id }),
  });
}

export function useRejectDocument(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => documentsApi.reject(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.documents.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.list() });
    },
    onError: (error) => reportError(error, "reject-document", { documentId: id }),
  });
}
