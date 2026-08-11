import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { route } from "./router";
import {
  ExpenseCategory,
  LlmTask,
  QueryAggregate,
  QueryField,
  QueryOperator,
} from "@/server/constants";

/**
 * NL → constrained filter DSL (decisions.md §8, §17). The model never writes
 * SQL; it fills an allow-listed structure that the query builder maps onto
 * typed columns, so unsafe queries are structurally impossible.
 */

export const filterSchema = z.object({
  field: z.nativeEnum(QueryField),
  key: z
    .string()
    .nullable()
    .describe(
      "Only when field is 'extra': the normalized key of the extra field, e.g. po_number, due_date, payment_terms",
    ),
  op: z
    .nativeEnum(QueryOperator)
    .describe("exists = the field is present, any value; only for field 'extra'"),
  value: z.string().describe("Empty string when op is exists"),
});

export const queryDslSchema = z.object({
  filters: z
    .array(filterSchema)
    .describe("All conditions are combined with AND"),
  aggregate: z
    .nativeEnum(QueryAggregate)
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
- category must be one of: ${Object.values(ExpenseCategory).join(", ")}. Map synonyms (e.g. "SaaS" → software, "food" → meals).
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
  const routed = await route(LlmTask.QueryTranslate);
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
 * Rendered from the filters that were APPLIED, not the model's own words, so
 * it can't misrepresent the executed query (decisions.md §5).
 */
export function describeQuery(
  aggregate: QueryDsl["aggregate"],
  appliedFilters: QueryFilter[],
): string {
  const parts: string[] = [];
  const AGG: Record<QueryAggregate, string> = {
    [QueryAggregate.SumTotal]: "sum of totals",
    [QueryAggregate.Count]: "count of documents",
    [QueryAggregate.AvgTotal]: "average total",
    [QueryAggregate.None]: "matching documents",
  };
  parts.push(AGG[aggregate]);
  const OPS: Record<QueryOperator, string> = {
    [QueryOperator.Eq]: "is",
    [QueryOperator.Contains]: "contains",
    [QueryOperator.Gte]: "≥",
    [QueryOperator.Lte]: "≤",
    [QueryOperator.Exists]: "is present",
  };
  for (const filter of appliedFilters) {
    const isExtra = filter.field === QueryField.Extra;
    const name = isExtra
      ? (filter.key ?? QueryField.Extra)
      : filter.field.replace("_", " ");
    const clause =
      filter.op === QueryOperator.Exists
        ? `${name} ${OPS[QueryOperator.Exists]}`
        : `${name} ${OPS[filter.op]} "${filter.value}"`;
    parts.push(clause);
  }
  return parts.join(" · ");
}
