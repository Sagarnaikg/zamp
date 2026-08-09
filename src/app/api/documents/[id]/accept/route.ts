import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { acceptDocument } from "@/server/services/review";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  const accepted = await acceptDocument(workspaceId, id);
  if (!accepted) {
    return NextResponse.json(
      { error: "Document not found or not in needs_review state" },
      { status: 409 },
    );
  }
  return NextResponse.json({ document: accepted });
}
