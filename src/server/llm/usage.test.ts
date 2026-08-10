import { describe, expect, it } from "vitest";
import { addUsage, emptyUsage, usageFromResponse } from "./usage";

describe("usageFromResponse", () => {
  it("reads the standard LangChain usage_metadata shape", () => {
    const usage = usageFromResponse({
      usage_metadata: { input_tokens: 1200, output_tokens: 300, total_tokens: 1500 },
    });
    expect(usage).toEqual({ input: 1200, output: 300, total: 1500, calls: 1 });
  });

  it("derives the total when the provider omits it", () => {
    const usage = usageFromResponse({
      usage_metadata: { input_tokens: 100, output_tokens: 50 },
    });
    expect(usage.total).toBe(150);
  });

  it("falls back to the OpenAI-style tokenUsage shape", () => {
    const usage = usageFromResponse({
      response_metadata: {
        tokenUsage: { promptTokens: 800, completionTokens: 200, totalTokens: 1000 },
      },
    });
    expect(usage).toEqual({ input: 800, output: 200, total: 1000, calls: 1 });
  });

  it("counts the call even when a provider reports no usage at all", () => {
    // Losing the call count would understate cost more than losing tokens.
    const usage = usageFromResponse({});
    expect(usage).toEqual({ input: 0, output: 0, total: 0, calls: 1 });
  });

  it("does not throw on a null response", () => {
    expect(() => usageFromResponse(null)).not.toThrow();
  });
});

describe("addUsage", () => {
  it("accumulates tokens and calls across a pipeline", () => {
    const total = [
      { input: 1000, output: 200, total: 1200, calls: 1 },
      { input: 800, output: 150, total: 950, calls: 1 },
    ].reduce(addUsage, emptyUsage());
    expect(total).toEqual({ input: 1800, output: 350, total: 2150, calls: 2 });
  });
});
