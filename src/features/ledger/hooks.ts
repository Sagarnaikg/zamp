"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations.list(),
    queryFn: ({ signal }) => ledgerApi.conversations(signal),
    select: (data) => data.conversations,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(id ?? ""),
    queryFn: ({ signal }) => ledgerApi.conversation(id!, signal),
    enabled: id !== null,
  });
}

/**
 * Asking is a mutation, not a query: it costs a model call, so it must fire
 * on submit only — never on mount, refocus, or a cache miss.
 */
export function useAskLedger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      question,
      conversationId,
    }: {
      question: string;
      conversationId?: string;
    }) => ledgerApi.ask(question, conversationId),
    onSuccess: (data) => {
      // The thread gained a turn and may be brand new, so both the list and
      // this thread's messages are now stale.
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(data.conversationId),
      });
    },
    onError: (error) => reportError(error, "ask-ledger"),
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ledgerApi.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
    onError: (error) => reportError(error, "delete-conversation"),
  });
}
