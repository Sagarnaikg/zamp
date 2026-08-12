import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  conversationMessages,
  conversations,
  type StoredAnswer,
} from "@/server/db/schema";
import { MessageRole, QUERY } from "@/server/constants";
import { listLedgerByIds, runQuery, type QueryResult } from "./ledger";

/**
 * Ask-the-ledger conversations (decisions.md §5, §31).
 *
 * A thread is a record of what was asked and how the system read it — not a
 * cache of results. Answers keep their interpretation and figures, but rows
 * are re-read by id on replay so a corrected document shows its corrected
 * value rather than a stale copy.
 */

function titleFrom(question: string): string {
  const trimmed = question.trim();
  return trimmed.length <= QUERY.maxTitleLength
    ? trimmed
    : `${trimmed.slice(0, QUERY.maxTitleLength - 1).trimEnd()}…`;
}

export function listConversations(workspaceId: string) {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.workspaceId, workspaceId))
    // Most recently used first — a thread you just asked in is the one you
    // are most likely to want back.
    .orderBy(desc(conversations.updatedAt));
}

interface ConversationMessageView {
  id: string;
  role: MessageRole;
  content: string;
  answer: StoredAnswer | null;
  createdAt: Date;
  /** Freshly read rows for an assistant turn; empty for user turns. */
  rows: Awaited<ReturnType<typeof listLedgerByIds>>;
}

export async function getConversation(workspaceId: string, conversationId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.workspaceId, workspaceId),
    ),
  });
  if (!conversation) return null;

  const stored = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt));

  const messages: ConversationMessageView[] = await Promise.all(
    stored.map(async (message) => ({
      id: message.id,
      role: message.role as MessageRole,
      content: message.content,
      answer: message.answer,
      createdAt: message.createdAt,
      rows: message.answer
        ? await listLedgerByIds(workspaceId, message.answer.matchedDocumentIds)
        : [],
    })),
  );

  return { conversation, messages };
}

export async function deleteConversation(workspaceId: string, conversationId: string) {
  const [deleted] = await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, workspaceId),
      ),
    )
    .returning();
  return deleted ?? null;
}

export interface AskResult {
  conversationId: string;
  result: QueryResult;
}

/**
 * Run a question and record both sides of the exchange. Creates the thread on
 * the first question so the user never has to name one up front.
 */
export async function ask(
  workspaceId: string,
  question: string,
  conversationId?: string,
): Promise<AskResult | null> {
  let threadId = conversationId;

  if (threadId) {
    // Scope check before writing into someone else's thread.
    const existing = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, threadId),
        eq(conversations.workspaceId, workspaceId),
      ),
      columns: { id: true },
    });
    if (!existing) return null;
  } else {
    const [created] = await db
      .insert(conversations)
      .values({ workspaceId, title: titleFrom(question) })
      .returning({ id: conversations.id });
    threadId = created.id;
  }

  const result = await runQuery(workspaceId, question);

  const answer: StoredAnswer = {
    interpretation: result.interpretation,
    aggregateKind: result.aggregate.kind,
    aggregateValue: result.aggregate.value,
    matchedDocumentIds: result.rows.map((row) => row.documentId),
    ignoredFilters: result.ignoredFilters,
    dsl: result.dsl,
  };

  await db.insert(conversationMessages).values([
    { conversationId: threadId, workspaceId, role: MessageRole.User, content: question },
    {
      conversationId: threadId,
      workspaceId,
      role: MessageRole.Assistant,
      content: result.interpretation,
      answer,
    },
  ]);

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, threadId));

  return { conversationId: threadId, result };
}
