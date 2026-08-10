import type { Provider } from "./providers";
import { PROVIDERS, PROVIDER_ORDER } from "./providers";

/**
 * Startup capability discovery (decisions.md §19).
 *
 * Model availability is per-key, not universal: the same provider serves
 * different model sets to different accounts, and IDs are retired without
 * notice. Hardcoding them means a reviewer with a valid key can still hit a
 * 404/403 and has to edit source to fix it. Instead we ask each configured
 * provider what this key can actually use, then pick tiers from what came
 * back.
 *
 * Keys are named per provider — GOOGLE_API_KEY, OPENAI_API_KEY,
 * ANTHROPIC_API_KEY — so a key is bound to its provider by the variable it
 * sits in, with nothing to infer.
 */

export interface ProviderCapability {
  provider: Provider;
  apiKey: string;
  /** Cheapest usable model — frequent, simple tasks. */
  cheap: string;
  /** Most capable usable model — vision and second readings. */
  strong: string;
  availableModels: string[];
}

export interface Capabilities {
  ready: boolean;
  providers: ProviderCapability[];
  /** Why discovery produced nothing usable — safe to show a user. */
  problem: string | null;
  discoveredAt: string;
}

type EnvLike = Record<string, string | undefined>;

/** The environment variable each provider's key lives in. */
export const PROVIDER_KEY_VARS: Record<Provider, string> = {
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export interface ConfiguredKey {
  provider: Provider;
  apiKey: string;
}

/**
 * Which providers have a key configured, in preference order. Quotes are
 * stripped because they're easy to leave in by accident and never part of a
 * real key.
 */
export function configuredKeys(env: EnvLike): ConfiguredKey[] {
  const keys: ConfiguredKey[] = [];
  for (const provider of PROVIDER_ORDER) {
    const raw = env[PROVIDER_KEY_VARS[provider]]?.trim();
    if (!raw) continue;
    const apiKey = raw.replace(/^["']|["']$/g, "").trim();
    if (apiKey) keys.push({ provider, apiKey });
  }
  return keys;
}

/** Rank the models a key can actually use into a cheap and a strong tier. */
export function selectTiers(
  provider: Provider,
  modelIds: string[],
): { cheap: string; strong: string } | null {
  const spec = PROVIDERS[provider];
  const usable = modelIds.filter(
    (id) => !spec.exclude.test(id) && spec.include.test(id),
  );
  if (usable.length === 0) return null;

  const best = (patterns: RegExp[]): string => {
    for (const pattern of patterns) {
      const match = usable.find((id) => pattern.test(id));
      if (match) return match;
    }
    return usable[0];
  };

  return {
    cheap: best(spec.cheapPreference),
    strong: best(spec.strongPreference),
  };
}

async function listModels(provider: Provider, apiKey: string): Promise<string[]> {
  const spec = PROVIDERS[provider];
  const response = await fetch(spec.listUrl(apiKey), {
    headers: spec.listHeaders(apiKey),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`${provider} returned ${response.status}`);
  }
  return spec.parseModels(await response.json());
}

async function probe({
  provider,
  apiKey,
}: ConfiguredKey): Promise<ProviderCapability | null> {
  try {
    const models = await listModels(provider, apiKey);
    const tiers = selectTiers(provider, models);
    if (!tiers) return null;
    return { provider, apiKey, ...tiers, availableModels: models };
  } catch {
    // Bad key, revoked key, or the provider is unreachable — the other
    // configured providers can still carry the app.
    return null;
  }
}

async function discover(env: EnvLike): Promise<Capabilities> {
  const configured = configuredKeys(env);
  const discoveredAt = new Date().toISOString();

  if (configured.length === 0) {
    return {
      ready: false,
      providers: [],
      problem: `No LLM API key found. Add one of ${Object.values(PROVIDER_KEY_VARS).join(", ")} to .env, then restart.`,
      discoveredAt,
    };
  }

  const results = await Promise.all(configured.map(probe));
  const providers = results.filter((r): r is ProviderCapability => r !== null);

  if (providers.length === 0) {
    const names = configured
      .map((c) => PROVIDER_KEY_VARS[c.provider])
      .join(", ");
    return {
      ready: false,
      providers: [],
      problem: `Found ${names}, but no usable model could be reached. The key may be invalid or revoked, or the account may not have access to any chat model.`,
      discoveredAt,
    };
  }

  return { ready: true, providers, problem: null, discoveredAt };
}

let cached: Promise<Capabilities> | null = null;

/**
 * Discovery runs once per process and is shared by every caller. The first
 * request pays for it; `/api/status` lets the UI wait on it explicitly
 * instead of a user watching an upload hang.
 */
export function getCapabilities(): Promise<Capabilities> {
  cached ??= discover(process.env);
  return cached;
}

/** Re-probe (used after a key is added, and by tests). */
export function resetCapabilities(): void {
  cached = null;
}
