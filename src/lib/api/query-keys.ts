/**
 * Every React Query cache key, in one factory. Invalidation is the easiest
 * thing to get subtly wrong — a key typed inline at two call sites silently
 * splits the cache — so keys are never written as literals in hooks.
 */
export const queryKeys = {
  documents: {
    all: ["documents"] as const,
    list: () => [...queryKeys.documents.all, "list"] as const,
    detail: (id: string) => [...queryKeys.documents.all, "detail", id] as const,
    pipeline: (id: string) => [...queryKeys.documents.all, "pipeline", id] as const,
  },
  ledger: {
    all: ["ledger"] as const,
    list: () => [...queryKeys.ledger.all, "list"] as const,
  },
  query: {
    all: ["query"] as const,
    ask: (question: string) => [...queryKeys.query.all, question] as const,
  },
  status: {
    all: ["status"] as const,
  },
} as const;
