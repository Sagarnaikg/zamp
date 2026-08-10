import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { route, type Provider } from "./router";
import { normalizeExtraFields } from "@/server/ingest/normalize";
import { withRetry } from "./errors";
import { usageFromResponse, type TokenUsage } from "./usage";
import type { FileKind } from "@/server/ingest/detect";

export const CATEGORIES = [
  "software",
  "hardware",
  "travel",
  "meals",
  "office_supplies",
  "utilities",
  "professional_services",
  "marketing",
  "rent",
  "other",
] as const;

export const lineItemSchema = z.object({
  description: z.string().nullable().describe("What was purchased"),
  quantity: z.number().nullable(),
  unit_price: z.number().nullable(),
  amount: z.number().nullable().describe("Line total for this item"),
});

export const extractionSchema = z.object({
  vendor: z.string().nullable().describe("Business that issued the document"),
  invoice_number: z.string().nullable(),
  doc_date: z
    .string()
    .nullable()
    .describe("Document date in YYYY-MM-DD format"),
  currency: z
    .string()
    .nullable()
    .describe("ISO 4217 currency code, e.g. USD, INR, EUR"),
  subtotal: z.number().nullable().describe("Amount before tax"),
  tax: z.number().nullable().describe("Total tax amount"),
  total: z.number().nullable().describe("Final amount payable"),
  category: z.enum(CATEGORIES).nullable(),
  line_items: z.array(lineItemSchema),
  extra_fields: z
    .array(
      z.object({
        key: z
          .string()
          .describe(
            "Normalized snake_case identifier for the concept, e.g. po_number, due_date, payment_terms, gstin — the same concept must always get the same key regardless of how the document labels it",
          ),
        label: z.string().describe("The field's label as printed, e.g. 'PO No.'"),
        value: z.string().describe("The field's value as printed"),
      }),
    )
    .describe(
      "Every other clearly labeled field on the document not covered by the fields above — e.g. PO number, due date, payment terms, tax/VAT ID, billing address, account numbers. Empty array if none.",
    ),
});

export type Extraction = z.infer<typeof extractionSchema>;

/**
 * The second reading exists only to be compared field-by-field against the
 * first, and only these scalar fields are compared — re-extracting line
 * items and extra fields would be output tokens we parse and discard
 * (decisions.md §21).
 */
export const comparableSchema = extractionSchema.pick({
  vendor: true,
  invoice_number: true,
  doc_date: true,
  currency: true,
  subtotal: true,
  tax: true,
  total: true,
  category: true,
});

const PROMPT = `You are extracting structured data from an invoice, receipt, or expense document.

Rules:
- Extract only what is actually present. Use null for any field you cannot read or that is absent — never guess or invent values.
- Copy numbers exactly as printed, even if the document's own arithmetic looks wrong. Do not "fix" totals.
- doc_date must be YYYY-MM-DD. If the date format is ambiguous (e.g. 03/04/2025), use surrounding context (written month names, due dates, locale hints) to disambiguate; if still ambiguous, pick the more likely reading.
- currency: infer from symbols/context (₹ → INR, $ → USD unless context says otherwise, € → EUR).
- category: pick the closest match for what was purchased.
- extra_fields: capture ALL other labeled data on the document (PO numbers, due dates, payment terms, tax IDs, addresses, reference numbers). Nothing legible should be lost — if it has a label and a value, include it. Give each a normalized snake_case key: the same concept always gets the same key ("PO No" and "Purchase Order Number" are both po_number).`;

/**
 * Guard against pathological input: an invoice's meaningful content is at
 * the top (vendor, number, date) and the bottom (totals), so a very long
 * document keeps both ends rather than paying for the middle.
 */
const MAX_TEXT_CHARS = 24_000;

export function clampText(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text;
  const half = Math.floor(MAX_TEXT_CHARS / 2);
  return `${text.slice(0, half)}\n\n[... ${text.length - MAX_TEXT_CHARS} characters omitted ...]\n\n${text.slice(-half)}`;
}

/**
 * Post-process one model output: canonicalize extra-field keys. The second
 * reading uses the reduced schema and has no extra fields to normalize.
 */
function normalized(result: Extraction): Extraction {
  if (!result.extra_fields) return result;
  return {
    ...result,
    extra_fields: normalizeExtraFields(result.extra_fields),
  };
}

/**
 * Build a provider-appropriate attachment block. LangChain's unified message
 * format leaks here: @langchain/google-genai gates standard `file` blocks
 * behind a naive model-name prefix check (`startsWith("gemini-2")` etc.),
 * which rejects Google's own `-latest` aliases even though they are fully
 * multimodal. Its `media` block reaches the same `inlineData` payload
 * without that check. Isolated in one place so the workaround stays
 * contained and provider-agnostic callers stay clean.
 */
function fileBlock(
  provider: Provider,
  data: Buffer,
  mimeType: string,
  filename: string,
) {
  const base64 = data.toString("base64");
  if (provider === "google") {
    return { type: "media", mimeType, data: base64 };
  }
  // OpenAI rejects file uploads without a filename (it otherwise substitutes
  // a placeholder and warns); images go through the image block instead.
  if (mimeType.startsWith("image/")) {
    return {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64}` },
    };
  }
  return {
    type: "file",
    source_type: "base64",
    mime_type: mimeType,
    data: base64,
    metadata: { filename },
  };
}

/** Extract from a digital PDF's text layer (cheap text model). */
export async function extractFromText(
  text: string,
  opts?: { avoid?: Provider; secondOpinion?: boolean },
) {
  const routed = await route(
    opts?.secondOpinion ? "second_opinion" : "extract_text",
    opts?.avoid,
  );
  const schema = opts?.secondOpinion ? comparableSchema : extractionSchema;
  const structured = routed.model.withStructuredOutput(schema, {
    name: "document_extraction",
    includeRaw: true,
  });
  const { parsed, raw } = await withRetry(() =>
    structured.invoke([
      new HumanMessage(`${PROMPT}\n\nDocument text:\n\n${clampText(text)}`),
    ]),
  );
  return {
    extraction: normalized(parsed as Extraction),
    provider: routed.provider,
    modelId: routed.modelId,
    usage: usageFromResponse(raw),
  };
}

/** Extract from a scanned PDF or image (strong vision model). */
export async function extractFromFile(
  data: Buffer,
  mimeType: string,
  opts?: { avoid?: Provider; secondOpinion?: boolean; filename?: string },
) {
  const routed = await route(
    opts?.secondOpinion ? "second_opinion" : "extract_vision",
    opts?.avoid,
  );
  const schema = opts?.secondOpinion ? comparableSchema : extractionSchema;
  const structured = routed.model.withStructuredOutput(schema, {
    name: "document_extraction",
    includeRaw: true,
  });
  const { parsed, raw } = await withRetry(() =>
    structured.invoke([
      new HumanMessage({
        content: [
          { type: "text", text: PROMPT },
          fileBlock(routed.provider, data, mimeType, opts?.filename ?? "document"),
        ],
      }),
    ]),
  );
  return {
    extraction: normalized(parsed as Extraction),
    provider: routed.provider,
    modelId: routed.modelId,
    usage: usageFromResponse(raw),
  };
}

// Field rules must match the main prompt exactly: a re-read that returns
// "09/03/2026" where the first pass returned "2026-03-09" looks like a
// disagreement when it is only a formatting difference.
const FIELD_RULES = `- doc_date must be YYYY-MM-DD. If the date format is ambiguous (e.g. 03/04/2025), use surrounding context (written month names, due dates, locale hints) to disambiguate; if still ambiguous, pick the more likely reading.
- currency: infer from symbols/context (₹ → INR, $ → USD unless context says otherwise, € → EUR).
- Copy numbers exactly as printed, even if the document's own arithmetic looks wrong. Do not "fix" totals.`;

const FOCUSED_PROMPT = `You are double-checking specific fields on an invoice, receipt, or expense document.

Read the document carefully and report ONLY the fields requested below. These values are being verified because an earlier reading was uncertain, so accuracy matters more than speed:
- Look at the actual characters on the page. Digits that look similar (0/8, 1/7, 3/8, 5/6) are the usual source of error.
- Use null if a field genuinely is not on the document. Do not guess.
${FIELD_RULES}`;

/**
 * Re-read only the disputed fields, with a narrower schema and a prompt
 * focused on careful reading (decisions.md §20). Deliberately NOT shown the
 * candidate values it is adjudicating — an independent third opinion is
 * worth more than a confirmation of someone else's answer.
 */
export async function extractFocused(
  fields: readonly string[],
  file: { data: Buffer; mimeType: string; filename?: string },
  opts?: { avoid?: Provider },
): Promise<{ fields: Partial<Extraction>; usage: TokenUsage } | null> {
  if (fields.length === 0) return null;

  const mask = Object.fromEntries(fields.map((f) => [f, true as const]));
  const focusedSchema = extractionSchema.pick(
    mask as Parameters<typeof extractionSchema.pick>[0],
  );

  // The deciding vote is worth the strong tier.
  const routed = await route("second_opinion", opts?.avoid);
  const structured = routed.model.withStructuredOutput(focusedSchema, {
    name: "focused_recheck",
    includeRaw: true,
  });

  const { parsed, raw } = await withRetry(() =>
    structured.invoke([
      new HumanMessage({
        content: [
          {
            type: "text",
            text: `${FOCUSED_PROMPT}\n\nFields to report: ${fields.join(", ")}`,
          },
          fileBlock(
            routed.provider,
            file.data,
            file.mimeType,
            file.filename ?? "document",
          ),
        ],
      }),
    ]),
  );
  return {
    fields: parsed as Partial<Extraction>,
    usage: usageFromResponse(raw),
  };
}

/** Route to the right extraction path for a detected file kind. */
export async function extract(
  kind: FileKind,
  file: { data: Buffer; mimeType: string; text?: string; filename?: string },
  opts?: { avoid?: Provider; secondOpinion?: boolean },
) {
  // Second opinions always read the document visually. For digital PDFs the
  // primary read the text layer, so the reviewer sees a different
  // representation of the same document — decorrelating errors even when
  // both readings come from the same provider (decisions.md §8).
  if (kind === "digital_pdf" && file.text && !opts?.secondOpinion) {
    return extractFromText(file.text, opts);
  }
  return extractFromFile(file.data, file.mimeType, {
    ...opts,
    filename: file.filename,
  });
}
