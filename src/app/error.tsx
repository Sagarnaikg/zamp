"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { reportError } from "@/lib/observability/report-error";

/** Route-level boundary: a failed page render, not a failed request. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, "route-boundary", { digest: error.digest });
  }, [error]);

  return <ErrorState error={error} onRetry={reset} />;
}
