import {
  HTTP_STATUS,
  LLM_ERROR_MESSAGES,
  LlmErrorKind,
  RETRY,
  RETRYABLE_ERROR_KINDS,
} from "@/server/constants";

/**
 * Provider errors arrive as opaque strings with HTTP codes buried in them.
 * Users need two answers: is this my fault, and should I try again.
 */

export interface ClassifiedError {
  kind: LlmErrorKind;
  /** Safe to show a user; never contains keys or stack traces. */
  message: string;
  retryable: boolean;
}

const MAX_RAW_MESSAGE_CHARS = 200;

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

function statusOf(err: unknown): number | null {
  if (typeof err === "object" && err !== null) {
    for (const key of ["status", "statusCode", "code"]) {
      const value = (err as Record<string, unknown>)[key];
      const isHttpStatus =
        typeof value === "number" &&
        value >= HTTP_STATUS.badRequest &&
        value < 600;
      if (isHttpStatus) return value;
    }
  }
  // Providers commonly embed the code in the message: "[429 Too Many Requests]".
  const match = /\[(\d{3})[ \]]/.exec(messageOf(err));
  return match ? Number(match[1]) : null;
}

function classified(kind: LlmErrorKind, message: string): ClassifiedError {
  return { kind, message, retryable: RETRYABLE_ERROR_KINDS.includes(kind) };
}

/** A 429 that names a daily cap won't clear on retry. */
function isQuotaExhausted(lower: string): boolean {
  return (
    lower.includes("quota") &&
    (lower.includes("per day") ||
      lower.includes("daily") ||
      lower.includes("billing"))
  );
}

function isRateLimit(status: number | null, lower: string): boolean {
  return (
    status === HTTP_STATUS.tooManyRequests ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  );
}

function isAuthFailure(status: number | null, lower: string): boolean {
  return (
    status === HTTP_STATUS.unauthorized ||
    status === HTTP_STATUS.forbidden ||
    lower.includes("api key") ||
    lower.includes("unauthenticated")
  );
}

function isModelUnavailable(status: number | null, lower: string): boolean {
  return (
    status === HTTP_STATUS.notFound ||
    lower.includes("not found") ||
    lower.includes("does not support")
  );
}

function isTimeout(lower: string): boolean {
  return (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("etimedout")
  );
}

function isContentRejected(lower: string): boolean {
  return (
    lower.includes("safety") ||
    lower.includes("blocked") ||
    lower.includes("recitation")
  );
}

export function classifyLlmError(err: unknown): ClassifiedError {
  const raw = messageOf(err);
  const lower = raw.toLowerCase();
  const status = statusOf(err);

  if (isRateLimit(status, lower)) {
    return isQuotaExhausted(lower)
      ? classified(LlmErrorKind.QuotaExhausted, LLM_ERROR_MESSAGES.quotaExhausted)
      : classified(LlmErrorKind.RateLimited, LLM_ERROR_MESSAGES.rateLimited);
  }
  if (isAuthFailure(status, lower)) {
    return classified(LlmErrorKind.Auth, LLM_ERROR_MESSAGES.auth);
  }
  if (isModelUnavailable(status, lower)) {
    return classified(
      LlmErrorKind.ModelUnavailable,
      LLM_ERROR_MESSAGES.modelUnavailable,
    );
  }
  if (isTimeout(lower)) {
    return classified(LlmErrorKind.Timeout, LLM_ERROR_MESSAGES.timeout);
  }
  if (isContentRejected(lower)) {
    return classified(
      LlmErrorKind.ContentRejected,
      LLM_ERROR_MESSAGES.contentRejected,
    );
  }
  if (status !== null && status >= HTTP_STATUS.serverErrorFloor) {
    return classified(LlmErrorKind.ProviderDown, LLM_ERROR_MESSAGES.providerDown);
  }
  return classified(
    LlmErrorKind.Unknown,
    LLM_ERROR_MESSAGES.unknown(raw.slice(0, MAX_RAW_MESSAGE_CHARS)),
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry transient failures with exponential backoff and jitter. Certain
 * failures (bad key, missing model) throw immediately instead of burning
 * attempts on a certainty.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? RETRY.attempts;
  const baseDelay = opts.baseDelayMs ?? RETRY.baseDelayMs;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (!classifyLlmError(err).retryable || attempt === attempts) break;
      // Jitter avoids synchronized retries when several uploads fail at once.
      await sleep(baseDelay * 2 ** (attempt - 1) * (0.5 + Math.random()));
    }
  }
  throw lastError;
}
