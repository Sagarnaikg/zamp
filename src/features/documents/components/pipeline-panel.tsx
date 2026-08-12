"use client";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentPipeline } from "../hooks";
import { PipelineGraph } from "./pipeline-graph";

export function PipelinePanel({ documentId }: { documentId: string }) {
  const { data, isPending, isError, error, refetch } = useDocumentPipeline(documentId);

  if (isPending) {
    return (
      <Skeleton
        className="rounded-card"
        style={{ height: "calc(100vh - 20rem)", minHeight: "32rem" }}
      />
    );
  }
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return <PipelineGraph pipeline={data} />;
}
