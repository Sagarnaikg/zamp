"use client";

import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUERY } from "@/server/constants";

const EXAMPLE_QUESTIONS = [
  "How much did we spend on software this year?",
  "Show me everything from Acme over $500",
  "What did we pay in July?",
];

export function AskForm({
  onAsk,
  pending,
}: {
  onAsk: (question: string) => void;
  pending: boolean;
}) {
  const [question, setQuestion] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length === 0 || trimmed.length > QUERY.maxQuestionLength) return;
    onAsk(trimmed);
  }

  return (
    <div>
      <form onSubmit={submit} className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about your accepted documents…"
            maxLength={QUERY.maxQuestionLength}
            aria-label="Ask a question about your ledger"
            className="h-12 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm text-foreground placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
        <Button type="submit" loading={pending} disabled={question.trim().length === 0}>
          Ask
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setQuestion(example)}
            className="rounded-full bg-surface-raised px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
