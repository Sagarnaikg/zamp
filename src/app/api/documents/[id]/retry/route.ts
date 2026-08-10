import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { retryDocument } from "@/server/services/documents";

// Re-runs extraction, same cost profile as the original upload.
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;

  const result = await retryDocument(workspaceId, id);
  if (!result) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (result.error) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
