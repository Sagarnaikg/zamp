"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { reportError } from "@/lib/observability/report-error";
import type { CorrectableField } from "@/server/constants";
import { documentsApi } from "./api";

/**
 * The feature's public surface. Components import these and never touch the
 * query client, cache keys, or the API module directly.
 */

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents.list(),
    queryFn: ({ signal }) => documentsApi.list(signal),
    select: (data) => data.documents,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id),
    queryFn: ({ signal }) => documentsApi.detail(id, signal),
    enabled: id.length > 0,
  });
}

export function useDocumentPipeline(id: string) {
  return useQuery({
    queryKey: queryKeys.documents.pipeline(id),
    queryFn: ({ signal }) => documentsApi.pipeline(id, signal),
    enabled: id.length > 0,
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
