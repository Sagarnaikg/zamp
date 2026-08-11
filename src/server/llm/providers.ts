import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  ANTHROPIC_API_VERSION,
  MODEL_LIST_LIMIT,
  MODEL_LIST_PAGE_SIZE,
  PROVIDER_URLS,
  Provider,
} from "@/server/constants";

/**
 * Per-provider knowledge in one place: how to list models, how to rank them
 * into tiers, and how to build a client. Adding a provider is one entry here
 * — see "Adding an LLM provider" in the README.
 */
export interface ProviderSpec {
  listUrl: (apiKey: string) => string;
  listHeaders: (apiKey: string) => Record<string, string>;
  parseModels: (body: unknown) => string[];
  /** Model IDs that are not general-purpose chat models. */
  exclude: RegExp;
  include: RegExp;
  /** First pattern matching an available model wins the tier. */
  cheapPreference: RegExp[];
  strongPreference: RegExp[];
  create: (modelId: string, apiKey: string) => BaseChatModel;
}

interface GoogleModelList {
  models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
}

interface IdModelList {
  data?: Array<{ id?: string }>;
}

const parseIdList = (body: unknown): string[] =>
  ((body as IdModelList).data ?? []).map((m) => m.id ?? "").filter(Boolean);

export const PROVIDERS: Record<Provider, ProviderSpec> = {
  [Provider.Google]: {
    listUrl: (key) =>
      `${PROVIDER_URLS[Provider.Google]}?key=${encodeURIComponent(key)}&pageSize=${MODEL_LIST_PAGE_SIZE}`,
    listHeaders: () => ({}),
    parseModels: (body) =>
      ((body as GoogleModelList).models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => (m.name ?? "").replace(/^models\//, ""))
        .filter(Boolean),
    exclude:
      /embedding|aqa|tts|imagen|veo|image|learnlm|gemma|thinking|native-audio|dialog|exp-|-8b|1\.0|1\.5/i,
    include: /^gemini/i,
    cheapPreference: [/flash-lite-latest/i, /flash-lite/i, /flash-latest/i, /flash/i],
    // Flash outranks Pro on purpose: Pro's free-tier quota rate-limits on
    // ordinary use, and capability that can't be called isn't capability.
    strongPreference: [/flash-latest/i, /flash(?!-lite)/i, /pro-latest/i, /pro/i],
    create: (modelId, apiKey) =>
      new ChatGoogleGenerativeAI({ model: modelId, apiKey, temperature: 0 }),
  },

  [Provider.OpenAI]: {
    listUrl: () => PROVIDER_URLS[Provider.OpenAI],
    listHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: parseIdList,
    exclude:
      /embedding|whisper|tts|dall-e|moderation|audio|realtime|transcribe|image|sora|codex|davinci|babbage|instruct/i,
    include: /^(gpt|o[134])/i,
    cheapPreference: [/nano/i, /mini/i],
    strongPreference: [/^gpt-[5-9].*(?<!mini)(?<!nano)$/i, /^gpt-4\.?1?o?$/i, /mini/i],
    create: (modelId, apiKey) =>
      new ChatOpenAI({ model: modelId, apiKey, temperature: 0 }),
  },

  [Provider.Anthropic]: {
    listUrl: () => `${PROVIDER_URLS[Provider.Anthropic]}?limit=${MODEL_LIST_LIMIT}`,
    listHeaders: (key) => ({
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_API_VERSION,
    }),
    parseModels: parseIdList,
    exclude: /claude-(1|2|instant)/i,
    include: /^claude/i,
    cheapPreference: [/haiku/i, /sonnet/i],
    strongPreference: [/opus/i, /sonnet/i, /haiku/i],
    create: (modelId, apiKey) => new ChatAnthropic({ model: modelId, apiKey }),
  },
};
