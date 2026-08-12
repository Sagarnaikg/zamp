"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronDown,
  History,
  MessageCircle,
  Plus,
  SendHorizontal,
  Trash2,
} from "lucide-react";
import { MessageRole, QUERY } from "@/server/constants";
import { ROUTES } from "@/constants";
import { cn } from "@/lib/utils/cn";
import { formatAmount } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/spinner";
import { formatAnswerFigure } from "../answer";
import {
  useAskLedger,
  useConversation,
  useConversations,
  useDeleteConversation,
} from "../hooks";
import type { ConversationMessage } from "../types";

const EXAMPLE_QUESTIONS = [
  "How much did we spend on software this year?",
  "Show me everything from Acme over $500",
];

/** How many matched documents show inline before the rest collapse to "+N more". */
const INLINE_ROW_LIMIT = 5;

/** Both the closed bubble and the open panel's send button share this id, so
 * framer-motion morphs one into the other instead of a hard cut. */
const TOGGLE_LAYOUT_ID = "ask-ledger-toggle";

function MessageBubble({ message }: { message: ConversationMessage }) {
  if (message.role === MessageRole.User) {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-panel rounded-br-sm bg-accent px-3.5 py-2 text-[13px] text-accent-foreground">
          {message.content}
        </p>
      </div>
    );
  }

  const figure = formatAnswerFigure(message);
  const visible = message.rows.slice(0, INLINE_ROW_LIMIT);
  const overflow = message.rows.length - visible.length;

  return (
    <div className="w-full rounded-panel rounded-bl-sm bg-surface-raised p-3">
      <p className="text-[13px] leading-snug text-foreground">{message.content}</p>

      {figure !== null && (
        <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          {figure}
        </p>
      )}

      {message.answer && message.answer.ignoredFilters.length > 0 && (
        <p className="mt-2 text-[12px] text-confidence-unverified">
          Couldn&apos;t apply:{" "}
          {message.answer.ignoredFilters.map((filter) => filter.field).join(", ")}
        </p>
      )}

      {visible.length > 0 && (
        <ul className="mt-2.5 space-y-1 border-t border-border pt-2.5">
          {visible.map((row) => (
            <li key={row.documentId} className="flex items-center justify-between gap-3">
              <Link
                href={ROUTES.review(row.documentId)}
                className="truncate text-[12px] text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {row.vendor ?? row.filename}
              </Link>
              <span className="shrink-0 text-[12px] tabular-nums text-muted">
                {formatAmount(row.total, row.currency)}
              </span>
            </li>
          ))}
          {overflow > 0 && <li className="text-[12px] text-muted">+{overflow} more</li>}
        </ul>
      )}
    </div>
  );
}

export interface ChatPanelProps {
  /** Starts as the closed bubble when true; open panel otherwise. */
  defaultCollapsed?: boolean;
}

/**
 * The ask side of the ledger, as a floating widget rather than a column in
 * the page — closed, it's a round bubble pinned to the corner; opened, it's a
 * card anchored to the same corner. The bubble and the panel's send button
 * share a layout id, so opening reads as the bubble growing into the send
 * control rather than one thing disappearing and another appearing.
 *
 * Threads are persisted (§31), so a question and how the system read it
 * survive a reload, and past threads can be reopened rather than re-asked.
 *
 * Answers render entirely inside the thread — the ledger table is never
 * touched by asking a question. Narrowing it was a different feature; this
 * is a chat, and a chat's answers belong in the chat.
 */
export function ChatPanel({ defaultCollapsed = true }: ChatPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const conversations = useConversations();
  const conversation = useConversation(conversationId);
  const ask = useAskLedger();
  const remove = useDeleteConversation();

  const messages = conversation.data?.messages ?? [];

  // Keep the newest turn in view as the thread grows.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages.length, ask.isPending]);

  function startNewThread() {
    setConversationId(null);
    setShowHistory(false);
  }

  function openThread(id: string) {
    setConversationId(id);
    setShowHistory(false);
  }

  function submitQuestion(rawQuestion: string) {
    const trimmed = rawQuestion.trim();
    if (trimmed.length === 0 || trimmed.length > QUERY.maxQuestionLength) return;

    ask.mutate(
      { question: trimmed, conversationId: conversationId ?? undefined },
      { onSuccess: (data) => setConversationId(data.conversationId) },
    );
    setQuestion("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    submitQuestion(question);
  }

  if (collapsed) {
    return (
      <motion.button
        layoutId={TOGGLE_LAYOUT_ID}
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Open ask your ledger"
        title="Ask your ledger"
        className="fixed bottom-6 right-6 z-40 inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-shell transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <MessageCircle className="size-6" strokeWidth={1.75} aria-hidden />
      </motion.button>
    );
  }

  return (
    <motion.section
      aria-label="Ask your ledger"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed bottom-6 right-6 z-40 flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col rounded-card bg-surface shadow-shell"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Ask your ledger</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHistory((open) => !open)}
            aria-expanded={showHistory}
            aria-label="Past conversations"
            title="Past conversations"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <History className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={startNewThread}
            aria-label="New conversation"
            title="New conversation"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Minimise ask your ledger"
            title="Minimise"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ChevronDown className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </header>

      {showHistory && (
        <div className="max-h-56 overflow-y-auto border-b border-border p-2">
          {conversations.data?.length ? (
            <ul className="space-y-1">
              {conversations.data.map((thread) => (
                <li key={thread.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openThread(thread.id)}
                    className={cn(
                      "flex-1 truncate rounded-control px-3 py-2 text-left text-[13px] transition-colors",
                      "hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-accent",
                      thread.id === conversationId
                        ? "bg-surface-raised text-foreground"
                        : "text-muted",
                    )}
                  >
                    {thread.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove.mutate(thread.id);
                      if (thread.id === conversationId) startNewThread();
                    }}
                    aria-label={`Delete conversation: ${thread.title}`}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-[13px] text-muted">No past conversations yet.</p>
          )}
        </div>
      )}

      <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !ask.isPending ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-[13px] text-muted">
              Ask about the documents you&apos;ve accepted.
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_QUESTIONS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => submitQuestion(example)}
                  className="rounded-full bg-surface-raised px-3.5 py-1.5 text-[12px] text-muted transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}

        {ask.isPending && (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Spinner className="size-3.5" />
            Querying the ledger records…
          </div>
        )}

        {ask.isError && (
          <p role="alert" className="text-[13px] text-danger">
            {ask.error instanceof Error ? ask.error.message : "That question failed."}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
        <label className="sr-only" htmlFor="ask-input">
          Ask a question about your ledger
        </label>
        <input
          id="ask-input"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question…"
          maxLength={QUERY.maxQuestionLength}
          className="h-10 flex-1 rounded-full border border-border bg-surface px-4 text-[13px] text-foreground placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <motion.button
          layoutId={TOGGLE_LAYOUT_ID}
          type="submit"
          disabled={question.trim().length === 0 || ask.isPending}
          aria-label="Ask"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <motion.span
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex"
          >
            <SendHorizontal className="size-4" strokeWidth={2} aria-hidden />
          </motion.span>
        </motion.button>
      </form>
    </motion.section>
  );
}
