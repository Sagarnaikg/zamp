---
title: Engineering Decisions
---

[← Back to overview](index.md)

# Engineering decisions

This project kept a running decisions log ([`decisions.md`](https://github.com/Sagarnaikg/zamp/blob/main/decisions.md))
as it was built — written in the moment, not reconstructed afterward. It logs
every real decision: what was chosen, what else was considered, why, and what
got deliberately left out. This page pulls out the ones worth reading even if
you never open the full log — including two that got built, measured, and
then reversed, which is the part most write-ups quietly leave out.

## Model IDs are environment-specific config, not constants

Two separate production failures in one session made this obvious in a way no
amount of caution would have: `gemini-2.5-flash` was retired for new API keys
(a 404), and the OpenAI project key in use could reach exactly one model,
`gpt-5.4-mini` — not the `gpt-4o-mini` that had been pinned in the router (a
403). Both required a source-code edit to fix, which breaks the "just add
your key and run it" promise the whole local-setup story depends on.

The fix: stop hardcoding model IDs entirely. At startup, the app asks each
configured provider's API what models that specific account can actually
reach, and ranks the results into a cheap and a strong tier. Model
availability turned out to be a property of the *account*, not of the
software — and IDs get retired without notice. `GET /api/status` exposes the
outcome so the UI can gate on readiness instead of letting the first upload
fail mysteriously.

A generic `LLM_API_KEY` with the provider inferred from the key's shape (`sk-ant-`
→ Anthropic, `AIza` → Google, …) was actually built first, then removed. That
machinery only earns its keep if the set of supported providers is
open-ended — it isn't; LangChain integration exists for exactly three, and
adding a fourth is a code change regardless. One environment variable per
provider, with nothing to infer, replaced it. Runtime model discovery — the
part that actually solved a real failure — stayed.

## The vision path had never worked

Wiring up cross-provider agreement exposed that vision extraction — reading
scans and photos — had silently never worked at all. `@langchain/google-genai`
gates file attachments behind a naive model-name check
(`model.startsWith("gemini-2")`) that rejects Google's own `-latest` model
aliases, throwing "This model does not support files." Every scan or photo
upload would have failed; only digital PDFs had ever been tested, because
that's all the early sample set exercised.

Fixed by emitting a provider-appropriate attachment block instead — Gemini's
`media` block reaches the identical underlying payload without tripping the
check — isolated in one `fileBlock()` helper so the leak in LangChain's
"unified interface" stays contained to one place. A photo-style receipt
sample was added to the demo set specifically so the vision path can never
silently regress like that again.

## Provider failures: classify them, don't just surface them

Raw provider errors used to reach the user directly —
`[429] Resource exhausted: generativelanguage.googleapis.com/…` instead of
anything actionable. Now every error is classified into a kind, a
plain-English message, and whether it's worth retrying automatically.

Rate limits aren't an edge case here — on a free-tier provider key, they're
the *expected* failure for anyone running the project from a fresh clone,
which makes this a setup-experience problem as much as an error-handling
one. Transient failures (rate limits, 5xx, timeouts) retry automatically up
to three times with backoff; non-retryable failures (a bad key, a model the
account can't reach) fail immediately instead of burning three attempts on a
certainty. A manual retry endpoint re-runs extraction on the file already in
storage, so a failed document costs one click, not a re-upload.

## Escalation ladder: why validation moved to run *after* the tiebreak

The full ladder is covered in [Extraction pipeline](03-extraction-pipeline.md#5-compare-then-tiebreak--the-escalation-ladder),
but the bug that shaped its final order is worth recording on its own.
Validation originally ran against the *primary* reading only, so a value
installed later by majority voting was never re-checked. On a test document,
the vote corrected a date to one that landed in the future — and it still
scored 0.98 instead of getting flagged, because the arithmetic and format
checks had judged a value that was then discarded. Validation now runs on
the *resolved* extraction, after the tiebreak, and a field that was both
corrected and still fails validation shows both reasons.

## Region cropping: tried, measured, reverted

A genuinely good-sounding idea: when re-reading a disputed field, send only
the part of the document it lives in — the totals block, say — instead of
the full page. Fewer image tiles, and a model looking at a small focused crop
should plausibly read it more carefully.

It was built, then measured, and it doesn't work:

| Image size | Full page (tokens) | Cropped (tokens) | Change |
|---|---|---|---|
| 560 × 760 | 1,305 | 1,369 | **−5%** (worse) |
| 1,200 × 1,630 | 1,333 | 1,369 | **−3%** (worse) |
| 2,400 × 3,260 | 1,333 | 1,369 | **−3%** (worse) |

Cropping made every size slightly *more* expensive, with identical extracted
values every time — no accuracy gain either. The finding worth keeping:
input tokens barely moved between a 560px image and a 2,400px one, because
providers normalize images to a fixed token budget server-side before
charging. **Image dimensions turned out to not be a real cost lever on this
stack at all** — the crop only added the extra "this is a cropped section"
instruction, which is why it made things marginally worse rather than
neutral. This also retired a separately-planned idea (downscaling images
before sending them) on the same evidence, before any time was spent
building it.

The crop module, its tests, and a native `@napi-rs/canvas` runtime dependency
it required were all reverted. What stayed, because it *did* measure well:
adaptive second reading, the reduced comparison schema, and text clamping —
see [LLM cost](#llm-cost) below.

## LLM cost

Four changes, kept in the order they actually mattered — measuring first,
then only optimizing what the measurement justified:

1. **Measured, not assumed.** Every model call reports its token usage,
   accumulated per document. This is the product's only real operating
   expense, and optimizing it without measuring it first is guesswork.
2. **Adaptive second reading** — see
   [Extraction pipeline](03-extraction-pipeline.md#4-second-reading--only-when-it-earns-its-cost).
3. **Reduced schema for the second reading** — it exists only to be compared
   field by field, so it stopped re-extracting line items and extra fields
   that would just be discarded.
4. **Text clamping** on long PDFs — keep the head and tail, skip the middle.

Measured result on real documents:

| Document | Model calls | Input tokens | Output tokens |
|---|---|---|---|
| Clean digital invoice (PDF) | **1** (was 2) | 454 | 443 |
| Phone-photo receipt (image) | 2 | 2,680 | 432 |

Roughly half the cost on the clean-PDF path, with **no new review work
created** — the skipped document came back with nothing flagged, the money
fields still corroborated by arithmetic alone. The honest trade-off: on a
clean digital PDF, text fields like vendor and invoice number now sit at
"unverified" rather than "verified," because nothing independently
corroborates them anymore. They aren't flagged and create no extra review
work — but the badge is honest about the weaker evidence behind them, which
is the actual point of the whole confidence system.

## Making the pipeline visible

Before this, every interesting decision the system made was invisible — a
user watching "Processing…" had no idea two providers read their document,
or that a second reading was skipped because the arithmetic already
reconciled. Those decisions *are* the product; the confidence engine was
already showing its work per field, just not per pipeline. See
[Extraction pipeline → making the pipeline visible](03-extraction-pipeline.md#making-the-pipeline-visible)
for the full mechanics, and [Architecture](02-architecture.md) for why it's
built as a genuine DAG rather than a list.

## Sensitive-data redaction, scoped narrow on purpose

Card numbers and IBANs are masked before a digital PDF's text ever reaches an
LLM provider, and again on every extracted value afterward (covering the
vision path, where pixels can't be pre-redacted). The pattern set is narrow —
only two things, both with a real checksum to validate against — specifically
because a looser "any long digit string" rule would misfire on invoice and PO
numbers, corrupting the exact fields this product exists to extract
correctly. See [Extraction pipeline → redaction](03-extraction-pipeline.md#2-first-reading--and-redaction-before-it-ever-leaves-the-server).

## Concurrency: assessed honestly, not oversold

Every service is `async`/`await` over I/O with no shared per-user mutable
state, so one user's slow LLM call doesn't block another's request — that
part holds up. Three real gaps were identified and deliberately **not**
solved, because each is genuine infrastructure work, not a design flaw to
patch in a day: the database connection pool has no explicit sizing tuned for
concurrent load, LLM provider rate limits are shared across every user of a
single deployment (not something this codebase can raise on its own), and
there's no per-workspace request queueing or throttling yet. Noted honestly
in the log rather than glossed over, because "not solved" and "not noticed"
are different things worth being clear about.

## Codebase conventions, adopted project-wide

After a full read-through partway through the build, a set of conventions
was adopted everywhere, not applied as a one-off cleanup: string enums over
raw string literals for every fixed value set, one constants module per
concern (`enums.ts`, `config.ts`, `messages.ts`) so no route or service ever
hardcodes a URL, status code, or user-facing string, error classification
reduced to a flat sequence of predicate functions with no nested branching,
and tests physically mirrored into `tests/` rather than living beside their
source files. Verified, not just asserted: after the migration, typecheck and
lint were both clean project-wide, all existing unit tests passed unchanged,
and a full upload → extract → review → correct → accept → query round trip
was re-verified end to end against the running dev server.

---

For the complete, unedited log — every decision, including smaller ones not
covered here — see [`decisions.md`](https://github.com/Sagarnaikg/zamp/blob/main/decisions.md)
in the repository.

Next: **[Scope & trade-offs →](08-scope-and-tradeoffs.md)**
