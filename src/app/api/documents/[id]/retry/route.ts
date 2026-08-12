import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { retryDocument } from "@/server/services/documents";
import { API_MESSAGES, HTTP_STATUS } from "@/server/constants";

// Re-runs extraction, same cost profile as the original upload. Next.js
// requires this export to be a static literal — keep in sync with
// TIMEOUTS.extractionRouteSeconds by hand.
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;

  const result = await retryDocument(workspaceId, id);
  if (!result) {
    return NextResponse.json(
      { error: API_MESSAGES.documentNotFound },
      { status: HTTP_STATUS.notFound },
    );
  }
  if (result.error) {
    return NextResponse.json(result, { status: HTTP_STATUS.badGateway });
  }
  return NextResponse.json(result);
}
