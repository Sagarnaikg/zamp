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

# Required: at least ONE LLM provider key. Multiple keys unlock
# cross-provider routing and the cross-model agreement signal.
GOOGLE_API_KEY=...
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...

# Optional: Vercel Blob storage. When unset, files are stored in ./uploads.
# BLOB_READ_WRITE_TOKEN=...
```

Then:

```bash
docker compose up -d   # local Postgres (skip if DATABASE_URL points elsewhere)
npm install
npx drizzle-kit migrate
npm run dev
```

## Project structure

```
src/
├── app/               # Routing layer — Next.js pages + API endpoints, kept thin
│   └── api/           #   HTTP only: parse request → call service → shape response
├── components/        # Frontend layer — reusable React components
├── server/            # Backend layer — never imported by client code
│   ├── services/      #   Business logic / use-cases (ingestion, review, query)
│   ├── db/            #   Drizzle schema + client + SQL migrations
│   ├── storage/       #   File storage drivers (local disk / Vercel Blob)
│   ├── llm/           #   ML layer: model router, extraction, query translation
│   ├── ingest/        #   File-kind detection (digital PDF vs scan vs image)
│   └── confidence/    #   Field-level confidence engine (signals + reasons)
└── middleware.ts      # Anonymous per-browser workspace cookie

samples/               # Test/demo documents with known planted problems
scripts/               # Dev tooling (sample document generation)
```

Root config files (`package.json`, `tsconfig.json`, `next.config.ts`,
`drizzle.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
`docker-compose.yml`) stay at the root — that's where their tools look for them.
