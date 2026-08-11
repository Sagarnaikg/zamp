import { CONFIDENCE, DocumentStatus } from "@/server/constants";

/** Visual weight of a confidence score — the product's core visual language. */
export enum ConfidenceLevel {
  Missing = "missing",
  Suspect = "suspect",
  Unverified = "unverified",
  Verified = "verified",
  Strong = "strong",
  HumanVerified = "human_verified",
}

/**
 * Maps a raw score onto the bucket the UI renders. Thresholds come from the
 * server's buckets so the two never drift apart.
 */
export function confidenceLevelOf(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE.humanVerified) return ConfidenceLevel.HumanVerified;
  if (score >= CONFIDENCE.strong) return ConfidenceLevel.Strong;
  if (score >= CONFIDENCE.verified) return ConfidenceLevel.Verified;
  if (score > CONFIDENCE.suspect) return ConfidenceLevel.Unverified;
  if (score > CONFIDENCE.missing) return ConfidenceLevel.Suspect;
  return ConfidenceLevel.Missing;
}

/** Tailwind classes per level, resolved through semantic tokens in globals.css. */
export const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.HumanVerified]: "text-confidence-human bg-confidence-human/10",
  [ConfidenceLevel.Strong]: "text-confidence-strong bg-confidence-strong/10",
  [ConfidenceLevel.Verified]: "text-confidence-verified bg-confidence-verified/10",
  [ConfidenceLevel.Unverified]: "text-confidence-unverified bg-confidence-unverified/10",
  [ConfidenceLevel.Suspect]: "text-confidence-suspect bg-confidence-suspect/10",
  [ConfidenceLevel.Missing]: "text-muted bg-surface-raised",
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.HumanVerified]: "You confirmed this",
  [ConfidenceLevel.Strong]: "Strongly verified",
  [ConfidenceLevel.Verified]: "Verified",
  [ConfidenceLevel.Unverified]: "Unverified",
  [ConfidenceLevel.Suspect]: "Needs your attention",
  [ConfidenceLevel.Missing]: "Not found",
};

/** Status wording aimed at what the user should do, not the internal state name. */
export const STATUS_LABELS: Record<DocumentStatus, string> = {
  [DocumentStatus.Processing]: "Reading",
  [DocumentStatus.NeedsReview]: "Needs review",
  [DocumentStatus.Accepted]: "Accepted",
  [DocumentStatus.Failed]: "Failed",
};

export const STATUS_STYLES: Record<DocumentStatus, string> = {
  [DocumentStatus.Processing]: "bg-surface-raised text-muted",
  [DocumentStatus.NeedsReview]: "bg-confidence-unverified/10 text-confidence-unverified",
  [DocumentStatus.Accepted]: "bg-confidence-strong/10 text-confidence-strong",
  [DocumentStatus.Failed]: "bg-danger/10 text-danger",
};

export enum ButtonVariant {
  Primary = "primary",
  Secondary = "secondary",
  Ghost = "ghost",
  Danger = "danger",
}

export enum ButtonSize {
  Small = "sm",
  Medium = "md",
}

/** Upload lifecycle, owned by the client — the server only sees the final POST. */
export enum UploadStatus {
  Queued = "queued",
  Uploading = "uploading",
  Processing = "processing",
  Done = "done",
  Failed = "failed",
}
