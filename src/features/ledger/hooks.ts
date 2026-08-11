"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { reportError } from "@/lib/observability/report-error";
import { ledgerApi } from "./api";

export function useLedger() {
  return useQuery({
    queryKey: queryKeys.ledger.list(),
    queryFn: ({ signal }) => ledgerApi.list(signal),
    select: (data) => data.rows,
  });
}

/**
 * Asking is a mutation, not a query: it costs a model call, so it must fire
 * on submit only — never on mount, refocus, or a cache miss.
 */
export function useAskLedger() {
  return useMutation({
    mutationFn: (question: string) => ledgerApi.ask(question),
    onError: (error) => reportError(error, "ask-ledger"),
  });
}
