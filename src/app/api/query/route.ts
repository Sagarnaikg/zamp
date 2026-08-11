import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { runQuery } from "@/server/services/ledger";
import { API_MESSAGES, HTTP_STATUS, QUERY, TIMEOUTS } from "@/server/constants";

export const maxDuration = TIMEOUTS.queryRouteSeconds;

export async function POST(request: NextRequest) {
  const workspaceId = await getWorkspaceId();

  const body = await request.json().catch(() => null);
  const question = body?.question;
  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json(
      { error: API_MESSAGES.missingQuestion },
      { status: HTTP_STATUS.badRequest },
    );
  }
  if (question.length > QUERY.maxQuestionLength) {
    return NextResponse.json(
      { error: API_MESSAGES.questionTooLong(QUERY.maxQuestionLength) },
      { status: HTTP_STATUS.badRequest },
    );
  }

  const result = await runQuery(workspaceId, question.trim());
  return NextResponse.json(result);
}
