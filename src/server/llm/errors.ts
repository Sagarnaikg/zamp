/**
 * Provider errors arrive as opaque strings with HTTP codes buried in them.
 * Users need to know two things: is this my fault, and should I try again.
 * Everything here answers those two questions (decisions.md §18).
 */

export type LlmErrorKind =
  | "rate_limited"
  | "quota_exhausted"
  | "auth"
  | "model_unavailable"
  | "timeout"
  | "content_rejected"
  | "provider_down"
  | "unknown";

export interface ClassifiedError {
  kind: LlmErrorKind;
  /** Safe to show a non-technical user; never contains keys or stack traces. */
  message: string;
  /** Worth retrying the same request unchanged. */
  retryable: boolean;
}

function statusOf(err: unknown): number | null {
  if (typeof err === "object" && err !== null) {
    for (const key of ["status", "statusCode", "code"]) {
      const value = (err as Record<string, unknown>)[key];
      if (typeof value === "number" && value >= 400 && value < 600) return value;
    }
  }
  // Providers commonly embed the code in the message: "[429 Too Many Requests]".
  const match = /\[(\d{3})[ \]]/.exec(messageOf(err));
  return match ? Number(match[1]) : null;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

export function classifyLlmError(err: unknown): ClassifiedError {
  const raw = messageOf(err);
  const lower = raw.toLowerCase();
  const status = statusOf(err);

  if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    // Daily/spend caps are also 429 but retrying won't help until reset.
    const exhausted =
      lower.includes("quota") &&
      (lower.includes("per day") || lower.includes("daily") || lower.includes("billing"));
    return exhausted
      ? {
          kind: "quota_exhausted",
          message:
            "The AI provider's usage quota is exhausted. Extraction will work again once the quota resets, or after adding billing to the provider account.",
          retryable: false,
        }
      : {
          kind: "rate_limited",
          message:
            "The AI provider is rate-limiting requests right now. Wait a moment and retry this document.",
          retryable: true,
        };
  }

  if (status === 401 || status === 403 || lower.includes("api key") || lower.includes("unauthenticated")) {
    return {
      kind: "auth",
      message:
        "The AI provider rejected the API key. Check the provider key in your .env file.",
      retryable: false,
    };
  }

  if (status === 404 || lower.includes("not found") || lower.includes("does not support")) {
    return {
      kind: "model_unavailable",
      message:
        "The configured AI model isn't available for this API key. This is a configuration problem, not a problem with your document.",
      retryable: false,
    };
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout")) {
    return {
      kind: "timeout",
      message:
        "The AI provider took too long to respond. This is usually temporary — retry this document.",
      retryable: true,
    };
  }

  if (lower.includes("safety") || lower.includes("blocked") || lower.includes("recitation")) {
    return {
      kind: "content_rejected",
      message:
        "The AI provider declined to process this document's content. If it's a normal invoice or receipt, retrying may work.",
      retryable: true,
    };
  }

  if (status !== null && status >= 500) {
    return {
      kind: "provider_down",
      message:
        "The AI provider had a server error. This is temporary — retry this document.",
      retryable: true,
    };
  }

  return {
    kind: "unknown",
    message: `Extraction failed: ${raw.slice(0, 200)}`,
    retryable: true,
  };
}

/** Sleep helper kept separate so tests can stub timing. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry transient provider failures with exponential backoff + jitter.
 * Non-retryable failures (bad key, missing model) throw immediately rather
 * than burning three attempts on a certainty.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const { retryable } = classifyLlmError(err);
      if (!retryable || attempt === attempts) break;
      // Jitter avoids synchronized retries when several uploads fail at once.
      const delay = baseDelay * 2 ** (attempt - 1) * (0.5 + Math.random());
      await sleep(delay);
    }
  }
  throw lastError;
}
