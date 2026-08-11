"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query-client";
import { ErrorBoundary } from "@/components/error-boundary";

/**
 * Client-side providers, mounted once. The QueryClient is created in state
 * rather than at module scope so each SSR request gets its own cache instead
 * of sharing one across users.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary source="app-root">{children}</ErrorBoundary>
    </QueryClientProvider>
  );
}
