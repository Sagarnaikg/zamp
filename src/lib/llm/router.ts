import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

/**
 * Environment-adaptive model router (decisions.md §6).
 *
 * One provider key is enough to run everything; with multiple keys the
 * second-opinion task automatically lands on a different provider, which
 * is what makes the cross-model agreement signal meaningful.
 */

export type Provider = "google" | "openai" | "anthropic";

export type Task =
  | "extract_vision" // scans/photos → strong vision model
  | "extract_text" // digital-PDF text → cheap text model
  | "second_opinion" // re-extraction, ideally on a different provider
  | "query_translate"; // NL → filter DSL, cheap and fast

/** Model IDs per provider, tiered. Pinned here so there is one place to update. */
const MODELS: Record<Provider, { cheap: string; strong: string }> = {
  google: { cheap: "gemini-flash-lite-latest", strong: "gemini-flash-latest" },
  openai: { cheap: "gpt-4o-mini", strong: "gpt-4o-mini" },
  anthropic: { cheap: "claude-haiku-4-5", strong: "claude-sonnet-5" },
};

/** Preference order reflects available quota (decisions.md §6). */
const PROVIDER_PREFERENCE: Provider[] = ["google", "openai", "anthropic"];

const KEY_VARS: Record<Provider, string> = {
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export function availableProviders(): Provider[] {
  return PROVIDER_PREFERENCE.filter((p) => !!process.env[KEY_VARS[p]]);
}

function makeModel(provider: Provider, modelId: string): BaseChatModel {
  switch (provider) {
    case "google":
      return new ChatGoogleGenerativeAI({ model: modelId, temperature: 0 });
    case "openai":
      return new ChatOpenAI({ model: modelId, temperature: 0 });
    case "anthropic":
      return new ChatAnthropic({ model: modelId });
  }
}

export interface RoutedModel {
  provider: Provider;
  modelId: string;
  model: BaseChatModel;
}

/**
 * Pick a model for a task. `avoid` lets the second-opinion task request a
 * different provider than the primary extraction used; if only one provider
 * is configured, this returns null and the agreement signal switches off.
 */
export function route(task: Task, avoid?: Provider): RoutedModel | null {
  const providers = availableProviders();
  if (providers.length === 0) {
    throw new Error(
      "No LLM provider key configured. Set at least one of " +
        Object.values(KEY_VARS).join(", ") +
        " in .env",
    );
  }

  let candidates = providers;
  if (avoid) {
    candidates = providers.filter((p) => p !== avoid);
    if (task === "second_opinion" && candidates.length === 0) {
      return null;
    }
    if (candidates.length === 0) candidates = providers;
  }

  const provider = candidates[0];
  const tier = task === "extract_vision" ? "strong" : "cheap";
  const modelId = MODELS[provider][tier];
  return { provider, modelId, model: makeModel(provider, modelId) };
}
