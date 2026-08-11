import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError } from "@/lib/observability/report-error";
import { ApiError, ApiErrorKind } from "@/lib/api/errors";
import { HTTP_STATUS } from "@/server/constants";

/**
 * Severity is not cosmetic here. An expected failure logged at error level
 * pages someone awake in production, and in dev it throws Next's error overlay
 * over a failure the UI is already reporting properly — which is exactly the
 * bug this pins: accepting an already-accepted document 409s, the UI handles
 * it, and the overlay appeared anyway.
 */
describe("reportError", () => {
  afterEach(() => vi.restoreAllMocks());

  function spyConsole() {
    return {
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    };
  }

  it("logs an expected failure at warn, never at error", () => {
    const spies = spyConsole();
    reportError(
      new ApiError(ApiErrorKind.Conflict, "Not in needs_review state", HTTP_STATUS.conflict),
      "accept-document",
    );

    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.warn).toHaveBeenCalledOnce();
  });

  it("treats a 404 as expected too", () => {
    const spies = spyConsole();
    reportError(
      new ApiError(ApiErrorKind.NotFound, "Document not found", HTTP_STATUS.notFound),
      "load-document",
    );

    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.warn).toHaveBeenCalledOnce();
  });

  it("still logs a genuine defect at error level", () => {
    const spies = spyConsole();
    reportError(new TypeError("cannot read property of undefined"), "review-form");

    expect(spies.error).toHaveBeenCalledOnce();
    expect(spies.warn).not.toHaveBeenCalled();
  });

  it("logs a retryable server failure at error level — it may be a real outage", () => {
    const spies = spyConsole();
    reportError(
      new ApiError(ApiErrorKind.Server, "Upstream exploded", HTTP_STATUS.badGateway),
      "upload-document",
    );

    expect(spies.error).toHaveBeenCalledOnce();
  });

  it("passes the message as the first argument so consoles don't render '{}'", () => {
    const spies = spyConsole();
    reportError(new Error("something specific broke"), "review-form");

    expect(spies.error.mock.calls[0][0]).toBe("something specific broke");
  });
});
