import { describe, expect, it, vi } from "vitest";
import { classifyLlmError, withRetry } from "@/server/llm/errors";

describe("classifyLlmError", () => {
  it("treats a rate limit as retryable and explains the wait", () => {
    const result = classifyLlmError(
      new Error("[429 Too Many Requests] Resource exhausted"),
    );
    expect(result.kind).toBe("rate_limited");
    expect(result.retryable).toBe(true);
    expect(result.message).toMatch(/rate-limit/i);
  });

  it("distinguishes an exhausted daily quota from a momentary rate limit", () => {
    // Both are HTTP 429, but retrying a spent daily quota is pointless.
    const result = classifyLlmError(
      new Error(
        "[429] You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests, limit per day",
      ),
    );
    expect(result.kind).toBe("quota_exhausted");
    expect(result.retryable).toBe(false);
  });

  it("flags a bad API key as the operator's problem, not retryable", () => {
    const result = classifyLlmError(new Error("[401] API key not valid"));
    expect(result.kind).toBe("auth");
    expect(result.retryable).toBe(false);
    expect(result.message).toMatch(/\.env/);
  });

  it("recognizes the model-unavailable case that broke the vision path", () => {
    const result = classifyLlmError(
      new Error("This model does not support files"),
    );
    expect(result.kind).toBe("model_unavailable");
    expect(result.retryable).toBe(false);
    // The user's document is fine — say so, so they don't re-scan it.
    expect(result.message).toMatch(/not a problem with your document/i);
  });

  it("treats provider 5xx and timeouts as retryable", () => {
    expect(classifyLlmError(new Error("[503] Service Unavailable")).retryable).toBe(true);
    expect(classifyLlmError(new Error("request timed out")).kind).toBe("timeout");
  });

  it("reads a numeric status property when the message has no code", () => {
    const err = Object.assign(new Error("upstream failure"), { status: 500 });
    expect(classifyLlmError(err).kind).toBe("provider_down");
  });

  it("never leaks an unbounded provider payload into the message", () => {
    const result = classifyLlmError(new Error("x".repeat(5000)));
    expect(result.message.length).toBeLessThan(300);
  });
});

describe("withRetry", () => {
  it("returns the result once a transient failure clears", async () => {
    let calls = 0;
    const op = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error("[429] rate limit");
      return "extracted";
    });
    const result = await withRetry(op, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe("extracted");
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("gives up immediately on a non-retryable error instead of burning attempts", async () => {
    const op = vi.fn(async () => {
      throw new Error("[401] API key not valid");
    });
    await expect(withRetry(op, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow(
      /API key/,
    );
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("surfaces the last error after exhausting attempts", async () => {
    const op = vi.fn(async () => {
      throw new Error("[503] Service Unavailable");
    });
    await expect(withRetry(op, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow(
      /503/,
    );
    expect(op).toHaveBeenCalledTimes(2);
  });
});
