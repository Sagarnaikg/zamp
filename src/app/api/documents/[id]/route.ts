import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import {
  correctFields,
  getDocumentDetail,
  isCorrectableField,
  rejectDocument,
} from "@/server/services/review";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  const detail = await getDocumentDetail(workspaceId, id);
  if (!detail) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Send a JSON object of field → new value." },
      { status: 400 },
    );
  }

  const invalid = Object.keys(body).filter((f) => !isCorrectableField(f));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Not correctable: ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  const result = await correctFields(workspaceId, id, body);
  if (!result) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  const deleted = await rejectDocument(workspaceId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ rejected: deleted.id });
}
