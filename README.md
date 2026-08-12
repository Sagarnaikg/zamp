# Zamp — Invoice & Receipt Intelligence

Turn invoices, receipts, and expense documents into a clean, queryable expense ledger.

Zamp extracts invoice data, validates the extracted values, assigns field-level confidence, and sends uncertain fields for review. Once processed, documents can be browsed in a table or queried using plain English.

> **Want to understand the engineering decisions behind the project?**  
> See the [project documentation](#documentation).

---

## What does it do?

The system is built around a simple flow:

1. Upload an invoice or receipt.
2. Extract its fields using an LLM.
3. Validate the extracted values and calculate confidence per field.
4. Re-check uncertain fields when needed.
5. Review anything that still looks unreliable.
6. Store accepted documents in a queryable expense ledger.
7. Ask questions about the ledger using plain English.

The main goal is not just extraction — it's making the extracted data **trustworthy and reviewable**.

---

## Features

- 📄 Invoice and receipt upload
- 🔍 LLM-based document extraction
- 🎯 Field-level confidence scoring
- ✅ Arithmetic and format validation
- 🔄 Optional cross-provider verification
- 👀 Manual review for uncertain fields
- 📊 Queryable expense ledger
- 💬 Natural-language questions about expenses
- 🧾 Traceable extraction and query results
- 🧪 Sample documents for testing

---

## Tech Stack

| Area         | Technology                 |
| ------------ | -------------------------- |
| Framework    | Next.js, React, TypeScript |
| Database     | PostgreSQL + Drizzle ORM   |
| LLM          | LangChain                  |
| Validation   | Zod                        |
| Server State | TanStack Query             |
| Client State | Zustand                    |
| Styling      | Tailwind CSS               |
| Forms        | React Hook Form            |
| Testing      | Vitest + Testing Library   |
| File Storage | Local disk / Vercel Blob   |

---

## Prerequisites

You'll need:

- **Node.js ≥ 20.9**
- **npm**
- **PostgreSQL**
- **At least one supported LLM API key**

The project currently supports Google Gemini, OpenAI, and Anthropic.

You only need **one provider** to run the application. Adding more providers enables cross-provider verification for better confidence scoring.

---

## Local Setup

The goal is to get the project running with as little setup as possible.

### 1. Clone the repository

```bash
git clone https://github.com/Sagarnaikg/zamp.git
cd zamp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=<db_url>

GOOGLE_API_KEY=your_key
# OPENAI_API_KEY=your_key
# ANTHROPIC_API_KEY=your_key
```

Only **one LLM provider key is required**.

For optional managed file storage:

```env
BLOB_READ_WRITE_TOKEN=your_token
```

Without this, files are stored locally in `./uploads`.

### 4. Start PostgreSQL

If you don't already have PostgreSQL running:

```bash
docker compose up -d
```

Or use any PostgreSQL instance and set its connection string in `DATABASE_URL`.

### 5. Run database migrations

```bash
npm run db:migrate
```

### 6. Start the application

```bash
npm run dev
```

The application will be available at:

**http://localhost:3000**

That's it. The frontend and backend run from the same Next.js application.

---

## Useful Commands

### Development

```bash
npm run dev
```

### Production build

```bash
npm run build
npm run start
```

### Tests

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
public/samples/        # Demo documents with known planted problems, downloadable from the upload panel
```

Root config files (`package.json`, `tsconfig.json`, `next.config.ts`,
`drizzle.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
`docker-compose.yml`) stay at the root — that's where their tools look for them.
