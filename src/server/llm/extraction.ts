import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { route, type Provider } from "./router";
import { normalizeExtraFields } from "@/server/ingest/normalize";
import { withRetry } from "./errors";
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

const PROMPT = `You are extracting structured data from an invoice, receipt, or expense document.

Rules:
- Extract only what is actually present. Use null for any field you cannot read or that is absent — never guess or invent values.
- Copy numbers exactly as printed, even if the document's own arithmetic looks wrong. Do not "fix" totals.
- doc_date must be YYYY-MM-DD. If the date format is ambiguous (e.g. 03/04/2025), use surrounding context (written month names, due dates, locale hints) to disambiguate; if still ambiguous, pick the more likely reading.
- currency: infer from symbols/context (₹ → INR, $ → USD unless context says otherwise, € → EUR).
- category: pick the closest match for what was purchased.
- extra_fields: capture ALL other labeled data on the document (PO numbers, due dates, payment terms, tax IDs, addresses, reference numbers). Nothing legible should be lost — if it has a label and a value, include it. Give each a normalized snake_case key: the same concept always gets the same key ("PO No" and "Purchase Order Number" are both po_number).`;

/** Post-process one model output: canonicalize extra-field keys. */
function normalized(result: Extraction): Extraction {
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
  const structured = routed.model.withStructuredOutput(extractionSchema, {
    name: "document_extraction",
  });
  const result = await withRetry(() =>
    structured.invoke([
      new HumanMessage(`${PROMPT}\n\nDocument text:\n\n${text}`),
    ]),
  );
  return { extraction: normalized(result as Extraction), provider: routed.provider, modelId: routed.modelId };
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
  const structured = routed.model.withStructuredOutput(extractionSchema, {
    name: "document_extraction",
  });
  const result = await withRetry(() =>
    structured.invoke([
      new HumanMessage({
        content: [
          { type: "text", text: PROMPT },
          fileBlock(routed.provider, data, mimeType, opts?.filename ?? "document"),
        ],
      }),
    ]),
  );
  return { extraction: normalized(result as Extraction), provider: routed.provider, modelId: routed.modelId };
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
