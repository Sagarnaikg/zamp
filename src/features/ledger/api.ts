import { api } from "@/lib/api/client";
import { API_ROUTES } from "@/constants";
import type {
  ConversationDetail,
  ConversationListResponse,
  LedgerResponse,
  QueryResponse,
} from "./types";

export const ledgerApi = {
  list: (signal?: AbortSignal) => api.get<LedgerResponse>(API_ROUTES.ledger, signal),

  /** Omitting `conversationId` starts a new thread server-side. */
  ask: (question: string, conversationId?: string, signal?: AbortSignal) =>
    api.post<QueryResponse>(API_ROUTES.query, { question, conversationId }, signal),

  conversations: (signal?: AbortSignal) =>
    api.get<ConversationListResponse>(API_ROUTES.conversations, signal),

  conversation: (id: string, signal?: AbortSignal) =>
    api.get<ConversationDetail>(API_ROUTES.conversation(id), signal),

  deleteConversation: (id: string) =>
    api.delete<{ deleted: string }>(API_ROUTES.conversation(id)),
};
