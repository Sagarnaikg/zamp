import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { RETRY } from "@/server/constants";

/**
 * Server state lives here, client state does not (decisions.md §28).
 *
 * Defaults are chosen for a finance review workflow: extracted data changes
 * only when the user or the pipeline changes it, so aggressive refetching
 * buys nothing and costs requests.
 */
const STALE_TIME_MS = 30_000;
const GC_TIME_MS = 5 * 60_000;

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Retrying a 404 or a validation error just delays showing the real answer.
  if (error instanceof ApiError && !error.retryable) return false;
  return failureCount < RETRY.attempts;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // A mutation is a user's deliberate action; replaying it silently is
        // riskier than surfacing the failure and letting them decide.
        retry: false,
      },
    },
  });
}
