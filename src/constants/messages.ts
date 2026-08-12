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
  uploadFailed: "Upload failed",
} as const;

export const SAMPLES = {
  prompt: "No invoice handy? Try a sample",
} as const;

export const ACTIONS = {
  retry: "Try again",
  accept: "Accept",
  acceptAnyway: "Accept anyway",
  reject: "Reject",
  save: "Save changes",
  cancel: "Cancel",
} as const;

export const REVIEW_CONFIRM = {
  title: "Still needs review",
  /** `fields` is the flagged labels, already joined into one clause. */
  body: (fields: string, plural: boolean) =>
    `${fields} still ${plural ? "need" : "needs"} review. Accepting won't fix that — it just puts the document in the ledger as-is. You can correct it later.`,
} as const;

export const A11Y = {
  skipToContent: "Skip to main content",
  primaryNavigation: "Primary",
  closeDialog: "Close dialog",
} as const;
