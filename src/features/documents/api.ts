import { api } from "@/lib/api/client";
import { uploadWithProgress } from "@/lib/api/upload";
import { API_ROUTES } from "@/constants";
import type { CorrectableField } from "@/server/constants";
import type {
  DocumentDetail,
  DocumentListResponse,
  DocumentPipeline,
  DocumentSummary,
  Extraction,
  IngestResponse,
} from "./types";

/**
 * Every documents endpoint, in one module. Hooks call these; components call
 * hooks. Nothing outside this file knows a URL shape (decisions.md §28).
 */
export const documentsApi = {
  list: (signal?: AbortSignal) =>
    api.get<DocumentListResponse>(API_ROUTES.documents, signal),

  detail: (id: string, signal?: AbortSignal) =>
    api.get<DocumentDetail>(API_ROUTES.document(id), signal),

  pipeline: (id: string, signal?: AbortSignal) =>
    api.get<DocumentPipeline>(API_ROUTES.documentPipeline(id), signal),

  upload: (file: File, onProgress?: (percent: number) => void) =>
    uploadWithProgress<IngestResponse>(API_ROUTES.documents, file, { onProgress }),

  correct: (id: string, changes: Partial<Record<CorrectableField, string | null>>) =>
    api.patch<{ extraction: Extraction; corrected: string[] }>(
      API_ROUTES.document(id),
      changes,
    ),

  accept: (id: string) =>
    api.post<{ document: DocumentSummary }>(API_ROUTES.documentAccept(id)),

  reject: (id: string) =>
    api.delete<{ rejected: string }>(API_ROUTES.document(id)),

  retry: (id: string) => api.post<IngestResponse>(API_ROUTES.documentRetry(id)),
};
