/**
 * Token accounting (decisions.md §21). Optimization without measurement is
 * guesswork, and "the LLM bill" is the one operating cost of this product —
 * so every model call reports what it spent, and the total is stored with
 * the document it was spent on.
 */

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  /** Number of model calls — the other half of the cost story. */
  calls: number;
}

export function emptyUsage(): TokenUsage {
  return { input: 0, output: 0, total: 0, calls: 0 };
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    total: a.total + b.total,
    calls: a.calls + b.calls,
  };
}

/**
 * Pull usage off a LangChain response. Providers report this in slightly
 * different shapes and some omit it entirely, so a miss counts the call but
 * contributes zero tokens rather than throwing.
 */
export function usageFromResponse(raw: unknown): TokenUsage {
  const message = raw as {
    usage_metadata?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    response_metadata?: {
      tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
      usage?: { input_tokens?: number; output_tokens?: number };
    };
  };

  const metadata = message?.usage_metadata;
  if (metadata) {
    const input = metadata.input_tokens ?? 0;
    const output = metadata.output_tokens ?? 0;
    return { input, output, total: metadata.total_tokens ?? input + output, calls: 1 };
  }

  const legacy = message?.response_metadata?.tokenUsage;
  if (legacy) {
    const input = legacy.promptTokens ?? 0;
    const output = legacy.completionTokens ?? 0;
    return { input, output, total: legacy.totalTokens ?? input + output, calls: 1 };
  }

  const anthropic = message?.response_metadata?.usage;
  if (anthropic) {
    const input = anthropic.input_tokens ?? 0;
    const output = anthropic.output_tokens ?? 0;
    return { input, output, total: input + output, calls: 1 };
  }

  return { input: 0, output: 0, total: 0, calls: 1 };
}
