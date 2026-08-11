"use client";

import { TriangleAlert } from "lucide-react";
import { ApiError, ApiErrorKind } from "@/lib/api/errors";
import { ACTIONS, ButtonVariant, ERROR_STATES } from "@/constants";
import { Button } from "./button";

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

/**
 * Failure as a first-class state. The server's own sentence is shown when it
 * has one — it explains what went wrong in the user's terms (decisions.md
 * §18) — and retry is only offered when retrying could actually work.
 */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const apiError = error instanceof ApiError ? error : null;
  const notFound = apiError?.kind === ApiErrorKind.NotFound;

  const title = notFound ? ERROR_STATES.notFound.title : ERROR_STATES.generic.title;
  const body = apiError?.message ?? ERROR_STATES.generic.body;
  const canRetry = onRetry && (apiError === null || apiError.retryable);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-card bg-surface px-6 py-20 text-center"
    >
      <span className="mb-5 inline-flex size-14 items-center justify-center rounded-full bg-surface-raised text-danger">
        <TriangleAlert className="size-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{body}</p>
      {canRetry && (
        <Button variant={ButtonVariant.Secondary} onClick={onRetry} className="mt-7">
          {ACTIONS.retry}
        </Button>
      )}
    </div>
  );
}
