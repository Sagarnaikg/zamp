import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import {
  deleteConversation,
  getConversation,
} from "@/server/services/conversations";
import { API_MESSAGES, HTTP_STATUS } from "@/server/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;

  const conversation = await getConversation(workspaceId, id);
  if (!conversation) {
    return NextResponse.json(
      { error: API_MESSAGES.conversationNotFound },
      { status: HTTP_STATUS.notFound },
    );
  }
  return NextResponse.json(conversation);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;

  const deleted = await deleteConversation(workspaceId, id);
  if (!deleted) {
    return NextResponse.json(
      { error: API_MESSAGES.conversationNotFound },
      { status: HTTP_STATUS.notFound },
    );
  }
  return NextResponse.json({ deleted: deleted.id });
}
