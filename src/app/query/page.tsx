import { MessageCircleQuestion } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { EMPTY_STATES } from "@/constants";

// Placeholder: the natural-language question box lands here next.
export default function QueryPage() {
  return (
    <>
      <PageHeader
        title="Ask your ledger"
        subtitle="Plain-language questions over the documents you've accepted."
      />
      <EmptyState
        icon={MessageCircleQuestion}
        title={EMPTY_STATES.queryResults.title}
        body={EMPTY_STATES.queryResults.body}
      />
    </>
  );
}
