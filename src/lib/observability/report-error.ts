import { env, isProduction } from "@/config/env";
import { ApiError } from "@/lib/api/errors";
import { logger } from "./logger";

/**
 * Single sink for unexpected client errors (decisions.md §28).
 *
 * Vendor-agnostic on purpose: adding Sentry later means implementing `send`
 * here, not touching every boundary that reports. Expected failures — a 404,
 * a validation rejection — are logged but not reported; they're the product
 * working, and drowning the sink in them is how real alerts get ignored.
 */

interface ErrorReport {
  message: string;
  stack?: string;
  /** Where it happened: a component boundary name, a hook, a mutation. */
  source: string;
  context?: Record<string, unknown>;
}

function isExpected(error: unknown): boolean {
  return error instanceof ApiError && !error.retryable;
}

function send(report: ErrorReport): void {
  if (!isProduction || !env.errorReportingUrl) return;
  // Fire-and-forget: a failed report must never surface to the user, and
  // sendBeacon survives the page unloading mid-report.
  try {
    navigator.sendBeacon?.(
      env.errorReportingUrl,
      new Blob([JSON.stringify(report)], { type: "application/json" }),
    );
  } catch {
    // Reporting failed; nothing further to do without causing a loop.
  }
}

export function reportError(
  error: unknown,
  source: string,
  context?: Record<string, unknown>,
): void {
  const isError = error instanceof Error;
  const report: ErrorReport = {
    message: isError ? error.message : String(error),
    stack: isError ? error.stack : undefined,
    source,
    context,
  };

  if (isExpected(error)) {
    // A 404, a 409, a rejected correction — the product working, not a defect.
    // Logged for debugging but never at error level: it would page someone
    // awake in production, and in dev it opens Next's error overlay on top of
    // a failure the UI is already showing the user properly.
    logger.warn(report.message, { source, ...context });
    return;
  }

  logger.error(report.message, { source, ...context });
  send(report);
}
