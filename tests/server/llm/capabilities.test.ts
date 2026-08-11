import { describe, expect, it } from "vitest";
import { configuredKeys, selectTiers } from "@/server/llm/capabilities";
import { Provider } from "@/server/constants";

describe("configuredKeys", () => {
  it("binds each key to the provider whose variable it sits in", () => {
    const keys = configuredKeys({
      GOOGLE_API_KEY: "g-key",
      OPENAI_API_KEY: "o-key",
    });
    expect(keys).toEqual([
      { provider: "google", apiKey: "g-key" },
      { provider: "openai", apiKey: "o-key" },
    ]);
  });

  it("returns providers in preference order regardless of env ordering", () => {
    const keys = configuredKeys({
      ANTHROPIC_API_KEY: "a-key",
      GOOGLE_API_KEY: "g-key",
    });
    expect(keys.map((k) => k.provider)).toEqual(["google", "anthropic"]);
  });

  it("works with a single provider configured", () => {
    expect(configuredKeys({ OPENAI_API_KEY: "o-key" })).toEqual([
      { provider: "openai", apiKey: "o-key" },
    ]);
  });

  it("strips stray quotes left around a key", () => {
    expect(configuredKeys({ GOOGLE_API_KEY: '"g-key"' })).toEqual([
      { provider: "google", apiKey: "g-key" },
    ]);
  });

  it("ignores blank and whitespace-only values", () => {
    expect(configuredKeys({ GOOGLE_API_KEY: "   ", OPENAI_API_KEY: "" })).toEqual(
      [],
    );
  });

  it("returns nothing when no key is configured", () => {
    expect(configuredKeys({})).toEqual([]);
  });
});

describe("selectTiers", () => {
  it("prefers -latest aliases over pinned dated Gemini models", () => {
    const tiers = selectTiers(Provider.Google, [
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
    const tiers = selectTiers(Provider.Google, [
      "gemini-pro-latest",
      "gemini-flash-latest",
    ]);
    expect(tiers?.strong).toBe("gemini-flash-latest");
  });

  it("falls back to Pro when no Flash model is available", () => {
    const tiers = selectTiers(Provider.Google, ["gemini-pro-latest"]);
    expect(tiers?.strong).toBe("gemini-pro-latest");
  });

  it("filters out non-chat Google models", () => {
    const tiers = selectTiers(Provider.Google, [
      "text-embedding-004",
      "imagen-3.0-generate",
      "gemini-2.5-flash-preview-tts",
      "gemini-flash-latest",
    ]);
    expect(tiers?.cheap).toBe("gemini-flash-latest");
  });

  it("handles an OpenAI account with access to exactly one model", () => {
    // The real case that broke a hardcoded gpt-4o-mini with a 403.
    const tiers = selectTiers(Provider.OpenAI, ["gpt-5.4-mini"]);
    expect(tiers).toEqual({ cheap: "gpt-5.4-mini", strong: "gpt-5.4-mini" });
  });

  it("separates OpenAI tiers when both a mini and a full model exist", () => {
    const tiers = selectTiers(Provider.OpenAI, ["gpt-5.4", "gpt-5.4-mini"]);
    expect(tiers?.cheap).toBe("gpt-5.4-mini");
    expect(tiers?.strong).toBe("gpt-5.4");
  });

  it("excludes OpenAI non-chat endpoints", () => {
    const tiers = selectTiers(Provider.OpenAI, [
      "text-embedding-3-small",
      "whisper-1",
      "dall-e-3",
      "gpt-5.4-mini",
    ]);
    expect(tiers?.cheap).toBe("gpt-5.4-mini");
  });

  it("maps Anthropic tiers by model family", () => {
    const tiers = selectTiers(Provider.Anthropic, [
      "claude-haiku-4-5",
      "claude-sonnet-5",
      "claude-opus-5",
    ]);
    expect(tiers).toEqual({ cheap: "claude-haiku-4-5", strong: "claude-opus-5" });
  });

  it("returns null when a provider exposes no usable chat model", () => {
    expect(selectTiers(Provider.OpenAI, ["text-embedding-3-small"])).toBeNull();
    expect(selectTiers(Provider.Google, [])).toBeNull();
  });
});
