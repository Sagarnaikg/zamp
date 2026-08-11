import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { route } from "./router";
import { normalizeExtraFields } from "@/server/ingest/normalize";
import { withRetry } from "./errors";
import { usageFromResponse } from "./usage";
import { redactSensitive } from "@/server/security/redact";
import type { TokenUsage } from "@/server/db/schema";
import {
  EXTRACTION,
  EXTRACTION_PROMPT,
  ExpenseCategory,
  FOCUSED_PROMPT,
  IMAGE_MIME_PREFIX,
  FileKind,
  LlmTask,
  Provider,
  TEXT_OMITTED_MARKER,
} from "@/server/constants";

const lineItemSchema = z.object({
  description: z.string().nullable().describe("What was purchased"),
  quantity: z.number().nullable(),
  unit_price: z.number().nullable(),
  amount: z.number().nullable().describe("Line total for this item"),
});

const extractionSchema = z.object({
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
  category: z.nativeEnum(ExpenseCategory).nullable(),
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

/** Only these fields are compared, so the second reading skips the rest. */
const comparableSchema = extractionSchema.pick({
  vendor: true,
  invoice_number: true,
  doc_date: true,
  currency: true,
  subtotal: true,
  tax: true,
  total: true,
  category: true,
});


/** Keep head and tail of a long document; the middle is rarely load-bearing. */
function clampText(text: string): string {
  const limit = EXTRACTION.maxTextChars;
  if (text.length <= limit) return text;
  const half = Math.floor(limit / 2);
  return (
    text.slice(0, half) +
    TEXT_OMITTED_MARKER(text.length - limit) +
    text.slice(-half)
  );
}

/** Redact before the text leaves our server; output is redacted too. */
function redactBeforeSending(text: string): string {
  return redactSensitive(text).text;
}

/**
 * Canonicalize extra-field keys and redact their values — the safety net
 * covering the vision path, where pixels can't be redacted before reading.
 */
function normalized(result: Extraction): Extraction {
  if (!result.extra_fields) return result;
  return {
    ...result,
    extra_fields: normalizeExtraFields(result.extra_fields).map((field) => ({
      ...field,
      value: redactSensitive(field.value).text,
    })),
  };
}

/**
 * Provider-appropriate attachment block. Google is special-cased because
 * @langchain/google-genai gates standard `file` blocks behind a model-name
 * check that rejects its own `-latest` aliases; its `media` block reaches
 * the same payload without that check.
 */
function fileBlock(
  provider: Provider,
  data: Buffer,
  mimeType: string,
  filename: string,
) {
  const base64 = data.toString("base64");
  if (provider === Provider.Google) {
    return { type: "media", mimeType, data: base64 };
  }
  // OpenAI needs a filename on file blocks; images use the image block.
  if (mimeType.startsWith(IMAGE_MIME_PREFIX)) {
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
async function extractFromText(
  text: string,
  opts?: { avoid?: Provider; secondOpinion?: boolean },
) {
  const routed = await route(
    opts?.secondOpinion ? LlmTask.SecondOpinion : LlmTask.ExtractText,
    opts?.avoid,
  );
  const schema = opts?.secondOpinion ? comparableSchema : extractionSchema;
  const structured = routed.model.withStructuredOutput(schema, {
    name: "document_extraction",
    includeRaw: true,
  });
  const { parsed, raw } = await withRetry(() =>
    structured.invoke([
      new HumanMessage(`${EXTRACTION_PROMPT}\n\nDocument text:\n\n${redactBeforeSending(clampText(text))}`),
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
async function extractFromFile(
  data: Buffer,
  mimeType: string,
  opts?: { avoid?: Provider; secondOpinion?: boolean; filename?: string },
) {
  const routed = await route(
    opts?.secondOpinion ? LlmTask.SecondOpinion : LlmTask.ExtractVision,
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
          { type: "text", text: EXTRACTION_PROMPT },
          fileBlock(routed.provider, data, mimeType, opts?.filename ?? EXTRACTION.defaultAttachmentFilename),
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

/**
 * Re-read only the disputed fields (decisions.md §20). Deliberately NOT
 * shown the candidate values — an independent opinion is worth more than a
 * confirmation of someone else's answer.
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

  const routed = await route(LlmTask.SecondOpinion, opts?.avoid);
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
  // Second opinions read visually even for digital PDFs, so the two
  // readings see different representations (decisions.md §8).
  if (kind === FileKind.DigitalPdf && file.text && !opts?.secondOpinion) {
    return extractFromText(file.text, opts);
  }
  return extractFromFile(file.data, file.mimeType, {
    ...opts,
    filename: file.filename,
  });
}
