import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { route, type Provider } from "./router";
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
});

export type Extraction = z.infer<typeof extractionSchema>;

const PROMPT = `You are extracting structured data from an invoice, receipt, or expense document.

Rules:
- Extract only what is actually present. Use null for any field you cannot read or that is absent — never guess or invent values.
- Copy numbers exactly as printed, even if the document's own arithmetic looks wrong. Do not "fix" totals.
- doc_date must be YYYY-MM-DD. If the date format is ambiguous (e.g. 03/04/2025), use surrounding context (written month names, due dates, locale hints) to disambiguate; if still ambiguous, pick the more likely reading.
- currency: infer from symbols/context (₹ → INR, $ → USD unless context says otherwise, € → EUR).
- category: pick the closest match for what was purchased.`;

/** Extract from a digital PDF's text layer (cheap text model). */
export async function extractFromText(
  text: string,
  opts?: { avoid?: Provider; secondOpinion?: boolean },
) {
  const routed = route(
    opts?.secondOpinion ? "second_opinion" : "extract_text",
    opts?.avoid,
  );
  if (!routed) return null;
  const structured = routed.model.withStructuredOutput(extractionSchema, {
    name: "document_extraction",
  });
  const result = await structured.invoke([
    new HumanMessage(`${PROMPT}\n\nDocument text:\n\n${text}`),
  ]);
  return { extraction: result as Extraction, provider: routed.provider, modelId: routed.modelId };
}

/** Extract from a scanned PDF or image (strong vision model). */
export async function extractFromFile(
  data: Buffer,
  mimeType: string,
  opts?: { avoid?: Provider; secondOpinion?: boolean },
) {
  const routed = route(
    opts?.secondOpinion ? "second_opinion" : "extract_vision",
    opts?.avoid,
  );
  if (!routed) return null;
  const structured = routed.model.withStructuredOutput(extractionSchema, {
    name: "document_extraction",
  });
  const result = await structured.invoke([
    new HumanMessage({
      content: [
        { type: "text", text: PROMPT },
        {
          type: "file",
          source_type: "base64",
          mime_type: mimeType,
          data: data.toString("base64"),
        },
      ],
    }),
  ]);
  return { extraction: result as Extraction, provider: routed.provider, modelId: routed.modelId };
}

/** Route to the right extraction path for a detected file kind. */
export async function extract(
  kind: FileKind,
  file: { data: Buffer; mimeType: string; text?: string },
  opts?: { avoid?: Provider; secondOpinion?: boolean },
) {
  if (kind === "digital_pdf" && file.text) {
    return extractFromText(file.text, opts);
  }
  return extractFromFile(file.data, file.mimeType, opts);
}
