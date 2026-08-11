"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useAskLedger } from "@/features/ledger/hooks";
import { AskForm } from "@/features/ledger/components/ask-form";
import { QueryResult } from "@/features/ledger/components/query-result";

export default function QueryPage() {
  const ask = useAskLedger();
  // Kept outside the mutation so a retry can re-fire the same question rather
  // than needing the user to retype it.
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  function handleAsk(question: string) {
    setLastQuestion(question);
    ask.mutate(question);
  }

  return (
    <>
      <PageHeader
        title="Ask your ledger"
        subtitle="Plain-language questions over the documents you've accepted."
      />

      <div className="space-y-6">
        <AskForm onAsk={handleAsk} pending={ask.isPending} />

        {ask.isPending ? (
          <SkeletonRows rows={3} />
        ) : ask.isError ? (
          <ErrorState
            error={ask.error}
            onRetry={lastQuestion ? () => ask.mutate(lastQuestion) : undefined}
          />
        ) : ask.data ? (
          <QueryResult result={ask.data} />
        ) : (
          <EmptyState
            icon={MessageCircleQuestion}
            title="Ask something about your ledger"
            body="Try one of the examples above, or ask in your own words — vendor, date range, category, or amount."
          />
        )}
      </div>
    </>
  );
}
