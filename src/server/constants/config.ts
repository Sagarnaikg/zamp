import {
  CorrectableField,
  ExtractionField,
  LlmErrorKind,
  MimeType,
  PipelineBranch,
  PipelinePhase,
  PipelineStageKey,
  Provider,
} from "./enums";

/** Provider API endpoints. */
export const PROVIDER_URLS = {
  [Provider.Google]: "https://generativelanguage.googleapis.com/v1beta/models",
  [Provider.OpenAI]: "https://api.openai.com/v1/models",
  [Provider.Anthropic]: "https://api.anthropic.com/v1/models",
} as const;

/** Environment variable holding each provider's API key. */
export const PROVIDER_KEY_VARS = {
  [Provider.Google]: "GOOGLE_API_KEY",
  [Provider.OpenAI]: "OPENAI_API_KEY",
  [Provider.Anthropic]: "ANTHROPIC_API_KEY",
} as const;

/** Preference order when several providers are configured. */
export const PROVIDER_ORDER = [
  Provider.Google,
  Provider.OpenAI,
  Provider.Anthropic,
] as const;

export const ANTHROPIC_API_VERSION = "2023-06-01";

export const MODEL_LIST_PAGE_SIZE = 200;
export const MODEL_LIST_LIMIT = 100;

export const UPLOAD = {
  maxBytes: 10 * 1024 * 1024,
  acceptedMimeTypes: [
    MimeType.Pdf,
    MimeType.Jpeg,
    MimeType.Png,
    MimeType.WebP,
  ] as readonly MimeType[],
} as const;

export const TIMEOUTS = {
  modelListMs: 15_000,
  /** Vercel Hobby caps at 60s; extraction runs synchronously in-request. */
  extractionRouteSeconds: 60,
  queryRouteSeconds: 30,
} as const;

export const RETRY = {
  attempts: 3,
  baseDelayMs: 1_000,
} as const;

/** Coarse confidence buckets — deliberately not fake precision. */
export const CONFIDENCE = {
  /** A checkable signal contradicts the value. */
  suspect: 0.3,
  /** Extracted and plausible, but nothing independently confirms it. */
  unverified: 0.7,
  /** One independent signal confirms it. */
  verified: 0.9,
  /** Two or more independent signals agree. */
  strong: 0.98,
  /** A human looked at it. */
  humanVerified: 1,
  /** Nothing was extracted. */
  missing: 0,
} as const;

/** Below this a field needs review; at or above it renders clean. */
export const REVIEW_THRESHOLD: number = CONFIDENCE.unverified;

export const EXTRACTION = {
  /** Long documents keep head and tail; the middle is rarely load-bearing. */
  maxTextChars: 24_000,
  /** Cents of drift allowed for per-line rounding on printed documents. */
  arithmeticToleranceCents: 2,
  /** Beyond this a document date is more likely misread than real. */
  maxDocumentAgeYears: 20,
  defaultAttachmentFilename: "document",
} as const;

export const QUERY = {
  maxQuestionLength: 500,
  /** A thread's title is its opening question, trimmed to stay list-friendly. */
  maxTitleLength: 60,
} as const;

export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  tooManyRequests: 429,
  serverErrorFloor: 500,
  serviceUnavailable: 503,
  badGateway: 502,
} as const;

/** Whether an error class is worth retrying unchanged. */
export const RETRYABLE_ERROR_KINDS: readonly LlmErrorKind[] = [
  LlmErrorKind.RateLimited,
  LlmErrorKind.Timeout,
  LlmErrorKind.ContentRejected,
  LlmErrorKind.ProviderDown,
  LlmErrorKind.Unknown,
];

export const WORKSPACE_COOKIE = "workspace_id";
export const WORKSPACE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const UPLOADS_DIRECTORY = "uploads";

export const IMAGE_MIME_PREFIX = "image/";

/** A correction's camelCase field maps to the extraction's snake_case field_meta key. */
export const CORRECTABLE_TO_EXTRACTION_FIELD: Record<
  CorrectableField,
  ExtractionField
> = {
  [CorrectableField.Vendor]: ExtractionField.Vendor,
  [CorrectableField.InvoiceNumber]: ExtractionField.InvoiceNumber,
  [CorrectableField.DocDate]: ExtractionField.DocDate,
  [CorrectableField.Currency]: ExtractionField.Currency,
  [CorrectableField.Subtotal]: ExtractionField.Subtotal,
  [CorrectableField.Tax]: ExtractionField.Tax,
  [CorrectableField.Total]: ExtractionField.Total,
  [CorrectableField.Category]: ExtractionField.Category,
};

export interface PipelineGraphNode {
  key: PipelineStageKey;
  label: string;
  phase: PipelinePhase;
  branch?: PipelineBranch;
  dependsOn: PipelineStageKey[];
}

/** Static shape of the ingestion pipeline; runtime results are merged onto this. */
export const PIPELINE_GRAPH_DEFINITION: PipelineGraphNode[] = [
  { key: PipelineStageKey.Store, label: "Store original", phase: PipelinePhase.Intake, dependsOn: [] },
  { key: PipelineStageKey.Detect, label: "Detect document type", phase: PipelinePhase.Intake, dependsOn: [PipelineStageKey.Store] },
  { key: PipelineStageKey.Extract, label: "First reading", phase: PipelinePhase.Reading, dependsOn: [PipelineStageKey.Detect] },
  { key: PipelineStageKey.Validate, label: "Validate", phase: PipelinePhase.Verification, branch: PipelineBranch.Checks, dependsOn: [PipelineStageKey.Extract] },
  { key: PipelineStageKey.SecondReading, label: "Second reading", phase: PipelinePhase.Verification, branch: PipelineBranch.Checks, dependsOn: [PipelineStageKey.Validate] },
  { key: PipelineStageKey.Compare, label: "Compare readings", phase: PipelinePhase.Verification, branch: PipelineBranch.Checks, dependsOn: [PipelineStageKey.SecondReading] },
  { key: PipelineStageKey.Tiebreak, label: "Focused re-read", phase: PipelinePhase.Verification, branch: PipelineBranch.Checks, dependsOn: [PipelineStageKey.Compare] },
  { key: PipelineStageKey.Duplicates, label: "Duplicate check", phase: PipelinePhase.Verification, branch: PipelineBranch.History, dependsOn: [PipelineStageKey.Extract] },
  { key: PipelineStageKey.Score, label: "Score confidence", phase: PipelinePhase.Decision, dependsOn: [PipelineStageKey.Tiebreak, PipelineStageKey.Duplicates] },
];
