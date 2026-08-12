import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { listDocuments, ingestDocument } from "@/server/services/documents";
import { API_MESSAGES, HTTP_STATUS, UPLOAD } from "@/server/constants";

// Extraction runs synchronously within the request; on Vercel Hobby the
// default 10s timeout is too tight for a vision call (decisions.md §7).
// Next.js requires this export to be a static literal, so it can't reference
// TIMEOUTS.extractionRouteSeconds directly — keep the two in sync by hand.
export const maxDuration = 60;

export async function GET() {
  const workspaceId = await getWorkspaceId();
  return NextResponse.json({ documents: await listDocuments(workspaceId) });
}

export async function POST(request: NextRequest) {
  const workspaceId = await getWorkspaceId();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: API_MESSAGES.missingFile },
      { status: HTTP_STATUS.badRequest },
    );
  }
  if (!UPLOAD.acceptedMimeTypes.includes(file.type as never)) {
    return NextResponse.json(
      {
        error: API_MESSAGES.unsupportedFileType(
          file.type,
          UPLOAD.acceptedMimeTypes.join(", "),
        ),
      },
      { status: HTTP_STATUS.badRequest },
    );
  }
  if (file.size > UPLOAD.maxBytes) {
    return NextResponse.json(
      {
        error: API_MESSAGES.fileTooLarge(
          (file.size / 1024 / 1024).toFixed(1),
          UPLOAD.maxBytes / 1024 / 1024,
        ),
      },
      { status: HTTP_STATUS.badRequest },
    );
  }

  const result = await ingestDocument(workspaceId, {
    name: file.name,
    type: file.type,
    data: Buffer.from(await file.arrayBuffer()),
  });

  if (result.error) {
    return NextResponse.json(result, { status: HTTP_STATUS.badGateway });
  }
  return NextResponse.json(result, { status: HTTP_STATUS.created });
}
