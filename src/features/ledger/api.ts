import { api } from "@/lib/api/client";
import { API_ROUTES } from "@/constants";
import type { LedgerResponse, QueryResponse } from "./types";

export const ledgerApi = {
  list: (signal?: AbortSignal) => api.get<LedgerResponse>(API_ROUTES.ledger, signal),

  ask: (question: string, signal?: AbortSignal) =>
    api.post<QueryResponse>(API_ROUTES.query, { question }, signal),
};
