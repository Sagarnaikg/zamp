/** Client-facing copy. Server-generated messages stay in `@/server/constants`. */

export const EMPTY_STATES = {
  documents: {
    title: "No documents yet",
    body: "Upload an invoice or receipt and it will be read, checked, and scored here.",
  },
  ledger: {
    title: "Your ledger is empty",
    body: "Documents appear here once you've reviewed and accepted them.",
  },
  queryResults: {
    title: "No matching documents",
    body: "Nothing in your ledger matches that question. Try widening the date range or vendor.",
  },
  auditLog: {
    title: "No changes yet",
    body: "Corrections you make during review are recorded here.",
  },
} as const;

export const ERROR_STATES = {
  generic: {
    title: "Something went wrong",
    body: "This is on us, not your document. Try again in a moment.",
  },
  network: {
    title: "Can't reach the server",
    body: "Check your connection and try again.",
  },
  notFound: {
    title: "Not found",
    body: "This document doesn't exist, or it belongs to another workspace.",
  },
} as const;

export const ACTIONS = {
  retry: "Try again",
  upload: "Upload document",
  accept: "Accept",
  reject: "Reject",
  save: "Save changes",
  cancel: "Cancel",
  close: "Close",
} as const;

export const LOADING = {
  documents: "Loading documents",
  extraction: "Reading your document",
  query: "Working out what you asked",
} as const;

export const A11Y = {
  skipToContent: "Skip to main content",
  primaryNavigation: "Primary",
  closeDialog: "Close dialog",
  uploadProgress: (filename: string, percent: number) =>
    `Uploading ${filename}, ${percent} percent complete`,
} as const;
