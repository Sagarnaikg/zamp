import { NextResponse } from "next/server";
import { getCapabilities, resetCapabilities } from "@/server/llm/capabilities";

/**
 * Setup readiness for the UI: which providers were discovered, which models
 * they resolved to, and — when nothing is usable — a message worth showing
 * the user instead of letting their first upload fail (decisions.md §19).
 */
export async function GET() {
  const capabilities = await getCapabilities();
  return NextResponse.json(
    {
      ready: capabilities.ready,
      problem: capabilities.problem,
      discoveredAt: capabilities.discoveredAt,
      // API keys never leave the server.
      providers: capabilities.providers.map((p) => ({
        provider: p.provider,
        cheap: p.cheap,
        strong: p.strong,
        modelCount: p.availableModels.length,
      })),
      crossProviderAgreement: capabilities.providers.length > 1,
    },
    { status: capabilities.ready ? 200 : 503 },
  );
}

/** Re-probe after the user adds or fixes a key, without a restart. */
export async function POST() {
  resetCapabilities();
  const capabilities = await getCapabilities();
  return NextResponse.json(
    { ready: capabilities.ready, problem: capabilities.problem },
    { status: capabilities.ready ? 200 : 503 },
  );
}
