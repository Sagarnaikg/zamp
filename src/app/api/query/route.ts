import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { runQuery } from "@/server/services/ledger";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const workspaceId = await getWorkspaceId();

  const body = await request.json().catch(() => null);
  const question = body?.question;
  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json(
      { error: "Send { question: string }." },
      { status: 400 },
    );
  }
  if (question.length > 500) {
    return NextResponse.json(
      { error: "Question is too long (500 characters max)." },
      { status: 400 },
    );
  }

  const result = await runQuery(workspaceId, question.trim());
  return NextResponse.json(result);
}
