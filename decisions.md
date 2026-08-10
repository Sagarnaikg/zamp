# Decisions Log

This file is a running log of real decisions made while scoping and building this project, kept as we go — not a changelog written after the fact. Each entry: the decision, the alternatives considered, the reasoning/tradeoffs, and what was deliberately cut.

Status markers: **[LOCKED]** = confirmed, building against it. **[OPEN]** = still being discussed, not final yet.

---

## 1. Problem statement — [LOCKED]

**Decision:** Problem #3 — "Turn messy documents into structured, queryable data."

**Alternatives considered:**

- Problem #1 — "Learn a user's process by watching them, then do it for them." Seriously considered, including a scoped-down version (single-demonstration browser macro learning: record one example of a repetitive task, use an LLM to generalize the pattern rather than replay literal clicks, then run it on new inputs). The generalization step is a genuinely hard, interesting problem.
- Problem #2 — "Build a conversational agent." Viable but needed a sharper task idea to avoid becoming a generic chatbot wrapper.

**Reasoning:** Given roughly one focused build day (not the nominal 5), #1's core hard problem — reliable observation plus robust generalization plus reliable replay — is realistically a multi-day systems problem on its own; attempting it in a day risked a shallow demo instead of depth on one thing. #3 is tractable to build genuinely deep in a day, and it's thematically relevant to a fintech company's actual domain (invoices, receipts, statements).

**What was cut:** Problems #1 and #2 entirely, including the scoped browser-macro version of #1 that was otherwise appealing.

---

## 2. Document domain — [LOCKED]

**Decision:** Scope to invoices, receipts, and expense documents specifically, not fully general/arbitrary document types.

**Alternatives considered:** General mixed documents (contracts, forms, resumes, statements, etc.) with no fixed schema.

**Reasoning:** A fixed-but-realistic schema (vendor, date, total amount, currency, tax, line items, category) gives a concrete, evaluable target, while still allowing genuine real-world messiness (scans, phone photos, inconsistent vendor layouts, multi-page documents). Fully general documents would make the schema-inference problem itself the whole project, at the cost of product specificity.

**What was cut:** General/arbitrary document type support.

---

## 3. Input file types — [LOCKED]

**Decision:** PDFs (digital-native and scanned) and images (JPG/PNG). Excel/CSV deliberately not supported.

**Alternatives considered:** Also accepting Excel/CSV expense exports, since values there are already well-defined.

**Reasoning:** PDFs and images are how invoices/receipts actually arrive (email attachments, phone photos, scans), and they're where the extraction problem genuinely lives. Digital-native PDFs with a real text layer are semi-structured — text goes straight to a cheap text model; scans/photos are fully unstructured and need a vision model. Detecting which case applies gives the model router a second genuine job (file-type-aware routing, not just cost tiers). Excel/CSV was cut precisely *because* it looks like an easy win: a spreadsheet already has well-defined values, so there's no extraction problem to solve — importing it is a column-mapping feature, not "messy documents → structured data." Error-prone inputs are the reason the confidence system exists; supporting the one input type with no errors adds surface, not depth.

**What was cut:** Excel/CSV import; also HEIC and other exotic image formats unless trivially supported by the processing pipeline.

---

## 4. Target user — [LOCKED]

**Decision:** A finance/accounting person whose extracted numbers feed real books — someone who needs to *trust* the data, not just receive it.

**Alternatives considered:** A founder/ops person at a small business who dumps a shoebox of receipts and wants quick spend answers (cares about bulk convenience over per-field correctness).

**Reasoning:** The finance-person framing makes correctness the product, not a feature. It directly motivates the planned hard sub-problem — field-level confidence scoring plus a human correction loop — turning it from a tech flex into the core value proposition: extraction is never 100% reliable, so a trustworthy product must expose uncertainty and make verification fast, rather than silently returning possibly-wrong values. The domain also fits Zamp (fintech) — a wrong extracted total here is a wrong number in the books, which is why depth on trust is worth more than breadth of features.

**What was cut:** Bulk-convenience-first framing; features that only serve the "quick answers, correctness optional" user.

---

## 5. Query experience — [LOCKED]

**Decision:** Natural language query input plus a structured table/list view, not a chat-only interface and not structured-filters-only.

**Alternatives considered:** Chat-only interface (everything through conversation); structured filters/search only (table with filter/sort, no NL layer).

**Reasoning:** NL-only hides the underlying data and makes verification harder; filters-only is safer but less interesting and undersells the LLM-native part of the problem. Combining both lets the structured view act as ground truth the user can check the NL interpretation against.

**What was cut:** Nothing yet — this combines both other options rather than cutting one.

---

## 6. Multi-model routing — [LOCKED]

**Decision:** Route different tasks to different models by cost and complexity, implemented through LangChain's chat-model abstraction (the unified model interface only — not LangGraph, no agent framework). At startup the app reads env vars and detects which provider keys (OpenAI / Anthropic / Gemini) are present. **Only one key is required to run.** With one key, all tasks route to that provider's models, tiered cheap vs. strong per task type. With multiple keys, cross-provider routing kicks in automatically — including the cross-model agreement confidence signal (section 8), which needs two providers to be meaningful and degrades gracefully to the remaining signals with one key.

**Alternatives considered:**
- Requiring all three provider keys and hand-writing three SDK adapters (original idea). Rejected: three response shapes and error-handling paths eat build time that belongs to the core problem, and a reviewer needing three API keys to run the app damages the graded setup experience.
- Single provider/model for everything: simplest, but forfeits both the cost-aware routing story and the cross-model agreement signal.
- LangGraph: wrong tool — it's for stateful multi-step agent graphs; we just need a uniform way to call chat models.

**Reasoning:** The user initially planned multiple mandatory providers, but that adds friction to local setup — so key detection makes multi-provider an *enhancement*, not a requirement. LangChain's abstraction gives one calling convention and one error path across providers for near-zero integration cost. Within whichever provider is available, task-tiered model selection (cheap model for frequent/simple tasks like NL query translation; stronger/vision model for extraction) still demonstrates the cost-aware routing decision even in single-key mode.

**Task-to-model mapping (locked by role; exact model IDs pinned at build time against current pricing/quotas):**

| Task | Tier needed | Multi-key primary |
|---|---|---|
| Extraction from scans/photos | Strong vision model | Gemini flash-tier (most generous quota) |
| Extraction from digital-PDF text | Cheap text model | Gemini flash-tier |
| Second-opinion extraction (agreement signal) | Different provider than primary | OpenAI small multimodal (more quota than Claude) |
| NL query → filter translation | Cheap, fast text model | Gemini flash-tier |

Single-key mode: the table collapses to that one provider — e.g. only a Gemini key present means every task runs on Gemini models, tiered cheap vs. strong within that provider. Claude serves as fallback provider when present.

**Honest caveat:** the cheap-vs-strong cost split is thinner here than in a bigger app — most of these tasks genuinely fit cheap models. The routing earns its place through the independence requirement of the agreement signal and the file-type-aware vision/text split, more than through cost savings.

**Update (same day): the second reading no longer requires a second provider.** Originally the agreement signal switched off entirely in single-key mode, which made the product's headline feature depend on a reviewer having three API keys — bad for the graded setup experience. It now always runs, and independence is obtained from whatever the environment offers, in priority order: a **different provider** when a second key exists (most independent), else the **same provider with a different model tier _and_ a different input modality** — for a digital PDF the primary reads the extracted text layer while the reviewer reads the PDF visually. Two different pipelines over two different representations of the document, which is the point: a plain re-run of the same model on the same input mostly reproduces its own mistakes (errors are correlated), whereas a text-layer read and a vision read fail in different ways. Analogy that drove the change: two reviewers who read the same document differently, not one person reading twice.

*Accepted tradeoff:* same-provider agreement is weaker evidence than cross-provider agreement — shared training data means some blind spots persist. Multi-key setups still get the stronger version automatically, and the signal is one of four, never the sole basis for trusting a field.

*Bug this surfaced (worth recording):* wiring this up exposed that the vision path had **never worked** — `@langchain/google-genai` gates file attachments behind a naive model-name check (`model.startsWith("gemini-2")`, `"gemini-3"`, …) that rejects Google's own `-latest` aliases, throwing "This model does not support files". Every scan/photo upload would have failed; only digital PDFs (text path) worked, which is all our early samples exercised. Fixed by emitting a provider-appropriate attachment block — Gemini's `media` block reaches the identical `inlineData` payload without the check — isolated in one `fileBlock()` helper so the leak in LangChain's "unified interface" stays contained. Added a photo-style receipt sample so the vision path is covered by the demo set from now on.

---

## 7. Stack — [LOCKED]

**Decision:** Full-stack TypeScript on Next.js, deployed on Vercel (Hobby tier), with Neon Postgres as the database and Vercel Blob for original-document storage.

**Alternatives considered:** Separate frontend + backend service (e.g. React frontend with a standalone Node/Express API). Other free-tier hosts weren't seriously evaluated once Vercel's fit was confirmed. For the DB: a vector DB or SQLite were not seriously pursued — the query patterns are plainly relational (documents → fields → line items → corrections, filtered and aggregated), and SQLite doesn't fit serverless deployment.

**Reasoning:** Next.js API routes give a serverless backend without standing up a separate service, and Vercel Hobby is free (no card required), which keeps the whole stack at $0 for a non-commercial take-home. One deployed URL serves both frontend and backend. Neon's free Postgres tier is built for serverless (connection pooling over HTTP), and Postgres fits the relational schema and the aggregation queries the NL layer will translate into. Vercel Blob stores the original PDFs/images so the review screen can show the document next to its extracted fields — which the review-before-accept UX (section 9) depends on.

**Known constraint:** Vercel Hobby serverless functions default to a 10s execution timeout (configurable up to 60s via `maxDuration`) — relevant if a vision-model extraction call runs synchronously during upload.

---

## 8. The "hard sub-problem" (above-and-beyond focus) — [LOCKED]

**Decision:** Field-level extraction confidence derived from independent, checkable signals — not from the model's self-reported confidence — feeding a human correction loop.

**Signals:**
- *Arithmetic consistency:* line items must sum to subtotal; subtotal + tax must equal total. Passing math is strong, verifiable evidence extraction is right; failing math localizes which field is suspect.
- *Format/plausibility validation:* dates parse and aren't in the future, currency codes exist, totals aren't negative.
- *Independent-reading agreement:* read the document twice and compare field-by-field — a second reviewer checking the first one's work. Agreement raises confidence; disagreement flags the field and shows both readings. See the update in §6 for how the second reading is made independent without requiring a second API key.
- *Duplicate detection:* compare each incoming document against history on vendor + invoice number + amount + date (exact match for identical resubmissions, fuzzy match for near-misses) and flag suspected duplicates before they enter the dataset (e.g. "looks like a duplicate of INV-4021 uploaded Tuesday").

Suspect fields are shown with a human-readable reason (e.g. "line items sum to 847 but total reads 874 — possible digit swap"), and fixing one is a click and a keystroke.

**Alternatives considered:** The shallow version — asking the LLM to return a 0–1 confidence per field and coloring cells by it. Rejected because LLM self-reported confidence is notoriously miscalibrated (a model will report 0.95 on a hallucinated total); it's a prompt tweak, not a solved problem.

**Reasoning:** This is the part of "messy documents → trustworthy data" most submissions would quietly skip. It covers both failure sources: bad documents (blurry photo, math genuinely wrong on the invoice) and bad extraction (model misreads a digit) — and the signals hint at which one happened. It's also honestly testable: the arithmetic checker and validators can be unit-tested against real nasty cases, which is what "meaningful tests" looks like for this product.

**Research backing (web pass, 2026-08-09):** Field-level confidence + human review is established practice in enterprise AP tools (Rossum, Veryfi, Nanonets, Stampli), but their scores are opaque numbers with no explanation — and unreliable in practice (one 2025 report: only 8.8% of enterprises actually hit 90% OCR accuracy in AP automation, despite 95–99% marketing claims). Our differentiator is *explainable* confidence from checkable signals. Duplicate invoices are a documented real-money problem (~2.5% of invoices submitted to UK businesses are duplicates, causing duplicate payments) — and duplicate detection is nearly free for us since we already extract the exact fields it needs. Relevant to Zamp specifically: their platform moves money globally (payments/treasury/banking), and catching suspect extractions and duplicates *before payment* is directly adjacent to their AP flow.

**What was cut:** Model self-reported confidence as a primary signal; voice input for queries (considered when "verbally ask questions" came up, but clarified to mean typed plain-English queries — voice would add a speech dependency without adding depth); vendor name normalization ("Acme Svc" vs "Acme Services LLC" treated as one vendor) — a real problem that silently breaks vendor-level queries, but kept as a stretch goal (simple fuzzy grouping) rather than core scope for a one-day build.

---

## 9. Post-upload UX: review-before-accept — [LOCKED]

**Decision:** After extraction, the user reviews each document before it enters the dataset: extracted fields shown side-by-side with the original document image, confident fields quietly green, suspect fields flagged with their plain-English reason. Fix or confirm → the document is accepted into the table.

**Alternatives considered:** Documents land in the table immediately, with flagged fields marked for later review (lower friction per document, but suspect data sits in the queryable dataset — and in query results — before anyone has looked at it).

**Reasoning:** For a finance user, unverified numbers in the books are worse than a review step. Review-before-accept makes the correction loop a first-class moment in the journey rather than a buried feature, and guarantees the queryable table only ever contains human-accepted data — which is what lets the user trust query answers. The per-document friction is accepted deliberately: for this user, that friction *is* the value.

**What was cut:** Auto-accept for fully-confident documents (could be added later as a setting; cut to keep one consistent flow and because "the system decided it was fine" undermines the trust story on day one).

---

## 10. Auth — [LOCKED]

**Decision:** No login accounts, but data *is* separated: anonymous per-browser workspaces. First visit sets a random workspace ID in a cookie; every table carries a `workspace_id` column and every query filters by it. Each visitor silently gets a private dataset with zero visible auth.

**Alternatives considered:**
- Fully shared single dataset (simplest; original lean). Rejected once weighed: reviewers seeing each other's uploads is untidy, and the fix costs only ~an hour.
- Real auth (Clerk/NextAuth + Google sign-in): rejected. Realistically 3–4 hours of a one-day build for provider setup, login UI, route protection, a users table, and redirect edge cases — plus an extra env key complicating the reviewer's local setup, and a login wall in front of the graded first-run experience. All spent on something that demonstrates nothing about extraction trust.

**Reasoning:** The cookie workspace keeps the zero-click first-run intact while fixing data separation. The demo samples seed per-workspace, so every reviewer gets the full guided empty-state experience. The `workspace_id` column is also exactly where real auth would attach later (swap cookie ID for user ID) — the cut is deliberate architecture, not avoidance.

**What was cut:** Login accounts, user profiles, cross-device persistence (clearing cookies orphans a workspace — acceptable for a take-home).

---

## 11. Database choice + schema direction — [LOCKED choice, DRAFT schema]

**Decision (locked):** Postgres only — no vector DB.

**Alternatives considered:** Adding a vector DB for the NL query layer.

**Reasoning:** Our queries are filter + aggregate over structured fields ("spend on software in July" = category match + date range + SUM) — exactly what SQL does and what vector similarity search can't (vector DBs don't sum, group, or range-filter numerics well). Post-extraction, the data isn't messy text anymore; it's typed rows. Fuzzy text matching (vendor typos) is covered by Postgres `ILIKE`/trigram; if semantic search over line items were ever needed, `pgvector` lives inside Postgres — no second datastore either way.

**Schema (draft — expected to evolve during build; changes will be logged here with reasons):**
- `documents` — one row per upload: blob URL, filename, file kind (digital PDF / scanned PDF / image), status (`processing` → `needs_review` → `accepted`, or `failed`), timestamps.
- `extractions` — one row per document: real typed columns for vendor, invoice number, date, currency, subtotal, tax, total, category (so SQL filtering/aggregation works naturally), plus one JSONB column for per-field confidence metadata (score + human-readable reasons — displayed, never filtered on).
- `line_items` — description, quantity, unit price, amount, position. Own table because line-item math is a core confidence signal and item-level queries are expected.
- `audit_logs` — field name, original value, corrected value, timestamp. Audit trail: human fixes are recorded, never silently overwritten.

**Deliberately absent:** users table (anonymous cookie workspaces instead — section 10; all tables carry `workspace_id`), vendors table (normalization is a stretch goal; vendor stays a string), vector/embedding storage.

---

## 12. App structure: three views, two use cases — [LOCKED]

**Decision:** The product is exactly two use cases — (1) upload documents and review/correct the extraction before it enters the ledger, (2) ask plain-English questions over the accepted data — delivered as three views:

1. **Inbox/upload** — drop zone + document list with status (`processing` / `needs review` / `accepted` / `failed`). Designed empty state for first visit.
2. **Review** — original document side-by-side with extracted fields; clean fields quietly checked, flagged fields show their plain-English reason and a one-click fix where the signals point at a specific answer (e.g. "Use $847.00" when line-item math contradicts the read total). Accept → ledger; every edit → audit_logs trail.
3. **Ledger + query** — table of accepted documents (sortable, filterable, rows link to originals) with the NL query box above; answers come back as number + matching rows + an interpretation chip ("category = software, July 2026, sum of total") so the user can verify what the query did.

**Demo provision:** a bundled set of sample documents with planted problems — a clean digital invoice (all green), a blurry phone-photo receipt, an invoice whose printed math is genuinely wrong (triggers the arithmetic flag), and a near-duplicate pair (triggers the duplicate warning). A "Try sample documents" button on the empty state runs them through the real pipeline, so a reviewer with no invoices at hand sees the full story — including the failure modes, which are the product's point — in under a minute. README maps each sample to the signal it demonstrates.

**What was cut:** Any fourth view (dashboards, charts, settings); features not serving the two use cases.

---

## 13. Build order — [LOCKED]

**Decision:** Sequenced so the riskiest and most-graded parts land first, with continuous deployment from hour one:

1. Scaffold + deploy immediately (empty Next.js app live on Vercel, Neon + Blob wired) — no end-of-day deployment surprises.
2. Ingestion pipeline (upload → Blob → file-kind detection → router → extraction → DB rows) — riskiest integration, goes early.
3. Confidence engine (four signals + reason generation) — the graded centerpiece; unit tests written alongside, not after.
4. Review UI.
5. Ledger table + NL query.
6. Polish pass: empty/error/loading states, README, final decisions.md sweep.

**Cut line if time runs short:** NL query degrades first (table with manual filters still demonstrates queryability). The confidence system is never cut — it is the submission's argument.

---

## 14. Local-first setup: no Vercel dependency for reviewers — [LOCKED]

**Decision:** The project must run fully locally with a two-line `.env`: `DATABASE_URL` plus any one LLM provider key. File storage sits behind a small driver interface — `BLOB_READ_WRITE_TOKEN` present → Vercel Blob (the deployed instance); absent → local `uploads/` folder on disk. The repo ships a `docker-compose.yml` for one-command local Postgres, with any external Postgres connection string (e.g. free Neon) as an alternative for reviewers without Docker.

**Alternatives considered:** Using Vercel Blob and Neon-via-Vercel as hard dependencies everywhere (simplest for us — one storage path), which would force a reviewer to create a Vercel account and link a project just to run the app locally.

**Reasoning:** Setup experience is explicitly graded. The deployed URL is where reviewers *test* the product; the repo is where they *verify* it runs — and that second path must not require accounts beyond one LLM key. Same environment-adaptive pattern as the model routing (section 6): the app detects what's configured and degrades gracefully.

**Deploy-anywhere corollary:** Vercel is *our* deploy target, not a dependency. Core code uses no Vercel-specific APIs — standard Next.js (runs on any Node host: Netlify, Railway, Render, a VPS via `npm run build && npm start`), plain-`DATABASE_URL` Postgres, and storage always through the driver interface (the disk driver suits any host with a persistent disk; Vercel Blob is one optional driver). Vercel-specific bits are confined to config (`maxDuration`) and the Blob driver.

**What was cut:** Nothing functional — the deployed instance still uses Blob + Neon; the local path is an additional ~30-line storage driver, accepted as worthwhile architecture anyway.

---

## 15. ORM: Drizzle over Prisma — [LOCKED]

**Decision:** Drizzle ORM with drizzle-kit migrations, on plain `pg` (node-postgres).

**Alternatives considered:** Prisma (most popular, but heavier: its own schema DSL, a codegen step in setup, and a query engine binary); Kysely (query builder only, no migration story out of the box); raw SQL (no type safety at the query sites).

**Reasoning:** Drizzle keeps the schema in TypeScript (one language everywhere), generates plain SQL migration files a reviewer can read in the repo, adds no codegen step to `npm install`, and its query API is close enough to SQL that nothing is hidden. On a graded setup experience, fewer moving parts wins.

**What was cut:** Nothing functional — all options cover CRUD equally at this scale.

---

## 16. Project architecture: layered structure with a services layer — [LOCKED]

**Decision:** Explicit layering under `src/`: `app/` (routing — thin pages and API endpoints), `components/` (frontend), and `server/` (backend, never imported by client code) subdivided into `services/` (business logic), `db/`, `storage/`, `llm/`, `ingest/`, and `confidence/`. API routes are HTTP adapters only: parse/validate the request, call a service, shape the response. The full ingestion flow lives in `server/services/documents.ts`, not in the route.

**Alternatives considered:** Flat `lib/` grab-bag (the initial state — works at small scale but mixes ML, storage, and domain logic in one bucket); full hexagonal/clean architecture with repository interfaces and dependency injection (rejected: ceremony without payoff at this size — Drizzle's query API already is the data-access abstraction, and a repositories-wrapping-ORM layer would be indirection for its own sake).

**Reasoning:** A reviewer should find any concern in one guess, and the seams should be where the system would actually grow: a new document type touches `ingest/` + `llm/`, a new confidence signal is one module in `confidence/`, a new storage backend is one driver file, background-queue ingestion later means calling the same service from a worker instead of the route. Services keep business logic testable without HTTP.

**What was cut:** Repository/DI layers; a separate backend package or monorepo split (one Next.js app is the deploy target — decisions.md §7).

---

## 17. Extraction completeness: fixed schema + extra-fields capture net — [LOCKED]

**Decision:** Two-tier extraction. The fixed schema (vendor, date, amounts, category, line items) stays as real typed columns — the queryable spine. Alongside it, the LLM now returns `extra_fields`: every *other* clearly labeled field on the document (PO number, due date, payment terms, tax IDs, billing address...), stored as JSONB on the extraction. Extra fields are displayed in review and the ledger but are not filterable/summable.

**Alternatives considered:**
- Fixed schema only (initial state). Rejected after discussion: anything outside the schema was silently dropped at ingestion — the worst kind of data loss, because the user can't know what they lost.
- Fully dynamic schema (everything in JSON, no fixed columns). Rejected: the ledger's filter/sum/group queries and the arithmetic confidence checks depend on typed columns; JSON-path queries would make every aggregation slower and fragile, which is the same reasoning that picked Postgres over a document store (§11).

**Reasoning:** The fixed schema answers "what can I query?"; the capture net answers "did I lose anything?" — the two concerns pull in different directions, and one mechanism can't serve both well. This split gives a hard guarantee for each: nothing legible is dropped, and everything queryable is typed.

**What was cut:** Nothing further — the two gaps initially noted (inconsistent keys across vendors, no querying over extras) were closed the same day; see the update below.

**Update (same day): key normalization + JSONB querying.** Two additions after review:
- *Field-key normalization:* vendors label the same concept differently ("PO No" / "Purchase Order Number" / "P.O. #"). Extra fields now carry a canonical `key` (po_number) alongside the printed `label`. Two layers: the LLM proposes a snake_case key (models are good at semantics), then a deterministic alias table in `ingest/normalize.ts` settles spelling variants (code is good at consistency). Genuinely distinct concepts (GSTIN vs VAT number vs generic tax ID) are deliberately never merged. Unit-tested (7 cases).
- *Querying extras:* the query DSL gained field `extra` (with `key`) and op `exists`. The translator prompt is grounded with the distinct keys actually present in the workspace's ledger, so the model can't invent keys. The query builder maps extra filters onto parameterized JSONB conditions (`jsonb_array_elements` + `EXISTS`); fixed-column queries never touch JSONB, so the fast path stays fast — the JSONB cost is paid only by questions that actually reference an extra field. `gte`/`lte` over extras is deliberately unsupported (string comparison over free text would give silently wrong answers); unsupported filters are reported back as `ignoredFilters`, and the interpretation string is built only from filters that actually ran.

---

## 18. Provider failures: classify, retry, and make failure recoverable — [LOCKED]

**Decision:** Three layers between a provider error and the user:
1. **Classification** (`llm/errors.ts`) — map raw provider errors to a `kind`, a plain-English message, and a `retryable` flag. A rate limit reads "The AI provider is rate-limiting requests right now. Wait a moment and retry this document," not `[429] Resource exhausted: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count`.
2. **Automatic retry** — transient failures (429, 5xx, timeouts) retry up to 3 times with exponential backoff plus jitter. Non-retryable failures (bad key, model unavailable) throw on the first attempt rather than burning 3 attempts on a certainty.
3. **Manual retry endpoint** — `POST /api/documents/:id/retry` re-runs extraction on the *stored* file. A failed document costs one click, not a re-upload.

**Alternatives considered:** Surface raw provider errors (what we had — fast to build, awful to receive); fail the upload entirely on a provider error, requiring re-upload (loses the file the user already gave us for no reason, since it's already in storage); a background job queue with automatic re-processing (correct at scale, but a queue plus worker plus polling UI is a day of work for a one-day build — the retry endpoint gets most of the value for an hour).

**Reasoning:** Rate limits are not an edge case on free-tier provider keys — they are the *expected* failure for anyone running this from a clone, which makes them a setup-experience problem, not just an error-handling one. The distinction that matters to a user is "wait and retry" vs "fix your config," so that's exactly what the classifier encodes. Splitting the ingestion pipeline into `processDocument()` (shared by upload and retry) also made the retry path near-free: extraction upserts rather than inserts, and line items are replaced, so re-running is idempotent.

**What was cut:** Background queue processing; automatic retry of *failed documents* on a timer (the user decides when, since each retry spends quota); partial-result persistence when extraction half-succeeds.

**Bug surfaced while testing:** the OpenAI project key in use had access to exactly one model (`gpt-5.4-mini`), not the `gpt-4o-mini` that was pinned in the router — a 403 that, before this work, would have surfaced as a raw provider string. It now reads as an actionable config message, and it's the reason model IDs are treated as environment-specific config to verify rather than constants to assume.

---

## 19. Runtime capability discovery + provider-agnostic keys — [LOCKED]

**Decision:** Stop hardcoding model IDs. At startup the app reads a key per provider (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`), asks each configured provider's `/models` endpoint what that account can actually reach, and ranks the results into a cheap and a strong tier. `GET /api/status` exposes the outcome — providers found, models resolved, or a plain-English problem — so the UI can gate on readiness instead of letting a first upload fail mysteriously.

**Alternatives considered:**
- *Hardcoded model IDs* (what we had). Two production failures in one session proved it wrong: `gemini-2.5-flash` was retired for new keys (404) and the OpenAI project in use could reach exactly one model, `gpt-5.4-mini`, not the pinned `gpt-4o-mini` (403). Both required a source edit to fix, which breaks the "just add your key" promise.
- *Env-overridable model IDs* (`OPENAI_MODEL=...`). Cheaper to build and keeps the failure fixable without code, but it makes the reviewer diagnose a provider error and go look up a valid ID — the app already has an API that can answer that question.
- *A single generic `LLM_API_KEY` with the provider inferred from the key's shape.* Built first, then removed — see the update below.

**Reasoning:** Model availability is a property of the *account*, not of the software, and IDs are retired without notice. Anything hardcoded is a time bomb pointed at the graded setup experience. Asking the provider costs one HTTP request per key, once per process, and turns a class of hard failures into either a working default or a message that says exactly what's wrong.

**Update — generic keys removed, discovery kept.** The first version accepted a provider-agnostic `LLM_API_KEY`/`LLM_API_KEYS` and inferred each key's provider from its prefix (`sk-ant-` → Anthropic, `AIza` → Google, …), falling back to probing every provider when the shape was unfamiliar. That machinery only earns its keep if the set of providers is open-ended. It isn't — LangChain integration exists for exactly three, and adding a fourth is a code change regardless. So the inference, the multi-syntax parsing (comma lists, JSON arrays, arrays of objects), and the probe-every-provider fallback were all deleted in favour of one variable per provider. A key is now bound to its provider by the variable it sits in, with nothing to guess and no ambiguity to explain. Runtime model discovery — the part that actually solved a real failure — is untouched.

**Tradeoffs accepted:** one extra request per key at first use (cached process-wide); tier *ranking* is still heuristic (regex preference lists per provider) — the model set is discovered, the choice among them is our judgment; and a provider outage at startup looks the same as a bad key, which the status message acknowledges rather than guesses about.

**What was cut:** Per-task model overrides; persisting discovery across restarts; automatic re-probing on a timer (`POST /api/status` re-probes on demand, which covers "I just fixed my key").

---

## 20. Escalation ladder: re-read disputed fields before escalating to a human — [LOCKED]

**Decision:** A human is the *last* resort, not the second. The pipeline now escalates in stages:

1. **Two independent readings** of the document (different provider when configured, else different model tier + input modality).
2. **Field-by-field comparison.** Agreement is evidence; disagreement marks the field disputed.
3. **Deterministic validation** — arithmetic consistency, format/plausibility, duplicate detection. These are cheap, explainable, and catch things no amount of model agreement would (two readings can agree on a total that doesn't match the line items).
4. **Targeted re-extraction** — only for the disputed fields, with a narrower schema and a prompt focused on careful character reading. Majority voting then settles it: 2-of-3 resolves the field, and if the third reading backs the *second*, the stored value is corrected.
5. **Human review** — only for fields still unresolved, with every candidate value shown.

**The third reading is deliberately blind.** It is never shown the two values it's adjudicating. Showing them would invite the model to rubber-stamp whichever looks more plausible; an independent third opinion is the only one whose agreement means anything.

**Alternatives considered:**
- *Escalate every disagreement straight to a human.* Simple, and what we had — but it spends the scarcest resource (attention) on cases a second look resolves for a fraction of a cent. Most disagreements in testing were one model misreading a digit, not genuine ambiguity.
- *Adjudication prompt* ("reading A says 836, reading B says 863 — which is right?"). Cheaper to write and fewer tokens, rejected for the anchoring problem above.
- *Re-run the full extraction a third time.* Wasteful, and dilutes attention across fields that were never in doubt. The focused schema keeps the third call small and pointed.

**Reasoning:** This is the "don't wake a human for something you can check yourself" principle, and it's what makes the review queue trustworthy — a flagged field now means *we genuinely could not resolve this*, not *our first two guesses differed*. It also produces a real self-correction path: when the primary reading loses the vote, the stored value changes, and the user is told it changed rather than having it happen silently.

**Verified on a deliberately degraded scan** (faded thermal print, scan noise, ambiguous digits) with two providers live: both agreed on invoice number, subtotal, tax and total — auto-accepted; disagreed on the date (`09/03/2026` read as 9 March by one, 3 September by the other — the DD/MM trap) and on currency; the focused re-read ran on exactly those two fields; the date went to a human with all three candidate values shown, and currency escalated because the third reading confirmed it genuinely isn't printed on the document. That is the ladder behaving correctly at every rung.

**Bug this surfaced (and the reason step 3 now runs after step 4):** validation originally ran against the *primary* reading, so a value installed by majority voting was never re-checked. On the test document the vote corrected the date to one that was in the future — and it scored 0.98 instead of being flagged, because the arithmetic and format signals had judged a value we then discarded. Validation now runs on the resolved extraction, and a field that was corrected *and* still fails validation shows both reasons.

**What was cut:** Region-level re-extraction (crop to the field's bounding box and re-read only those pixels — better still, but needs layout coordinates the current extraction doesn't return); more than three readings; a confidence-weighted vote instead of a simple majority.

---

## 21. LLM cost: measure it, then spend it only where it buys something — [LOCKED]

**Decision:** Four changes, in the order they matter:

1. **Measure first.** Every model call reports its token usage, accumulated per document and stored on the extraction row. Optimizing an unmeasured cost is guesswork, and this is the product's only real operating expense.
2. **Adaptive second reading.** The second reading no longer runs unconditionally. Deterministic checks run first, and their result decides: a **digital PDF** whose arithmetic reconciles and whose validations pass skips it; **scans and photos always get it**. Rationale: a PDF's text layer is exact characters, so the OCR-misread failure mode a second reading guards against barely exists — whereas for pixels it's the dominant one. Where the document's own math already corroborates the numbers, that's stronger evidence than another model's opinion.
3. **Reduced schema for the second reading.** It exists only to be compared field-by-field, and only eight scalar fields are compared — so it no longer re-extracts line items and extra fields we parse and discard. Output tokens scale with line count, so this saves most on the biggest invoices.
4. **Text clamping.** A pathological multi-page PDF keeps its head and tail (vendor/number/date at the top, totals at the bottom) rather than paying for the middle.

**Measured on real documents:**

| Document | Model calls | Input tokens | Output tokens |
|---|---|---|---|
| Clean digital invoice (PDF) | **1** (was 2) | 454 | 443 |
| Phone-photo receipt (image) | 2 | 2,680 | 432 |

Roughly half the cost on the clean-PDF path, and — the part that matters — **no new review work**: the skipped document came back with nothing flagged, money fields still corroborated at 0.9 by arithmetic.

**Alternatives considered:**
- *Always run both readings* (previous behaviour). Simplest and marginally safer, but pays double on the documents least likely to be wrong.
- *Skip based on the model's self-reported confidence.* Rejected for the same reason the whole confidence engine exists — that number is not evidence.
- *Always skip the second reading and lean on validation alone.* Would break the product: arithmetic can't check a vendor name or a date, and photos genuinely need two eyes.
- *Downscale images before vision calls.* Real savings (tokens scale with image tiles), but it needs a native image dependency in the production bundle, and a resize failure on a deploy target would break ingestion for a cost win. Deliberately deferred — noted rather than built.

**Tradeoff accepted, stated plainly:** on a clean digital PDF, the text fields (vendor, invoice number, category) now sit at "unverified" rather than "verified", because nothing independently corroborates them. They are *not* flagged and create no review work — but the badge is honest about the weaker evidence, which is the point. If a user wants maximum verification regardless of cost, the policy is one pure function (`confidence/policy.ts`) with its own tests.

**What was cut:** Image downscaling (above); caching identical re-uploads by content hash before extraction (duplicate detection already catches them *after* extraction — the saving is real but the code path needs care around retries); per-provider price tables to report cost in currency rather than tokens.

---

## 22. Region cropping for re-reads — [TRIED, MEASURED, REVERTED]

**The idea (a good one):** when re-reading a disputed field, send only the part of the document it lives in — the totals block, say — instead of the whole page. Fewer image tiles to pay for, and a model looking at a small focused crop should read it more carefully than one scanning a noisy full page. Pair it with a cheaper model, on the theory that focused input compensates for a weaker reader.

**Built it, then measured it. It doesn't work.** Same receipt rendered at three sizes, re-reading the same three fields, cropped versus full page:

| Image size | Full page | Cropped | Saving | Values agreed |
|---|---|---|---|---|
| 560 × 760 | 1,305 | 1,369 | **−5%** | yes |
| 1,200 × 1,630 | 1,333 | 1,369 | **−3%** | yes |
| 2,400 × 3,260 | 1,333 | 1,369 | **−3%** | yes |

Cropping made it *worse* at every size, and produced identical values every time — no accuracy gain either.

**Why — and this is the finding worth keeping:** input tokens barely move between a 560px image and a 2,400px one (1,305 → 1,333). The providers normalize images to a fixed token budget server-side before charging, so **image dimensions are essentially not a cost lever on this stack.** Our crop only added the extra "this is a cropped section" instruction, hence the small loss.

**Reverted:** the crop module, its tests, the native `@napi-rs/canvas` runtime dependency (back to dev-only, where it generates samples), the Turbopack `serverExternalPackages` workaround that native binary required, and the cheap-tier routing for re-reads — that last one only made sense if cropping compensated for the weaker model, and it doesn't. The deciding vote on a disputed field goes back to the strong tier, where it belongs.

**This also retires a deferred idea:** §21 left image downscaling as the biggest unclaimed saving, on the assumption that tokens scale with resolution. They don't. That work would have been wasted, and is now cut on evidence rather than caution.

**What this leaves:** the optimizations that *did* measure well stay — adaptive second reading, reduced comparison schema, text clamping (§21). Cost on this stack is driven by **number of calls**, not by how big the inputs are, which is a much simpler thing to optimize and exactly what §21 targets.

---

## 23. Pipeline trace: make the architecture visible — [LOCKED]

**Decision:** Ingestion records what it actually did and returns it as a **graph**: `{ nodes, edges, totals }`. Each node carries a status (`ok` / `skipped` / `failed` / `pending`), a plain-English detail line, a duration, its phase and branch for layout, and — where a model was called — the provider, model ID, and token cost. Edges come from each node's declared dependencies.

The graph is split into a **static shape** (`PIPELINE_GRAPH` — labels, phases, edges, known before anything runs) and **runtime results** (what's stored per document). They're merged on read, so a node that never ran still appears as `pending` and a label change doesn't require rewriting stored history.

The pipeline is a genuine DAG rather than a list, because verification and duplicate checking are independent — the duplicate check compares against workspace history and never looks at the readings — so they fan out after the first reading and merge again at scoring:

```
store → detect → extract ─┬→ validate → second_reading → compare → tiebreak ─┬→ score
                          └→ duplicates ──────────────────────────────────────┘
```

**Reasoning:** Every interesting decision this system makes is currently invisible. A user watching "Processing…" has no idea that two different providers read their document, that the second reading was skipped because the arithmetic already reconciled, or that a third focused re-read overruled the first one. Those decisions *are* the product — the whole thesis is that trustworthy extraction means showing your work, and until now we showed it per-field but not per-pipeline. Recording it also gives real observability: a failed document now carries the stages that succeeded before the failure, so it's diagnosable after the fact instead of just "failed".

A **skipped** stage is deliberately kept in the trace with its reason, not omitted. "We chose not to spend a model call here, because…" is more informative than silence, and it's the honest way to present the cost optimization from §21.

**Alternatives considered:** Server-sent events streaming stage updates live (better UX — a graph that fills in as it runs — but needs a streaming route and client reconnect handling; the stored trace is the prerequisite either way, so this is a clean later upgrade); structured logs only (invisible to users, and the point is to show them); a generic OpenTelemetry span tree (right answer at scale, far too much apparatus for nine stages, and its output isn't user-presentable).

**Two real traces, unmodified:**

```
Clean digital invoice                    Faded scan, two providers
  ok      Store original                   ok      Store original
  ok      Detect document type             ok      Detect document type
  ok      First reading   891 tok          ok      First reading    3065 tok  [google/gemini-flash-latest]
  ok      Validate                         ok      Validate
  skipped Second reading  ← saved a call   ok      Second reading   1160 tok  [openai/gpt-5.4-mini]
  skipped Compare readings                 ok      Compare readings  → disagree on: doc_date
  skipped Focused re-read                  ok      Focused re-read   826 tok  → corrected doc_date
  ok      Duplicate check                  ok      Duplicate check
  ok      Score confidence                 ok      Score confidence  → 1 field flagged
  1 model call                             3 model calls, 5051 tokens
```

**Served from its own endpoint** (`GET /api/documents/:id/pipeline`) rather than bundled into the document detail. It answers a different question — "what did the system do?" rather than "what does the document say?" — and only the pipeline view asks it. Measured: the trace was 2,351 bytes against 2,483 for the entire rest of the detail response, and the raw column was also riding along on *every row* of the document list. Both now exclude it at the query level, not just in serialization.

**What was cut:** Live streaming of stages (above); per-stage retry counts; storing the trace for the *query* path (the pipeline story is about ingestion, and a query is one call).

---

## 24. Sensitive-data redaction: card numbers and IBANs — [LOCKED]

**Decision:** Detect and mask credit/debit card numbers and IBANs at two points: **before** a digital PDF's text layer is sent to an LLM (so the number never leaves our server), and **after** extraction, on every extra-field value (a universal safety net that also covers the vision path, where pixels can't be pre-redacted before the model reads them).

**Scoped deliberately narrow, on purpose:** only two patterns, both with a real checksum to validate against — card numbers (Luhn) and IBANs (ISO 7064 mod-97-10). A generic "bank account number" pattern was considered and rejected: without a checksum, it would misfire on invoice numbers and PO numbers, which is a worse bug than the one this exists to fix. `INV-7734` is 3 digits short of a card number and has no checksum to pass; a plausible 16-digit reference number that isn't Luhn-valid is left alone.

**Alternatives considered:**
- *Mask everything that looks like a long digit string.* Rejected for the false-positive reason above — it would corrupt the exact fields (invoice/PO numbers) the product exists to extract correctly.
- *Only pre-send redaction.* Rejected: it can't reach the vision path at all, since there's no text to scan before the model reads the pixels — leaving scans and photos with zero protection would be the more common case for this product, not the exception.
- *Only post-extraction redaction.* Would still send the raw number to the LLM provider on the text path, which the pre-send layer specifically avoids — defense in depth, not redundancy.

**What was cut:** Threading a redaction count through the pipeline trace for visibility (would touch three extraction return signatures for a nice-to-have; the redaction itself is the ask, not its dashboard visibility — a clean later addition); generic bank-account-number detection (above); SSN/government-ID patterns (out of scope for invoices).

**Verified live**, not just in tests: uploaded a generated invoice whose payment line reads a real (published test) Visa number. Stored `extra_fields` value: `"card •••• •••• •••• 1111"` — the full number never reached the database, and because redaction runs before the prompt is built, the LLM never saw it either. Core fields extracted unaffected: `INV-7734`, `$132.00`. 13 new unit tests, including the false-positive guards (invoice numbers, non-Luhn digit strings of the same length) that matter more than the positive-match cases.

---

## 25. Concurrency: architecture doesn't block, production scale isn't tuned — [NOTED, NOT SOLVED]

**Assessment:** every service is `async`/`await` over I/O (DB, LLM calls) with no CPU-heavy synchronous work and no shared mutable per-user state — workspace scoping comes fresh from each request's cookie, and the one intentionally shared piece of state (`getCapabilities()`'s cached discovery promise) is safe because it's deployment-wide config, not per-user, and caching the `Promise` itself avoids a race on concurrent first calls. So one user's slow LLM call does not block another user's request.

**Three concrete gaps, deliberately left for real scale, not this build:**
1. **DB pool has no explicit size** — `new Pool({ connectionString })` in `db/index.ts` uses node-postgres's default (10). Fine here; would need tuning (and likely PgBouncer) under real concurrent load.
2. **LLM provider rate limits are shared across every user of a deployment** — concurrent uploads draw on the same API key's quota. Not our limit to raise; the retry-with-backoff work (§18) is what keeps this from surfacing as raw errors.
3. **No request queueing or per-workspace throttling** — a single workspace can currently fire unlimited concurrent uploads and consume a disproportionate share of quota. At real scale this wants a job queue (bounded concurrency) and per-workspace rate limits.

**Why not solved now:** each is a real, separate piece of infrastructure work (pool tuning + PgBouncer, a queue, a rate limiter), not a design flaw to patch — and none was in scope for a one-day build behind one deployment.

---

## 26. Deliberately not yet decided

Exact file structure — will emerge during scaffolding and be logged if any non-obvious call is made.
