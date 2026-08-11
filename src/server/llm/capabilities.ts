import { PROVIDERS } from "./providers";
import {
  PROVIDER_KEY_VARS,
  PROVIDER_ORDER,
  Provider,
  SETUP_MESSAGES,
  TIMEOUTS,
} from "@/server/constants";

/**
 * Startup capability discovery (decisions.md §19): ask each configured
 * provider which models this account can reach, rather than hardcoding IDs
 * that differ per account and get retired without notice.
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

export interface ConfiguredKey {
  provider: Provider;
  apiKey: string;
}

/** Configured providers in preference order; strips stray quotes. */
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
    signal: AbortSignal.timeout(TIMEOUTS.modelListMs),
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
    // Other configured providers can still carry the app.
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
      problem: SETUP_MESSAGES.noKeyConfigured,
      discoveredAt,
    };
  }

  const results = await Promise.all(configured.map(probe));
  const providers = results.filter((r): r is ProviderCapability => r !== null);

  if (providers.length === 0) {
    const names = configured.map((c) => PROVIDER_KEY_VARS[c.provider]).join(", ");
    return {
      ready: false,
      providers: [],
      problem: SETUP_MESSAGES.noUsableModel(names),
      discoveredAt,
    };
  }

  return { ready: true, providers, problem: null, discoveredAt };
}

let cached: Promise<Capabilities> | null = null;

/** Runs once per process; `/api/status` lets the UI wait on it explicitly. */
export function getCapabilities(): Promise<Capabilities> {
  cached ??= discover(process.env);
  return cached;
}

/** Re-probe after a key is added. */
export function resetCapabilities(): void {
  cached = null;
}
