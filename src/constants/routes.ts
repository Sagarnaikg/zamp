import type { ReviewTab } from "./ui";

/** Every in-app path, so a route rename is one edit (decisions.md §27, §28). */
export const ROUTES = {
  home: "/",
  documents: "/documents",
  document: (id: string) => `/documents/${id}`,
  /** Deep-links to a specific tab, so a list row can jump straight to it. */
  review: (id: string, tab?: ReviewTab) =>
    tab ? `/documents/${id}/review?tab=${tab}` : `/documents/${id}/review`,
  /** Asking is part of the ledger, not a route of its own (§5). */
  ledger: "/ledger",
} as const;

/** Server endpoints, kept beside the page routes for the same reason. */
export const API_ROUTES = {
  documents: "/api/documents",
  document: (id: string) => `/api/documents/${id}`,
  documentFile: (id: string) => `/api/documents/${id}/file`,
  documentPipeline: (id: string) => `/api/documents/${id}/pipeline`,
  documentAccept: (id: string) => `/api/documents/${id}/accept`,
  documentRetry: (id: string) => `/api/documents/${id}/retry`,
  ledger: "/api/ledger",
  query: "/api/query",
  conversations: "/api/conversations",
  conversation: (id: string) => `/api/conversations/${id}`,
  status: "/api/status",
} as const;
