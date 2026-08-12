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

| Area | Technology |
|---|---|
| Framework | Next.js, React, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| LLM | LangChain |
| Validation | Zod |
| Server State | TanStack Query |
| Client State | Zustand |
| Styling | Tailwind CSS |
| Forms | React Hook Form |
| Testing | Vitest + Testing Library |
| File Storage | Local disk / Vercel Blob |

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
git clone <repository-url>
cd zamp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgres://zamp:zamp@localhost:5432/zamp_dev

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
npm test
```

### Type checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Database

```bash
npm run db:generate
npm run db:migrate
```

---

## Sample Documents

The repository includes sample invoices and receipts in:

```text
samples/
```

These can be used to quickly test the extraction and review flow without having to provide your own documents.

---

## Project Structure

```text
src/
├── app/             # Pages and API routes
├── components/      # Reusable UI components
├── features/        # Feature-specific UI, hooks and types
├── config/          # Client configuration
├── lib/             # Shared client utilities
│
├── server/          # Backend logic
│   ├── services/    # Business logic
│   ├── db/          # Database schema and migrations
│   ├── storage/     # File storage
│   ├── llm/         # LLM routing and extraction
│   ├── ingest/      # Document processing
│   └── confidence/  # Confidence and validation engine
│
└── middleware.ts

tests/               # Automated tests
samples/             # Sample documents
```

The project keeps the frontend and backend in one Next.js application to keep local setup and deployment simple.

---

## Architecture

At a high level:

```text
Invoice / Receipt
       ↓
Document Processing
       ↓
LLM Extraction
       ↓
Validation & Confidence
       ↓
 ┌─────┴─────┐
 │           │
Trusted    Uncertain
 │           │
 ↓           ↓
Ledger    Re-check
             ↓
          Human Review
```

The confidence engine evaluates fields independently rather than assigning one confidence score to the entire document.

This allows the system to say:

```text
Invoice Number  → High confidence
Invoice Date    → High confidence
Total           → High confidence
GSTIN           → Needs review
```

instead of making the user review the entire invoice.

---

## LLM Providers

The application is designed around a provider-independent LLM interface.

You can configure one or more supported providers through environment variables. Multiple providers can be used together for cross-provider verification.

For details on how provider selection, model discovery, extraction, and confidence scoring work, see the full documentation.

---

## Documentation

The full project documentation covers:

- Problem statement and scope
- System architecture
- Invoice extraction pipeline
- Confidence and verification strategy
- Database design
- Natural-language querying
- Important engineering decisions
- Trade-offs and alternatives considered

**[Read the full documentation →](<documentation-url>)**

---

## Live Demo

**[Open the application →](https://zamp-ten.vercel.app/)**



