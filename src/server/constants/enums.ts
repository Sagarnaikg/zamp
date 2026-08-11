/** String enums: compile-time safety, with the string value used on the wire. */

export enum Provider {
  Google = "google",
  OpenAI = "openai",
  Anthropic = "anthropic",
}

export enum DocumentStatus {
  Processing = "processing",
  NeedsReview = "needs_review",
  Accepted = "accepted",
  Failed = "failed",
}

export enum FileKind {
  DigitalPdf = "digital_pdf",
  ScannedPdf = "scanned_pdf",
  Image = "image",
}

export enum MimeType {
  Pdf = "application/pdf",
  Jpeg = "image/jpeg",
  Png = "image/png",
  WebP = "image/webp",
}

/** What a model call is for — decides which tier the router picks. */
export enum LlmTask {
  ExtractVision = "extract_vision",
  ExtractText = "extract_text",
  SecondOpinion = "second_opinion",
  QueryTranslate = "query_translate",
}

export enum LlmErrorKind {
  RateLimited = "rate_limited",
  QuotaExhausted = "quota_exhausted",
  Auth = "auth",
  ModelUnavailable = "model_unavailable",
  Timeout = "timeout",
  ContentRejected = "content_rejected",
  ProviderDown = "provider_down",
  Unknown = "unknown",
}

/** A signal's verdict about one field. */
export enum FindingKind {
  Confirm = "confirm",
  Suspect = "suspect",
  Missing = "missing",
}

export enum DisputeOutcome {
  Resolved = "resolved",
  Unresolved = "unresolved",
  Abstained = "abstained",
}

/** Fields carrying a confidence score. Also the JSON keys of `field_meta`. */
export enum ExtractionField {
  Vendor = "vendor",
  InvoiceNumber = "invoice_number",
  DocDate = "doc_date",
  Currency = "currency",
  Subtotal = "subtotal",
  Tax = "tax",
  Total = "total",
  Category = "category",
  LineItems = "line_items",
  Duplicate = "duplicate",
}

/** Fields a human may correct in review — camelCase, matching DB columns. */
export enum CorrectableField {
  Vendor = "vendor",
  InvoiceNumber = "invoiceNumber",
  DocDate = "docDate",
  Currency = "currency",
  Subtotal = "subtotal",
  Tax = "tax",
  Total = "total",
  Category = "category",
}

export enum ExpenseCategory {
  Software = "software",
  Hardware = "hardware",
  Travel = "travel",
  Meals = "meals",
  OfficeSupplies = "office_supplies",
  Utilities = "utilities",
  ProfessionalServices = "professional_services",
  Marketing = "marketing",
  Rent = "rent",
  Other = "other",
}

/** Fields the NL query layer may filter on. */
export enum QueryField {
  Vendor = "vendor",
  Category = "category",
  Currency = "currency",
  InvoiceNumber = "invoice_number",
  DocDate = "doc_date",
  Total = "total",
  Extra = "extra",
}

export enum QueryOperator {
  Eq = "eq",
  Contains = "contains",
  Gte = "gte",
  Lte = "lte",
  Exists = "exists",
}

export enum QueryAggregate {
  SumTotal = "sum_total",
  Count = "count",
  AvgTotal = "avg_total",
  None = "none",
}

export enum PipelineStageKey {
  Store = "store",
  Detect = "detect",
  Extract = "extract",
  Validate = "validate",
  SecondReading = "second_reading",
  Compare = "compare",
  Tiebreak = "tiebreak",
  Duplicates = "duplicates",
  Score = "score",
}

export enum PipelinePhase {
  Intake = "Intake",
  Reading = "Reading",
  Verification = "Verification",
  Decision = "Decision",
}

export enum PipelineBranch {
  Checks = "Checks",
  History = "History",
}

/** A status a stage reports while running. */
export enum StageStatus {
  Ok = "ok",
  Skipped = "skipped",
  Failed = "failed",
}

/** Adds the view-only state for nodes that never reported. */
export enum StageViewStatus {
  Ok = "ok",
  Skipped = "skipped",
  Failed = "failed",
  Pending = "pending",
}

export enum SensitiveKind {
  Card = "card",
  Iban = "iban",
}
