import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { listDocuments, ingestDocument } from "@/server/services/documents";
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_BYTES,
} from "@/server/ingest/detect";

// Extraction runs synchronously within the request; on Vercel Hobby the
// default 10s timeout is too tight for a vision call (decisions.md §7).
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
      { error: "Attach a file under the 'file' form field." },
      { status: 400 },
    );
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type as never)) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type}". Accepted: PDF, JPEG, PNG, WebP.` },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 10MB.` },
      { status: 400 },
    );
  }

  const result = await ingestDocument(workspaceId, {
    name: file.name,
    type: file.type,
    data: Buffer.from(await file.arrayBuffer()),
  });

  if (result.error) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result, { status: 201 });
}
