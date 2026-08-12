# Zamp — Invoice & Receipt Intelligence

Turn messy invoices, receipts, and expense documents into a clean, queryable
expense ledger — with field-level confidence you can actually defend, and a
plain-language interface for asking questions about what's in it.

> Every real decision made while building this — and why the alternatives
> were rejected — is logged as it happened in [decisions.md](decisions.md).
> This README is about running the thing; that file is about why it's built
> the way it is.

## What is this?

A finance person uploads an invoice, receipt, or scan. The system reads it,
checks its own arithmetic, cross-reads it with a second model when that's
worth paying for, and scores every extracted field independently — so the
person reviewing it knows exactly which numbers to trust and which to check
by eye, instead of silently trusting a single LLM's output. Once a document
is accepted, it lands in an expense ledger you can browse as a table or ask
about in plain English ("how much did we spend on software last quarter?"),
with every answer traceable back to the specific filters it ran and the
specific documents it matched.

The interesting engineering problem here isn't "call an LLM to extract
fields" — it's building a system a finance user can actually trust the output
of, given that no single extraction is ever 100% reliable.

## Architecture at a glance

- **One Next.js app, not a separate frontend/backend.** App Router pages and
  API routes live in the same codebase and deploy together; there's nothing
  to run in two terminals.
- **Multi-provider LLM routing.** Google, OpenAI, and Anthropic are supported
  through a single LangChain interface. Only one provider key is required —
  the app discovers which models your account can actually reach at startup
  rather than hardcoding model IDs, and a second configured provider
  automatically strengthens the confidence engine (see below).
- **The confidence engine** combines four independent signals per field —
  arithmetic reconciliation, format/plausibility, cross-model agreement, and
  duplicate detection — into a confidence score, with an escalation ladder
  that settles disagreements with a focused third reading before handing
  anything unresolved to a human.
- **Every ingestion run is traced** stage by stage (what ran, what was
  skipped and why, which model, what it cost) and rendered as a graph in the
  review UI — not just logged, but shown.
- **No accounts.** Workspaces are anonymous and per-browser, via an httpOnly
  cookie set on first visit. This is intentionally the seam where real auth
  would attach later.
- **Ask-the-ledger conversations persist.** Questions and their answers
  (the filters that actually ran, not the model's restatement of them) are
  stored per thread, so a conversation survives a reload and can be reopened
  without re-asking.

## Tech stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| LLM | LangChain's unified chat-model interface — Google Gemini, OpenAI, Anthropic |
| Validation | Zod — both LLM structured output and the NL→SQL-safe query DSL |
| Frontend state | TanStack Query (server state) + Zustand (the one piece of client-only global state) |
| Styling | Tailwind CSS v4 + Framer Motion |
| Forms | React Hook Form |
| Testing | Vitest + Testing Library |
| File storage | Local disk in dev, Vercel Blob in production (auto-selected) |

## Prerequisites

- **Node.js ≥ 20.9** (required by Next.js 16) and npm
- **A PostgreSQL database.** Either Docker (for the one-command setup below)
  or any Postgres instance you already have — a connection string is all
  that's needed
- **At least one LLM provider API key** — Google, OpenAI, or Anthropic

## Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Any Postgres connection string. Matches `docker-compose.yml` by default. |
| `GOOGLE_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | At least one | The app discovers usable models per provider at startup — no model IDs to configure. A second key improves confidence scoring via cross-provider agreement. |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob storage for uploads. Unset in local dev — files go to `./uploads` on disk instead. |
| `NEXT_PUBLIC_API_BASE_URL` | No | Client-side API base URL. Leave unset for same-origin (the normal case). |
| `NEXT_PUBLIC_ERROR_REPORTING_URL` | No | Where client-side error reports are POSTed in production. Leave unset to disable. |

Check setup at any time — locally or once deployed — with `GET /api/status`:
it reports which providers were found, which models they resolved to, and a
plain-English problem message if nothing usable was reachable.

## Local setup

```bash
docker compose up -d   # starts local Postgres — skip if DATABASE_URL points elsewhere
npm install
npm run db:migrate
npm run dev
```

The app is now running at [http://localhost:3000](http://localhost:3000).

## Running the app

There's a single dev server — Next.js serves the pages and the API routes
together, so `npm run dev` is the only thing to run.

```bash
npm run dev      # start the dev server (http://localhost:3000)
npm run build    # production build
npm run start    # run a production build locally (after `npm run build`)
```

## Running tests

```bash
npm test          # unit tests (Vitest) — server logic and UI components
npm run typecheck # TypeScript, no output emitted
npm run lint      # ESLint
```

Tests live under `tests/`, mirroring the `src/` tree they cover, split into a
Node-environment project for server logic and a jsdom project for components.

## Database

```bash
npm run db:generate   # generate a migration from schema.ts changes
npm run db:migrate     # apply pending migrations
```

Schema lives in `src/server/db/schema.ts`; generated SQL migrations live in
`src/server/db/migrations/`.

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
│   ├── services/      #   Business logic / use-cases (ingestion, review, query, conversations)
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
