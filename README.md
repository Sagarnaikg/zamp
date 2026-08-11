# Zamp — Invoice & Receipt Intelligence

Turn messy invoices, receipts, and expense documents into a clean, queryable
expense ledger — with field-level confidence you can actually defend.

> Work in progress. Full setup guide and product walkthrough land with the
> final polish pass. Design decisions are logged as they happen in
> [decisions.md](decisions.md).

## Quick start

Create a `.env` file in the project root:

```bash
# Required: any Postgres connection string (docker compose up -d gives you this one)
DATABASE_URL=postgres://zamp:zamp@localhost:5432/zamp_dev

# Required: at least ONE provider key. On startup the app asks each
# configured provider which models your account can actually use, so there
# are no model IDs to pin or keep up to date.
GOOGLE_API_KEY=your-key-here
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
#
# A second provider strengthens the confidence engine's agreement signal:
# two providers read each document, instead of one provider reading it two
# different ways.

# Optional: Vercel Blob storage. When unset, files are stored in ./uploads.
# BLOB_READ_WRITE_TOKEN=...
```

Check setup at any time with `GET /api/status` — it reports which providers
were found, which models they resolved to, and a plain-English problem
message if nothing usable was reachable.

Then:

```bash
docker compose up -d   # local Postgres (skip if DATABASE_URL points elsewhere)
npm install
npx drizzle-kit migrate
npm run dev
```

## Adding an LLM provider

The app ships with Google, OpenAI, and Anthropic — deliberately not an
open-ended plugin system, since each provider needs a LangChain integration
package anyway, which makes adding one a code change regardless.

Everything provider-specific lives in `src/server/llm/providers.ts`. Adding a
fourth is one entry there, plus its key variable:

1. **Install the integration:** `npm install @langchain/<provider>`

2. **Extend the union** in `providers.ts`:
   ```ts
   export type Provider = "google" | "openai" | "anthropic" | "mistral";
   ```
   This is the useful part: `PROVIDERS` and `PROVIDER_KEY_VARS` are both
   `Record<Provider, …>`, so **the build now fails until every required piece
   is filled in.** The compiler walks you through the rest rather than letting
   you half-add a provider.

3. **Add it to `PROVIDER_ORDER`** — this is the preference order when several
   providers are configured; the first is used for primary extraction.

4. **Add its `PROVIDERS` entry**, which answers five questions:
   - `listUrl` / `listHeaders` / `parseModels` — how to ask the provider which
     models this account can use (that's what runtime discovery calls)
   - `include` / `exclude` — which of those model IDs are general-purpose chat
     models, versus embeddings, TTS, image generation, etc.
   - `cheapPreference` / `strongPreference` — ordered regex lists; the first
     pattern that matches an available model wins that tier
   - `create` — build a LangChain chat client for a model ID + key

5. **Add the key variable** to `PROVIDER_KEY_VARS` in `capabilities.ts`
   (e.g. `mistral: "MISTRAL_API_KEY"`).

6. **Only if the provider needs a non-standard attachment format**, add a case
   to `fileBlock()` in `extraction.ts`. Most providers accept LangChain's
   standard file/image blocks; Google is special-cased there because
   `@langchain/google-genai` gates standard file blocks behind a model-name
   check that rejects its own `-latest` aliases.

Nothing else changes — the router, confidence engine, and services are all
provider-agnostic. There are no model IDs to pin: discovery asks the provider
what the account can reach and ranks the answer into tiers.

## Project structure

```
src/
├── app/               # Routing layer — Next.js pages + API endpoints, kept thin
│   └── api/           #   HTTP only: parse request → call service → shape response
├── components/        # Presentation layer
│   ├── ui/            #   Design system — generic, knows nothing about invoices
│   ├── domain/        #   Shared across features, meaningless outside this product
│   └── layout/        #   App shell, navigation
├── features/          # Feature layer — api + hooks + types per feature
├── config/            # Validated client env + feature flags
├── constants/         # Client-side constants (routes, UI enums, copy)
├── lib/               # API client, query client, observability, utils
├── server/            # Backend layer — never imported by client code
│   ├── services/      #   Business logic / use-cases (ingestion, review, query)
│   ├── constants/     #   Enums + config + user-facing messages, single source of truth
│   ├── db/            #   Drizzle schema + client + SQL migrations
│   ├── storage/       #   File storage drivers (local disk / Vercel Blob)
│   ├── llm/           #   ML layer: model router, extraction, query translation
│   ├── ingest/        #   File-kind detection (digital PDF vs scan vs image)
│   └── confidence/    #   Field-level confidence engine (signals + reasons)
└── middleware.ts      # Anonymous per-browser workspace cookie

tests/                 # Unit tests, mirroring the src/ tree (e.g. tests/server/llm/errors.test.ts)
samples/               # Test/demo documents with known planted problems
scripts/               # Dev tooling (sample document generation)
```

Root config files (`package.json`, `tsconfig.json`, `next.config.ts`,
`drizzle.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
`docker-compose.yml`) stay at the root — that's where their tools look for them.
