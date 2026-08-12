---
title: Scope & Trade-offs
---

[← Back to overview](index.md)

# Scope & trade-offs

Every cut on this page was a decision, not something left unfinished. The
test applied throughout: does building this demonstrate anything about
*trustworthy document extraction* — the actual problem this project is
about — or does it just add surface area? If the answer was "just surface
area," it was cut, and the extension path was designed in from the start so
it's a real "later," not a dead end.

## No login accounts

**What's there instead:** anonymous, per-browser workspaces. First visit sets
a random id in an `httpOnly` cookie via middleware; every table carries a
`workspace_id` column, and every query filters by it.

```ts
// src/middleware.ts
export function middleware(request: NextRequest) {
  if (request.cookies.has(WORKSPACE_COOKIE)) return NextResponse.next();
  const id = crypto.randomUUID();
  // ...set the cookie, forward it to this same request too
}
```

**Why not real accounts (Clerk/NextAuth + Google sign-in):** realistically
3–4 hours of a one-day build for provider setup, login UI, route protection,
a users table, and redirect edge cases — plus an extra required env key that
complicates a reviewer's local setup, and a login wall in front of the
graded first-run experience. All of that time spent demonstrates nothing
about extraction trust, which is what the day was actually for.

**Why not a single fully-shared dataset either** (the simplest possible
option): reviewers seeing each other's uploaded documents is untidy, and
workspace-scoping cost about an hour to add properly — cheap enough that
there was no real excuse not to fix it.

**Where this actually goes next:** the `workspace_id` column already sitting
on every table is exactly where real auth attaches — swap the cookie-derived
id for a real authenticated user id, and nothing else in the schema or query
layer changes. This is deliberate architecture for that transition, not
avoidance of building it. A demo instance also seeds sample documents
per-workspace, so every fresh visitor gets the full guided empty-state
experience with something to try immediately.

**Accepted trade-off:** clearing cookies orphans a workspace, and there's no
cross-device persistence. Acceptable for what this is; the first thing that
would need to change if this became a real product is exactly the auth swap
above.

## Feature flags are static, not a service

```ts
// src/config/features.ts
export interface FeatureFlags {
  naturalLanguageQuery: boolean;
}
export const features: FeatureFlags = {
  naturalLanguageQuery: true,
};
```

Flags here are a plain TypeScript object, resolved at build time, read
through one accessor. A remote flag service (LaunchDarkly, GrowthBook, a
custom admin panel) is real infrastructure this product doesn't have and
didn't need for the one flag that currently exists.

**Why this shape and not something more elaborate:** reading flags through a
single typed accessor now means that swapping the *source* later — build-time
constant today, a remote service tomorrow — is a one-file change, not a
refactor scattered across every place a flag gets checked. The extension
point was designed in even though the remote infrastructure behind it wasn't
built, because building infrastructure for a feature-flag *service* before
there's more than one flag to manage would be solving a problem that doesn't
exist yet.

## No real-time pipeline streaming

The pipeline trace (see [Extraction pipeline](03-extraction-pipeline.md#making-the-pipeline-visible))
is stored and returned as a complete result once ingestion finishes, not
streamed stage-by-stage as it runs. A live-filling graph — nodes lighting up
in real time as each stage completes — would be a genuinely better
experience, and was considered directly.

**Why not now:** it needs a streaming route (Server-Sent Events) and client
reconnect handling, and the stored trace this ships with is the prerequisite
either way — the data model doesn't change, only how it's delivered. That
makes it a clean, self-contained upgrade to make later rather than something
that had to be designed in from day one.

## No background job queue

Extraction runs synchronously within the upload request. A background queue
with bounded concurrency and a polling or websocket-driven UI would be the
right answer at real production scale, and was explicitly not attempted.

**Why not:** a queue, a worker process, and a polling UI is realistically a
full day of work on its own — for a one-day build, that's the entire budget
spent on infrastructure with nothing left for the confidence engine, which
is the actual point of the submission. The architecture doesn't fight this
decision either way: ingestion logic already lives in a service function
(`server/services/documents.ts`), not inside the API route handler, so
calling it from a queue worker instead of directly from the route later is a
small change, not a rewrite. See [Architecture](02-architecture.md) for why
the codebase is laid out this way in general.

**What's honestly not solved as a result** (documented rather than glossed
over): the database connection pool has no explicit size tuning for
concurrent load, LLM provider rate limits are shared across every user of a
single deployment, and there's no per-workspace throttling to stop one
workspace from consuming a disproportionate share of quota. Each is real,
separate infrastructure work — not a design flaw in what exists, just scope
that was never in a one-day build to begin with.

## No auto-accept for confident documents

Even a document where every field scores "strongly verified" still goes
through the review screen — it isn't automatically dropped into the ledger.

**Why:** for the target user (someone whose numbers feed real books), "the
system decided this was fine" undermines the trust story on day one, before
any track record has been established to earn that shortcut. Auto-accept for
fully-confident documents is a reasonable setting to add *later*, once the
confidence signals have a track record — but shipping it as the default from
day one would be optimizing for convenience over the actual thing being
proven.

## No vendor name normalization

`"Acme Svc"` and `"Acme Services LLC"` are currently treated as two different
vendors, which can quietly split a vendor-level query in two. This is a real,
known problem, not a hidden one.

**Why it's a stretch goal and not core scope:** getting normalization right
without false-merging genuinely different companies is its own small
project (fuzzy grouping, confirmation UI for ambiguous merges, an alias
table) — meaningful scope on its own, and secondary to proving out the
confidence engine itself.

## No region highlighting on the review screen

Showing *which part of the page* a value was read from — highlighting the
region on the document image next to the field — is the natural next step
for the review screen, and arguably the most valuable one still on the
table.

**Why it's not built:** the extraction pipeline doesn't currently return
bounding-box coordinates, so this is a server-side extraction change (asking
the model for coordinates, and deciding how much to trust them) rather than
a UI-only addition. Noted as the clear next step, not attempted, because it
touches the extraction contract itself rather than being additive.

## Other things deliberately not built

A few smaller cuts, gathered here rather than each getting a full section:

- **Voice input for queries.** Clarified early that "ask questions" meant
  *typed* plain-English queries, not literal speech — voice would add a
  speech-to-text dependency without adding depth to the actual problem.
- **Excel/CSV import.** A spreadsheet's values are already well-defined, so
  there's no extraction problem to solve — see
  [Problem & scope](01-problem-and-scope.md#input-types-pdfs-and-images-not-spreadsheets).
- **Playwright/E2E browser tests.** Component-level tests already cover
  accessibility and state contracts that regress silently; a real
  browser-driven flow test is worth adding once the upload → review → accept
  screens have enough surface to make it worth the maintenance cost.
- **A toast/notification system.** Nothing in the product currently needs
  transient global messaging — mutation errors surface in place, next to the
  action that failed, which is more useful than a toast that's already gone
  by the time you look up.
- **Optimistic updates on field correction.** A correction also rewrites
  confidence metadata server-side, so patching the client cache by hand risks
  showing a stale badge next to a freshly corrected value. Invalidate-and-
  refetch is the actually-correct behavior here, not a placeholder for
  something faster.
- **Storybook.** A design system worth documenting in isolation needs the
  design decided first — the design system here was extracted from a
  reference and is still settling.
- **Per-provider price tables**, to report LLM cost in currency instead of
  raw tokens. Token counts are measured and stored either way (see
  [Engineering decisions → LLM cost](07-engineering-decisions.md#llm-cost));
  converting to currency is a lookup table away, not a new capability.
- **Caching identical re-uploads by content hash** before spending a model
  call on them. Duplicate detection already catches near-identical documents
  *after* extraction; catching an exact re-upload *before* extraction would
  be a real saving, but the caching path needs care around retries to avoid
  silently serving a stale result.

## Local-first: no Vercel dependency to run it

Not a cut so much as a constraint taken seriously: the project must run fully
locally with a two-line `.env` (`DATABASE_URL` plus any one LLM provider
key), with no requirement to create a Vercel account or link a project just
to clone and run it.

**Why this got real engineering effort instead of being "good enough
eventually":** the deployed URL is where a reviewer *tests* the product; the
repository is where they *verify* it — and that second path shouldn't
require accounts beyond a single LLM key. File storage sits behind a small
driver interface specifically so of this: Vercel Blob when a token is
configured, a local `uploads/` folder when it isn't, with the same interface
either way. See [Architecture → deploy-anywhere, on purpose](02-architecture.md#deploy-anywhere-on-purpose)
for how this constrains the rest of the codebase to stay host-agnostic.

---

← [Back to Engineering decisions](07-engineering-decisions.md) · [Back to overview](index.md)
