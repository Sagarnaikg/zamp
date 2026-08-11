import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { acceptDocument } from "@/server/services/review";
import { API_MESSAGES, HTTP_STATUS } from "@/server/constants";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  const accepted = await acceptDocument(workspaceId, id);
  if (!accepted) {
    return NextResponse.json(
      { error: API_MESSAGES.notAcceptable },
      { status: HTTP_STATUS.conflict },
    );
  }
  return NextResponse.json({ document: accepted });
}
