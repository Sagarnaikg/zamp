import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { ask } from "@/server/services/conversations";
import { API_MESSAGES, HTTP_STATUS, QUERY, TIMEOUTS } from "@/server/constants";

export const maxDuration = TIMEOUTS.queryRouteSeconds;

/**
 * Asking is always recorded into a conversation (§31). `conversationId` is
 * optional — omitting it starts a new thread, so the first question never
 * requires the user to create one first.
 */
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

  const conversationId =
    typeof body?.conversationId === "string" ? body.conversationId : undefined;

  const asked = await ask(workspaceId, question.trim(), conversationId);
  if (!asked) {
    return NextResponse.json(
      { error: API_MESSAGES.conversationNotFound },
      { status: HTTP_STATUS.notFound },
    );
  }

  return NextResponse.json({ conversationId: asked.conversationId, ...asked.result });
}
