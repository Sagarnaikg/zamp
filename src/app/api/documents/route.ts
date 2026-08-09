import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, extractions, lineItems } from "@/db/schema";
import { getStorage } from "@/lib/storage";
import { getWorkspaceId } from "@/lib/workspace";
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_BYTES,
  detectFileKind,
} from "@/lib/ingest/detect";
import { extract } from "@/lib/llm/extraction";

// Extraction runs synchronously within the request; on Vercel Hobby the
// default 10s timeout is too tight for a vision call (decisions.md §7).
export const maxDuration = 60;

export async function GET() {
  const workspaceId = await getWorkspaceId();
  const rows = await db.query.documents.findMany({
    where: eq(documents.workspaceId, workspaceId),
    orderBy: [desc(documents.createdAt)],
  });
  return NextResponse.json({ documents: rows });
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

  const data = Buffer.from(await file.arrayBuffer());
  const storageKey = `${workspaceId}/${randomUUID()}-${file.name}`;
  const storagePath = await getStorage().put(storageKey, data, file.type);

  const [doc] = await db
    .insert(documents)
    .values({
      workspaceId,
      filename: file.name,
      mimeType: file.type,
      storagePath,
      status: "processing",
    })
    .returning();

  try {
    const { kind, text } = await detectFileKind(data, file.type);
    await db
      .update(documents)
      .set({ fileKind: kind, updatedAt: new Date() })
      .where(eq(documents.id, doc.id));

    const result = await extract(kind, { data, mimeType: file.type, text });
    if (!result) {
      throw new Error("No extraction result returned");
    }
    const { extraction } = result;

    await db.insert(extractions).values({
      documentId: doc.id,
      workspaceId,
      vendor: extraction.vendor,
      invoiceNumber: extraction.invoice_number,
      docDate: extraction.doc_date,
      currency: extraction.currency,
      subtotal: extraction.subtotal?.toString() ?? null,
      tax: extraction.tax?.toString() ?? null,
      total: extraction.total?.toString() ?? null,
      category: extraction.category,
    });

    if (extraction.line_items.length > 0) {
      await db.insert(lineItems).values(
        extraction.line_items.map((item, i) => ({
          documentId: doc.id,
          workspaceId,
          position: i,
          description: item.description,
          quantity: item.quantity?.toString() ?? null,
          unitPrice: item.unit_price?.toString() ?? null,
          amount: item.amount?.toString() ?? null,
        })),
      );
    }

    const [updated] = await db
      .update(documents)
      .set({ status: "needs_review", updatedAt: new Date() })
      .where(eq(documents.id, doc.id))
      .returning();

    return NextResponse.json({ document: updated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    const [failed] = await db
      .update(documents)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(documents.id, doc.id))
      .returning();
    return NextResponse.json({ document: failed, error: message }, { status: 502 });
  }
}
