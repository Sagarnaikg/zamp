import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { route } from "./router";
import { CATEGORIES } from "./extraction";

/**
 * NL → constrained filter DSL (decisions.md §8). The model never writes SQL;
 * it fills an allow-listed structure, and the query builder maps that onto
 * typed columns — or, for field "extra", onto parameterized JSONB conditions
 * over the extra-fields capture net (decisions.md §17). Unpredictable/unsafe
 * queries are structurally impossible.
 */

export const filterSchema = z.object({
  field: z.enum([
    "vendor",
    "category",
    "currency",
    "invoice_number",
    "doc_date",
    "total",
    "extra",
  ]),
  key: z
    .string()
    .nullable()
    .describe(
      "Only when field is 'extra': the normalized key of the extra field, e.g. po_number, due_date, payment_terms",
    ),
  op: z
    .enum(["eq", "contains", "gte", "lte", "exists"])
    .describe("exists = the field is present, any value; only for field 'extra'"),
  value: z.string().describe("Empty string when op is exists"),
});

export const queryDslSchema = z.object({
  filters: z
    .array(filterSchema)
    .describe("All conditions are combined with AND"),
  aggregate: z
    .enum(["sum_total", "count", "avg_total", "none"])
    .describe("Use none to list matching documents"),
});

export type QueryFilter = z.infer<typeof filterSchema>;
export type QueryDsl = z.infer<typeof queryDslSchema>;

function prompt(question: string, today: string, extraKeys: string[]): string {
  const extras =
    extraKeys.length > 0
      ? `- Documents also carry extra fields with these keys: ${extraKeys.join(", ")}. To filter on one, use field "extra" with the key set — op "exists" (is the field present), "eq" or "contains" (match its value). Never invent keys not in this list.`
      : `- No extra fields exist in this ledger yet — use only the named fields.`;

  return `Translate this question about a ledger of invoices/receipts/expenses into filters.

Today's date: ${today}

Rules:
- Date ranges are two doc_date filters (gte + lte), values as YYYY-MM-DD. "July" with no year means the most recent July. "last month" / "this quarter" are relative to today.
- Vendor names use op "contains" (users rarely type the exact registered name).
- category must be one of: ${CATEGORIES.join(", ")}. Map synonyms (e.g. "SaaS" → software, "food" → meals).
- Amount conditions ("over $500") are total filters with gte/lte, plain numbers.
${extras}
- "how much" means sum_total; "how many" means count; "average" means avg_total; otherwise none.
- Only add filters the question actually implies. An unfilterable question gets no filters.
- key must be null unless field is "extra".

Question: ${question}`;
}

export async function translateQuery(
  question: string,
  opts?: { today?: Date; extraKeys?: string[] },
): Promise<QueryDsl> {
  const routed = route("query_translate");
  if (!routed) throw new Error("No LLM provider configured");
  const structured = routed.model.withStructuredOutput(queryDslSchema, {
    name: "ledger_query",
  });
  const result = await structured.invoke([
    new HumanMessage(
      prompt(
        question,
        (opts?.today ?? new Date()).toISOString().slice(0, 10),
        opts?.extraKeys ?? [],
      ),
    ),
  ]);
  return result as QueryDsl;
}

/**
 * Human-readable rendering of what the query actually did — derived from
 * the filters that were APPLIED, not from the model's own words, so it
 * can't misrepresent the executed query (decisions.md §5).
 */
export function describeQuery(
  aggregate: QueryDsl["aggregate"],
  appliedFilters: QueryFilter[],
): string {
  const parts: string[] = [];
  const AGG: Record<QueryDsl["aggregate"], string> = {
    sum_total: "sum of totals",
    count: "count of documents",
    avg_total: "average total",
    none: "matching documents",
  };
  parts.push(AGG[aggregate]);
  const OPS: Record<QueryFilter["op"], string> = {
    eq: "is",
    contains: "contains",
    gte: "≥",
    lte: "≤",
    exists: "is present",
  };
  for (const f of appliedFilters) {
    const name =
      f.field === "extra" ? (f.key ?? "extra") : f.field.replace("_", " ");
    parts.push(
      f.op === "exists"
        ? `${name} ${OPS.exists}`
        : `${name} ${OPS[f.op]} "${f.value}"`,
    );
  }
  return parts.join(" · ");
}
