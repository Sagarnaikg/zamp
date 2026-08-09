import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { route } from "./router";
import { CATEGORIES } from "./extraction";

/**
 * NL → constrained filter DSL (decisions.md §8). The model never writes SQL;
 * it fills an allow-listed structure, and the query builder maps that onto
 * typed columns. Unpredictable/unsafe queries are structurally impossible.
 */

export const filterSchema = z.object({
  field: z.enum([
    "vendor",
    "category",
    "currency",
    "invoice_number",
    "doc_date",
    "total",
  ]),
  op: z.enum(["eq", "contains", "gte", "lte"]),
  value: z.string(),
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

function prompt(question: string, today: string): string {
  return `Translate this question about a ledger of invoices/receipts/expenses into filters.

Today's date: ${today}

Rules:
- Date ranges are two doc_date filters (gte + lte), values as YYYY-MM-DD. "July" with no year means the most recent July. "last month" / "this quarter" are relative to today.
- Vendor names use op "contains" (users rarely type the exact registered name).
- category must be one of: ${CATEGORIES.join(", ")}. Map synonyms (e.g. "SaaS" → software, "food" → meals).
- Amount conditions ("over $500") are total filters with gte/lte, plain numbers.
- "how much" means sum_total; "how many" means count; "average" means avg_total; otherwise none.
- Only add filters the question actually implies. An unfilterable question gets no filters.

Question: ${question}`;
}

export async function translateQuery(
  question: string,
  today: Date = new Date(),
): Promise<QueryDsl> {
  const routed = route("query_translate");
  if (!routed) throw new Error("No LLM provider configured");
  const structured = routed.model.withStructuredOutput(queryDslSchema, {
    name: "ledger_query",
  });
  const result = await structured.invoke([
    new HumanMessage(prompt(question, today.toISOString().slice(0, 10))),
  ]);
  return result as QueryDsl;
}

/**
 * Human-readable rendering of what the query will actually do — derived
 * from the DSL, not from the model, so it can't misrepresent the query
 * (decisions.md §5: the interpretation shown must be verifiable).
 */
export function describeQuery(dsl: QueryDsl): string {
  const parts: string[] = [];
  const AGG: Record<QueryDsl["aggregate"], string> = {
    sum_total: "sum of totals",
    count: "count of documents",
    avg_total: "average total",
    none: "matching documents",
  };
  parts.push(AGG[dsl.aggregate]);
  const OPS: Record<QueryFilter["op"], string> = {
    eq: "is",
    contains: "contains",
    gte: "≥",
    lte: "≤",
  };
  for (const f of dsl.filters) {
    parts.push(`${f.field.replace("_", " ")} ${OPS[f.op]} "${f.value}"`);
  }
  return parts.join(" · ");
}
