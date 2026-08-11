import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { getDocumentPipeline } from "@/server/services/review";
import { API_MESSAGES, HTTP_STATUS } from "@/server/constants";

/**
 * What ingestion actually did, as a graph the UI can draw: nodes with
 * status/model/token cost, edges from declared dependencies, and totals.
 * Split from the document detail so the common path doesn't carry it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;

  const pipeline = await getDocumentPipeline(workspaceId, id);
  if (!pipeline) {
    return NextResponse.json(
      { error: API_MESSAGES.documentNotFound },
      { status: HTTP_STATUS.notFound },
    );
  }
  return NextResponse.json(pipeline);
}
