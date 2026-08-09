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
