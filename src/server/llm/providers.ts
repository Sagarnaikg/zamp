import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

/**
 * Per-provider knowledge in one place: how to list models, how to rank them
 * into tiers, and how to construct a chat client. Adding a provider means
 * adding one entry here — nothing else in the app changes.
 */

export type Provider = "google" | "openai" | "anthropic";

/** Preference order when several providers are configured. */
export const PROVIDER_ORDER: Provider[] = ["google", "openai", "anthropic"];

export interface ProviderSpec {
  listUrl: (apiKey: string) => string;
  listHeaders: (apiKey: string) => Record<string, string>;
  parseModels: (body: unknown) => string[];
  /** Model IDs that are not general-purpose chat models. */
  exclude: RegExp;
  include: RegExp;
  /** First pattern that matches an available model wins. */
  cheapPreference: RegExp[];
  strongPreference: RegExp[];
  create: (modelId: string, apiKey: string) => BaseChatModel;
}

export const PROVIDERS: Record<Provider, ProviderSpec> = {
  google: {
    listUrl: (key) =>
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`,
    listHeaders: () => ({}),
    parseModels: (body) => {
      const models = (body as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }).models ?? [];
      return models
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => (m.name ?? "").replace(/^models\//, ""))
        .filter(Boolean);
    },
    exclude:
      /embedding|aqa|tts|imagen|veo|image|learnlm|gemma|thinking|native-audio|dialog|exp-|-8b|1\.0|1\.5/i,
    include: /^gemini/i,
    // -latest aliases track the current model, so prefer them over pinned dates.
    cheapPreference: [/flash-lite-latest/i, /flash-lite/i, /flash-latest/i, /flash/i],
    // Flash outranks Pro for the strong tier on purpose: Pro's free-tier
    // quota is small enough that it rate-limits on ordinary use, and Flash
    // is fully multimodal. Capability that can't be called isn't capability.
    strongPreference: [/flash-latest/i, /flash(?!-lite)/i, /pro-latest/i, /pro/i],
    create: (modelId, apiKey) =>
      new ChatGoogleGenerativeAI({ model: modelId, apiKey, temperature: 0 }),
  },

  openai: {
    listUrl: () => "https://api.openai.com/v1/models",
    listHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: (body) =>
      ((body as { data?: Array<{ id?: string }> }).data ?? [])
        .map((m) => m.id ?? "")
        .filter(Boolean),
    exclude:
      /embedding|whisper|tts|dall-e|moderation|audio|realtime|transcribe|image|sora|codex|davinci|babbage|instruct/i,
    include: /^(gpt|o[134])/i,
    cheapPreference: [/nano/i, /mini/i],
    strongPreference: [/^gpt-[5-9].*(?<!mini)(?<!nano)$/i, /^gpt-4\.?1?o?$/i, /mini/i],
    create: (modelId, apiKey) =>
      new ChatOpenAI({ model: modelId, apiKey, temperature: 0 }),
  },

  anthropic: {
    listUrl: () => "https://api.anthropic.com/v1/models?limit=100",
    listHeaders: (key) => ({
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    }),
    parseModels: (body) =>
      ((body as { data?: Array<{ id?: string }> }).data ?? [])
        .map((m) => m.id ?? "")
        .filter(Boolean),
    exclude: /claude-(1|2|instant)/i,
    include: /^claude/i,
    cheapPreference: [/haiku/i, /sonnet/i],
    strongPreference: [/opus/i, /sonnet/i, /haiku/i],
    create: (modelId, apiKey) =>
      new ChatAnthropic({ model: modelId, apiKey }),
  },
};
