---
title: Problem & Scope
---

[← Back to overview](index.md)

# Problem & scope

## The problem, in a few problem statements

Before any code, the actual problem to solve had to be picked from a short list.
Three were seriously considered:

1. **Learn a user's process by watching them, then do it for them.** Genuinely
   interesting — reliable observation, generalizing from one demonstration, and
   replaying it on new inputs is a real systems problem. Also realistically a
   multi-day problem on its own; attempting it in one focused build day risked
   a shallow demo instead of depth on anything.
2. **Build a conversational agent.** Viable, but too open-ended without a
   sharper task — it risks becoming a generic chatbot wrapper with nothing of
   its own to say.
3. **Turn messy documents into structured, queryable data.** Tractable to build
   genuinely deep in a day, and thematically on-target for a fintech company
   whose actual domain is invoices, receipts, and statements.

**#3 was the pick.** Not because it's easier — a shallow version of it is
easy, which is exactly the trap — but because it was possible to go deep on
one real problem within it, rather than shallow across three.

## Who this is for

The target user is a **finance or accounting person whose extracted numbers
feed real books** — someone who needs to *trust* the data, not just receive
it. That's a deliberate choice against the alternative: a founder or ops
person who just wants a quick spend total from a shoebox of receipts and
doesn't care much about per-field correctness.

The finance-person framing changes what "done" means. It turns correctness
from a nice-to-have into the actual product. A wrong extracted total isn't a
UI bug — it's a wrong number in the books. That's what makes field-level
confidence and a human correction loop the point of the project, not an
add-on.

## Document domain: invoices and receipts, not "any document"

Scope is invoices, receipts, and expense documents specifically — not fully
general, arbitrary documents (contracts, resumes, forms, bank statements, all
with different unknown structures).

A fixed-but-realistic schema — vendor, date, total, currency, tax, line items,
category — gives a concrete, testable target while still allowing real-world
messiness: scans, phone photos, inconsistent vendor layouts, multi-page
documents. Going fully general would have made *inferring the schema itself*
the whole project, at the cost of any depth on the actual extraction-trust
problem.

## Input types: PDFs and images, not spreadsheets

Accepted inputs are PDFs (both digital-native and scanned) and images
(JPG/PNG/WebP). Excel/CSV expense exports were deliberately **not** supported,
even though they'd have been an easy win.

That's exactly why they were cut. A spreadsheet's values are already
well-defined — importing one is a column-mapping feature, not an extraction
problem. This project exists because documents are messy and error-prone;
supporting the one input type that isn't messy adds surface area, not depth.

Digital PDFs and scans/photos also aren't the same problem underneath: a
digital PDF has a real, exact text layer (semi-structured — a text model can
read it directly), while a scan or phone photo is fully unstructured pixels
that need a vision model. Detecting which case applies and routing
accordingly is a genuine second job for the system, not busywork.

## The hard sub-problem

Everything above sets up the actual thing this project is trying to prove out:

> **Field-level extraction confidence, derived from independent and checkable
> evidence — never from a model's own self-reported confidence — feeding a
> fast human correction loop.**

The shallow version of "trustworthy extraction" is asking the LLM to also
return a 0–1 confidence score per field and coloring cells by it. That was
explicitly rejected: LLM self-reported confidence is notoriously
miscalibrated — a model will happily report 0.95 on a value it hallucinated.
It's a prompt tweak, not a solved problem, and it would have been the easy,
unconvincing path.

Instead, confidence here comes from four things that can each be independently
checked: whether the document's own arithmetic reconciles, whether values are
even plausible (dates that parse, currencies that exist), whether two
independent readings of the document agree, and whether this document has
been seen before. The full mechanics are in
**[Confidence engine](04-confidence-engine.md)**.

## What was deliberately cut, and why

Every scope cut below was a choice, not something that ran out of time to
build — see **[Scope & trade-offs](08-scope-and-tradeoffs.md)** for the
extended version of several of these:

- **Excel/CSV import** — no extraction problem to solve there; see above.
- **Fully general document types** — would make schema-inference the whole
  project.
- **Model self-reported confidence as a signal** — unreliable by nature; see above.
- **Voice input for queries** — "verbally ask questions" was clarified early to
  mean *typed* plain-English queries, not literal speech. Voice would add a
  speech-to-text dependency without adding depth to the actual problem.
- **Vendor name normalization** ("Acme Svc" vs. "Acme Services LLC" treated as
  one vendor) — a real problem that quietly breaks vendor-level queries, kept
  as a stretch goal rather than core scope.
- **Login accounts / real auth** — see [Scope & trade-offs](08-scope-and-tradeoffs.md#no-login-accounts).
- **A remote feature-flag service** — see [Scope & trade-offs](08-scope-and-tradeoffs.md#feature-flags-are-static-not-a-service).

---

Next: **[Architecture →](02-architecture.md)**
