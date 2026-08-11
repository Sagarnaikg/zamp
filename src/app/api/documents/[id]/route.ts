import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import {
  correctFields,
  getDocumentDetail,
  isCorrectableField,
  rejectDocument,
} from "@/server/services/review";
import { API_MESSAGES, HTTP_STATUS } from "@/server/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  const detail = await getDocumentDetail(workspaceId, id);
  if (!detail) {
    return NextResponse.json(
      { error: API_MESSAGES.documentNotFound },
      { status: HTTP_STATUS.notFound },
    );
  }
  return NextResponse.json(detail);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: API_MESSAGES.invalidCorrectionBody },
      { status: HTTP_STATUS.badRequest },
    );
  }

  const invalid = Object.keys(body).filter((f) => !isCorrectableField(f));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: API_MESSAGES.notCorrectable(invalid.join(", ")) },
      { status: HTTP_STATUS.badRequest },
    );
  }

  const result = await correctFields(workspaceId, id, body);
  if (!result) {
    return NextResponse.json(
      { error: API_MESSAGES.documentNotFound },
      { status: HTTP_STATUS.notFound },
    );
  }
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  const deleted = await rejectDocument(workspaceId, id);
  if (!deleted) {
    return NextResponse.json(
      { error: API_MESSAGES.documentNotFound },
      { status: HTTP_STATUS.notFound },
    );
  }
  return NextResponse.json({ rejected: deleted.id });
}
