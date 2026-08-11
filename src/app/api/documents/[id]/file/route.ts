import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getStorage } from "@/server/storage";
import { getWorkspaceId } from "@/server/workspace";
import { API_MESSAGES, HTTP_STATUS } from "@/server/constants";

type Params = { params: Promise<{ id: string }> };

/** Serve the original uploaded document for the review view. */
export async function GET(_request: NextRequest, { params }: Params) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;

  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)),
  });
  if (!doc) {
    return NextResponse.json(
      { error: API_MESSAGES.documentNotFound },
      { status: HTTP_STATUS.notFound },
    );
  }

  // Blob driver stores a full URL — hand the browser off to it directly.
  if (doc.storagePath.startsWith("http")) {
    return NextResponse.redirect(doc.storagePath);
  }

  const data = await getStorage().get(doc.storagePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
