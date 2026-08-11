import { PROVIDER_KEY_VARS, EXTRACTION } from "./config";

/** User-facing strings. Kept together so wording is reviewable in one place. */

export const SETUP_MESSAGES = {
  noKeyConfigured: `No LLM API key found. Add one of ${Object.values(PROVIDER_KEY_VARS).join(", ")} to .env, then restart.`,
  noUsableModel: (keyVars: string) =>
    `Found ${keyVars}, but no usable model could be reached. The key may be invalid or revoked, or the account may not have access to any chat model.`,
  noProviderConfigured: "No usable LLM provider configured.",
  databaseUrlMissing:
    "DATABASE_URL is not set. Add it to .env — see the quick start in README.md.",
} as const;

export const LLM_ERROR_MESSAGES = {
  rateLimited:
    "The AI provider is rate-limiting requests right now. Wait a moment and retry this document.",
  quotaExhausted:
    "The AI provider's usage quota is exhausted. Extraction will work again once the quota resets, or after adding billing to the provider account.",
  auth: "The AI provider rejected the API key. Check the provider key in your .env file.",
  modelUnavailable:
    "The configured AI model isn't available for this API key. This is a configuration problem, not a problem with your document.",
  timeout:
    "The AI provider took too long to respond. This is usually temporary — retry this document.",
  contentRejected:
    "The AI provider declined to process this document's content. If it's a normal invoice or receipt, retrying may work.",
  providerDown:
    "The AI provider had a server error. This is temporary — retry this document.",
  unknown: (detail: string) => `Extraction failed: ${detail}`,
  noExtractionResult: "No extraction result returned",
} as const;

export const API_MESSAGES = {
  missingFile: "Attach a file under the 'file' form field.",
  unsupportedFileType: (type: string, accepted: string) =>
    `Unsupported file type "${type}". Accepted: ${accepted}.`,
  fileTooLarge: (sizeMb: string, limitMb: number) =>
    `File is ${sizeMb}MB — the limit is ${limitMb}MB.`,
  documentNotFound: "Document not found",
  notAcceptable: "Document not found or not in needs_review state",
  invalidCorrectionBody: "Send a JSON object of field → new value.",
  notCorrectable: (fields: string) => `Not correctable: ${fields}`,
  missingQuestion: "Send { question: string }.",
  questionTooLong: (max: number) =>
    `Question is too long (${max} characters max).`,
  noWorkspaceCookie: "No workspace cookie present",
  invalidStorageKey: (key: string) => `Invalid storage key: ${key}`,
} as const;

export const FIELD_REASONS = {
  notFound: "Not found in the document",
  correctedByUser: "Corrected by you",
} as const;

export const PIPELINE_DETAILS = {
  stored: (name: string, kb: string, target: string) =>
    `${name} (${kb} KB) saved to ${target}`,
  storageBlob: "blob storage",
  storageDisk: "local disk",
  readTextLayer: "Read the PDF's text layer",
  readVisually: "Read the document visually",
  secondReadingSameProvider:
    "Same provider, different model and input format — an independent look",
  secondReadingCrossProvider: (provider: string) =>
    `Independent reading from a different provider (${provider})`,
  secondReadingFailed:
    "Second reading failed; relying on the remaining signals",
  secondReadingSkipped:
    "Skipped — the document's own arithmetic reconciles and the text layer is exact, so a second opinion would add cost without adding evidence",
  readingsAgree: "Both readings agree on every field",
  readingsDisagree: (fields: string) => `Readings disagree on: ${fields}`,
  compareSkipped: "Nothing to compare — only one reading was taken",
  tiebreakCorrected: (fields: string, corrected: string) =>
    `Re-read ${fields} on their own. Majority vote corrected: ${corrected}`,
  tiebreakKept: (fields: string) =>
    `Re-read ${fields} on their own. Majority vote kept the first reading`,
  tiebreakFailed: "Focused re-read failed; disputed fields go to review",
  tiebreakNotNeeded: "Not needed — the readings already agree",
  tiebreakNotApplicable: "Not applicable — only one reading was taken",
  duplicateFound: "Matches a document already in this workspace",
  duplicateNone: (count: number) =>
    `Compared against ${count} existing document${count === 1 ? "" : "s"} — no match`,
  scoreClean: "Every field passed — nothing needs your attention",
  scoreFlagged: (count: number) =>
    `${count} field${count === 1 ? "" : "s"} flagged for review`,
  validated: (corroborated: number, contradicted: number) =>
    contradicted > 0
      ? `${corroborated} field${corroborated === 1 ? "" : "s"} corroborated by arithmetic and format checks, ${contradicted} contradicted`
      : `${corroborated} field${corroborated === 1 ? "" : "s"} corroborated by arithmetic and format checks`,
} as const;

export const FILE_KIND_DETAILS = {
  digital_pdf: "Digital PDF — has a text layer, so the text can be read exactly",
  scanned_pdf: "Scanned PDF — no text layer, needs a vision model",
  image: "Image — needs a vision model",
} as const;

export const EXTRACTION_PROMPT = `You are extracting structured data from an invoice, receipt, or expense document.

Rules:
- Extract only what is actually present. Use null for any field you cannot read or that is absent — never guess or invent values.
- Copy numbers exactly as printed, even if the document's own arithmetic looks wrong. Do not "fix" totals.
- doc_date must be YYYY-MM-DD. If the date format is ambiguous (e.g. 03/04/2025), use surrounding context (written month names, due dates, locale hints) to disambiguate; if still ambiguous, pick the more likely reading.
- currency: infer from symbols/context (₹ → INR, $ → USD unless context says otherwise, € → EUR).
- category: pick the closest match for what was purchased.
- extra_fields: capture ALL other labeled data on the document (PO numbers, due dates, payment terms, tax IDs, addresses, reference numbers). Nothing legible should be lost — if it has a label and a value, include it. Give each a normalized snake_case key: the same concept always gets the same key ("PO No" and "Purchase Order Number" are both po_number).`;

const FOCUSED_FIELD_RULES = `- doc_date must be YYYY-MM-DD. If the date format is ambiguous (e.g. 03/04/2025), use surrounding context (written month names, due dates, locale hints) to disambiguate; if still ambiguous, pick the more likely reading.
- currency: infer from symbols/context (₹ → INR, $ → USD unless context says otherwise, € → EUR).
- Copy numbers exactly as printed, even if the document's own arithmetic looks wrong. Do not "fix" totals.`;

export const FOCUSED_PROMPT = `You are double-checking specific fields on an invoice, receipt, or expense document.

Read the document carefully and report ONLY the fields requested below. These values are being verified because an earlier reading was uncertain, so accuracy matters more than speed:
- Look at the actual characters on the page. Digits that look similar (0/8, 1/7, 3/8, 5/6) are the usual source of error.
- Use null if a field genuinely is not on the document. Do not guess.
${FOCUSED_FIELD_RULES}`;

export const TEXT_OMITTED_MARKER = (omitted: number) =>
  `\n\n[... ${omitted} characters omitted ...]\n\n`;

export const MAX_TEXT_CHARS = EXTRACTION.maxTextChars;
