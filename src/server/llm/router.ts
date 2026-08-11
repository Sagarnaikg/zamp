import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PROVIDERS } from "./providers";
import { getCapabilities, type ProviderCapability } from "./capabilities";
import { LlmTask, Provider, SETUP_MESSAGES } from "@/server/constants";

export interface RoutedModel {
  provider: Provider;
  modelId: string;
  model: BaseChatModel;
}

/** Tasks worth the strong tier; everything else uses the cheap one. */
const STRONG_TIER_TASKS: readonly LlmTask[] = [
  LlmTask.ExtractVision,
  LlmTask.SecondOpinion,
];

/** Error the API layer can turn into a setup message rather than a 500. */
export class NoProviderError extends Error {
  constructor(problem: string) {
    super(problem);
    this.name = "NoProviderError";
  }
}

function pickModel(capability: ProviderCapability, task: LlmTask): string {
  return STRONG_TIER_TASKS.includes(task) ? capability.strong : capability.cheap;
}

/**
 * Pick a model from what this environment can reach. `avoid` lets the second
 * reading prefer a different provider; with one configured it falls back to
 * the same one, where independence comes from tier and modality instead.
 */
export async function route(
  task: LlmTask,
  avoid?: Provider,
): Promise<RoutedModel> {
  const { providers, problem } = await getCapabilities();
  if (providers.length === 0) {
    throw new NoProviderError(problem ?? SETUP_MESSAGES.noProviderConfigured);
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
