import { NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { listConversations } from "@/server/services/conversations";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  return NextResponse.json({ conversations: await listConversations(workspaceId) });
}
