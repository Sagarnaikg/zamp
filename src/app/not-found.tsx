import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { ERROR_STATES, ROUTES } from "@/constants";

export default function NotFound() {
  return (
    <EmptyState
      title={ERROR_STATES.notFound.title}
      body={ERROR_STATES.notFound.body}
      action={
        <Link
          href={ROUTES.documents}
          className="text-sm font-medium text-accent underline underline-offset-4"
        >
          Back to documents
        </Link>
      }
    />
  );
}
