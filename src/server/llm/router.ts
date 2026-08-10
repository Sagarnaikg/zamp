import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PROVIDERS, type Provider } from "./providers";
import { getCapabilities, type ProviderCapability } from "./capabilities";

export type { Provider };

export type Task =
  | "extract_vision" // scans/photos → strong model
  | "extract_text" // digital-PDF text → cheap model
  | "second_opinion" // independent re-reading for the agreement signal
  | "query_translate"; // NL → filter DSL, cheap and fast

export interface RoutedModel {
  provider: Provider;
  modelId: string;
  model: BaseChatModel;
}

/** Error the API layer can turn into a setup message rather than a 500. */
export class NoProviderError extends Error {
  constructor(problem: string) {
    super(problem);
    this.name = "NoProviderError";
  }
}

function pickModel(capability: ProviderCapability, task: Task): string {
  // Vision extraction and second readings get the strong tier; frequent,
  // simple tasks get the cheap one (decisions.md §6).
  return task === "extract_vision" || task === "second_opinion"
    ? capability.strong
    : capability.cheap;
}

/**
 * Pick a model for a task from what this environment can actually reach.
 * `avoid` lets the second reading prefer a different provider than the
 * primary used; with one provider configured it falls back to the same one,
 * where independence comes from the tier and modality difference instead.
 */
export async function route(task: Task, avoid?: Provider): Promise<RoutedModel> {
  const { providers, problem } = await getCapabilities();
  if (providers.length === 0) {
    throw new NoProviderError(problem ?? "No usable LLM provider configured.");
  }

  const preferred = avoid
    ? providers.filter((p) => p.provider !== avoid)
    : providers;
  const capability = preferred[0] ?? providers[0];

  const modelId = pickModel(capability, task);
  return {
    provider: capability.provider,
    modelId,
    model: PROVIDERS[capability.provider].create(modelId, capability.apiKey),
  };
}
