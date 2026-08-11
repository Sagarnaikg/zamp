import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { EMPTY_STATES } from "@/constants";

// Placeholder: the accepted-documents table lands here next.
export default function LedgerPage() {
  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle="Every document you've reviewed and accepted."
      />
      <EmptyState
        icon={BookOpen}
        title={EMPTY_STATES.ledger.title}
        body={EMPTY_STATES.ledger.body}
      />
    </>
  );
}
