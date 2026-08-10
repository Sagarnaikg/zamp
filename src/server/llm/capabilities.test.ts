import { describe, expect, it } from "vitest";
import { collectApiKeys, guessProvider, selectTiers } from "./capabilities";

describe("collectApiKeys", () => {
  it("reads the generic single-key variable", () => {
    expect(collectApiKeys({ LLM_API_KEY: "sk-one" })).toEqual([
      "sk-one",
    ]);
  });

  it("splits a comma-separated list and trims whitespace", () => {
    const keys = collectApiKeys({
      LLM_API_KEYS: "sk-one, sk-ant-two ,AIzaThree",
    });
    expect(keys).toEqual(["sk-one", "sk-ant-two", "AIzaThree"]);
  });

  it("still accepts per-provider variables for anyone who prefers them", () => {
    const keys = collectApiKeys({
      OPENAI_API_KEY: "sk-openai",
      GOOGLE_API_KEY: "AIzaGoogle",
    });
    expect(keys).toEqual(expect.arrayContaining(["sk-openai", "AIzaGoogle"]));
  });

  it("deduplicates a key listed in two variables", () => {
    const keys = collectApiKeys({
      LLM_API_KEY: "sk-same",
      OPENAI_API_KEY: "sk-same",
    });
    expect(keys).toEqual(["sk-same"]);
  });

  it("returns nothing when no key is configured", () => {
    expect(collectApiKeys({})).toEqual([]);
  });

  it("accepts a JSON array, the other syntax people reach for", () => {
    const keys = collectApiKeys({
      LLM_API_KEYS: '["sk-one", "AIzaTwo"]',
    });
    expect(keys).toEqual(["sk-one", "AIzaTwo"]);
  });

  it("recovers keys from a malformed JSON array instead of rejecting them", () => {
    // A missing closing bracket shouldn't read as "your key is invalid".
    const keys = collectApiKeys({ LLM_API_KEYS: '["sk-one", "AIzaTwo"' });
    expect(keys).toEqual(["sk-one", "AIzaTwo"]);
  });

  it("strips stray quotes around a single key", () => {
    expect(collectApiKeys({ LLM_API_KEY: '"sk-quoted"' })).toEqual([
      "sk-quoted",
    ]);
  });

  it("accepts a JSON array of objects, provider label and all", () => {
    const keys = collectApiKeys({
      LLM_API_KEYS:
        '[{"provider":"gemini","apiKey":"AIzaOne"},{"provider":"openai","apiKey":"sk-two"}]',
    });
    expect(keys).toEqual(["AIzaOne", "sk-two"]);
  });

  it("reads the key from whichever field name the object uses", () => {
    const keys = collectApiKeys({
      LLM_API_KEYS: '[{"key":"one"},{"value":"two"},{"api_key":"three"}]',
    });
    expect(keys).toEqual(["one", "two", "three"]);
  });

  it("ignores a mislabelled provider rather than trusting it over the key", () => {
    // The label says gemini; the key is plainly an OpenAI one. Detection
    // works off the key, so the entry still resolves correctly.
    const keys = collectApiKeys({
      LLM_API_KEYS: '[{"provider":"gemini","apiKey":"sk-proj-actually-openai"}]',
    });
    expect(keys).toEqual(["sk-proj-actually-openai"]);
    expect(guessProvider(keys[0])).toBe("openai");
  });

  it("accepts a list in the singular variable too", () => {
    // The singular/plural distinction is a naming convention, not a rule the
    // user should be punished for missing.
    expect(collectApiKeys({ LLM_API_KEY: "sk-one,AIzaTwo" })).toEqual([
      "sk-one",
      "AIzaTwo",
    ]);
  });
});

describe("guessProvider", () => {
  it("distinguishes Anthropic from OpenAI despite the shared sk- prefix", () => {
    expect(guessProvider("sk-ant-api03-abc")).toBe("anthropic");
    expect(guessProvider("sk-proj-abc")).toBe("openai");
  });

  it("recognizes both Google key formats", () => {
    expect(guessProvider("AIzaSyAbc123")).toBe("google");
    expect(guessProvider("AQ.Ab8RN6Jk9tc7")).toBe("google");
  });

  it("returns null for an unrecognized shape rather than guessing wrong", () => {
    // Discovery then probes every provider, so an unknown format still works.
    expect(guessProvider("mystery-key-format")).toBeNull();
  });
});

describe("selectTiers", () => {
  it("prefers -latest aliases over pinned dated Gemini models", () => {
    const tiers = selectTiers("google", [
      "gemini-2.5-flash-001",
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-pro-latest",
    ]);
    expect(tiers).toEqual({
      cheap: "gemini-flash-lite-latest",
      strong: "gemini-flash-latest",
    });
  });

  it("prefers Flash over Pro for the strong tier despite Pro being more capable", () => {
    // Pro's free-tier quota rate-limits on ordinary use; an unusable model
    // is not an upgrade.
    const tiers = selectTiers("google", [
      "gemini-pro-latest",
      "gemini-flash-latest",
    ]);
    expect(tiers?.strong).toBe("gemini-flash-latest");
  });

  it("falls back to Pro when no Flash model is available", () => {
    const tiers = selectTiers("google", ["gemini-pro-latest"]);
    expect(tiers?.strong).toBe("gemini-pro-latest");
  });

  it("filters out non-chat Google models", () => {
    const tiers = selectTiers("google", [
      "text-embedding-004",
      "imagen-3.0-generate",
      "gemini-2.5-flash-preview-tts",
      "gemini-flash-latest",
    ]);
    expect(tiers?.cheap).toBe("gemini-flash-latest");
  });

  it("handles an OpenAI account with access to exactly one model", () => {
    // The real case that broke a hardcoded gpt-4o-mini with a 403.
    const tiers = selectTiers("openai", ["gpt-5.4-mini"]);
    expect(tiers).toEqual({ cheap: "gpt-5.4-mini", strong: "gpt-5.4-mini" });
  });

  it("separates OpenAI tiers when both a mini and a full model exist", () => {
    const tiers = selectTiers("openai", ["gpt-5.4", "gpt-5.4-mini"]);
    expect(tiers?.cheap).toBe("gpt-5.4-mini");
    expect(tiers?.strong).toBe("gpt-5.4");
  });

  it("excludes OpenAI non-chat endpoints", () => {
    const tiers = selectTiers("openai", [
      "text-embedding-3-small",
      "whisper-1",
      "dall-e-3",
      "gpt-5.4-mini",
    ]);
    expect(tiers?.cheap).toBe("gpt-5.4-mini");
  });

  it("maps Anthropic tiers by model family", () => {
    const tiers = selectTiers("anthropic", [
      "claude-haiku-4-5",
      "claude-sonnet-5",
      "claude-opus-5",
    ]);
    expect(tiers).toEqual({ cheap: "claude-haiku-4-5", strong: "claude-opus-5" });
  });

  it("returns null when a provider exposes no usable chat model", () => {
    expect(selectTiers("openai", ["text-embedding-3-small"])).toBeNull();
    expect(selectTiers("google", [])).toBeNull();
  });
});
