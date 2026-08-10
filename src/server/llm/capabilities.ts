import type { Provider } from "./providers";
import { PROVIDERS, PROVIDER_ORDER } from "./providers";

/**
 * Startup capability discovery (decisions.md §19).
 *
 * Model availability is per-key, not universal: the same provider will serve
 * different model sets to different accounts, and IDs are retired without
 * notice. Hardcoding them means a reviewer with a valid key can still hit a
 * 404/403 and has to edit source to fix it. Instead we ask each provider
 * what this key can actually use, then pick tiers from what came back.
 *
 * Keys are supplied generically — LLM_API_KEY / LLM_API_KEYS — and the
 * provider is identified from the key itself, so setup is "paste your
 * key(s)" with no per-provider variable to get right.
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

/** Read keys from the generic vars first, then the per-provider ones. */
export function collectApiKeys(env: EnvLike): string[] {
  const raw = [
    env.LLM_API_KEY,
    ...(env.LLM_API_KEYS?.split(",") ?? []),
    // Per-provider names still work for anyone who prefers being explicit.
    env.GOOGLE_API_KEY,
    env.OPENAI_API_KEY,
    env.ANTHROPIC_API_KEY,
  ];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const value of raw) {
    const key = value?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/**
 * Identify a provider from the key's shape. A hint only — discovery
 * confirms it by actually listing models, so a wrong guess self-corrects.
 */
export function guessProvider(apiKey: string): Provider | null {
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("sk-")) return "openai";
  if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) return "google";
  return null;
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

async function probeKey(apiKey: string): Promise<ProviderCapability | null> {
  // Try the guessed provider first, then the rest — a key whose format we
  // don't recognize still works, it just costs an extra request or two.
  const guess = guessProvider(apiKey);
  const order = guess
    ? [guess, ...PROVIDER_ORDER.filter((p) => p !== guess)]
    : PROVIDER_ORDER;

  for (const provider of order) {
    try {
      const models = await listModels(provider, apiKey);
      const tiers = selectTiers(provider, models);
      if (!tiers) continue;
      return { provider, apiKey, ...tiers, availableModels: models };
    } catch {
      // Wrong provider for this key, or provider unreachable — try the next.
    }
  }
  return null;
}

async function discover(env: EnvLike): Promise<Capabilities> {
  const keys = collectApiKeys(env);
  const discoveredAt = new Date().toISOString();

  if (keys.length === 0) {
    return {
      ready: false,
      providers: [],
      problem:
        "No LLM API key found. Add LLM_API_KEY=your-key to .env (OpenAI, Anthropic, or Google keys all work), then restart.",
      discoveredAt,
    };
  }

  const results = await Promise.all(keys.map(probeKey));
  const providers = results.filter((r): r is ProviderCapability => r !== null);

  if (providers.length === 0) {
    return {
      ready: false,
      providers: [],
      problem:
        "Found API key(s), but none could reach a usable model. The key may be invalid, revoked, or the account may not have access to any chat model.",
      discoveredAt,
    };
  }

  // Deduplicate: two keys for the same provider add nothing.
  const byProvider = new Map<Provider, ProviderCapability>();
  for (const capability of providers) {
    if (!byProvider.has(capability.provider)) {
      byProvider.set(capability.provider, capability);
    }
  }
  const ordered = PROVIDER_ORDER.map((p) => byProvider.get(p)).filter(
    (c): c is ProviderCapability => c !== undefined,
  );

  return { ready: true, providers: ordered, problem: null, discoveredAt };
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
