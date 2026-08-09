# Zamp — Invoice & Receipt Intelligence

Turn messy invoices, receipts, and expense documents into a clean, queryable
expense ledger — with field-level confidence you can actually defend.

> Work in progress. Full setup guide and product walkthrough land with the
> final polish pass. Design decisions are logged as they happen in
> [decisions.md](decisions.md).

## Quick start

```bash
cp .env.example .env   # then set DATABASE_URL and one LLM provider key
docker compose up -d   # local Postgres (or point DATABASE_URL anywhere)
npm install
npx drizzle-kit migrate
npm run dev
```
