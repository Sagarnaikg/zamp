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

const filterSchema = z.object({
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

const queryDslSchema = z.object({
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

const AGGREGATE_PHRASES: Record<QueryAggregate, string> = {
  [QueryAggregate.SumTotal]: "Total",
  [QueryAggregate.Count]: "Number of documents",
  [QueryAggregate.AvgTotal]: "Average total",
  [QueryAggregate.None]: "Documents",
};

function formatDateNatural(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** A whole calendar year expressed as gte Jan 1 / lte Dec 31 reads better as "in 2026". */
function isFullYearRange(from: string, to: string): boolean {
  return (
    from.slice(5) === "01-01" && to.slice(5) === "12-31" && from.slice(0, 4) === to.slice(0, 4)
  );
}

function dateRangeClause(group: QueryFilter[]): string | null {
  const gte = group.find((f) => f.op === QueryOperator.Gte);
  const lte = group.find((f) => f.op === QueryOperator.Lte);
  const eq = group.find((f) => f.op === QueryOperator.Eq);

  if (gte && lte) {
    return isFullYearRange(gte.value, lte.value)
      ? `in ${gte.value.slice(0, 4)}`
      : `between ${formatDateNatural(gte.value)} and ${formatDateNatural(lte.value)}`;
  }
  if (gte) return `since ${formatDateNatural(gte.value)}`;
  if (lte) return `before ${formatDateNatural(lte.value)}`;
  if (eq) return `on ${formatDateNatural(eq.value)}`;
  return null;
}

function totalClause(filter: QueryFilter): string {
  const amount = `$${filter.value}`;
  if (filter.op === QueryOperator.Gte) return `over ${amount}`;
  if (filter.op === QueryOperator.Lte) return `under ${amount}`;
  return `of exactly ${amount}`;
}

function extraClause(filter: QueryFilter): string {
  const label = filter.key ?? "that field";
  return filter.op === QueryOperator.Exists
    ? `with ${label} present`
    : `where ${label} is ${filter.value}`;
}

function clauseFor(filter: QueryFilter): string {
  switch (filter.field) {
    case QueryField.Vendor:
      return `from ${filter.value}`;
    case QueryField.Category:
      return `in the ${filter.value.replace(/_/g, " ")} category`;
    case QueryField.Currency:
      return `in ${filter.value.toUpperCase()}`;
    case QueryField.InvoiceNumber:
      return `with invoice number ${filter.value}`;
    case QueryField.Total:
      return totalClause(filter);
    case QueryField.Extra:
      return extraClause(filter);
    default:
      return "";
  }
}

/** Groups filters by field first, since a date range is two filters (gte + lte) that read as one clause. */
function clausesFrom(filters: QueryFilter[]): string[] {
  const byField = new Map<string, QueryFilter[]>();
  for (const filter of filters) {
    const key = filter.field === QueryField.Extra ? `extra:${filter.key}` : filter.field;
    byField.set(key, [...(byField.get(key) ?? []), filter]);
  }

  const clauses: string[] = [];
  for (const [key, group] of byField) {
    if (key === QueryField.DocDate) {
      const clause = dateRangeClause(group);
      if (clause) clauses.push(clause);
      continue;
    }
    for (const filter of group) clauses.push(clauseFor(filter));
  }
  return clauses.filter(Boolean);
}

/** "clause A", "clause A and B", or "clause A, B, and C" — an Oxford-comma list. */
function joinNaturally(clauses: string[]): string {
  if (clauses.length <= 1) return clauses[0] ?? "";
  if (clauses.length === 2) return clauses.join(" and ");
  return `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`;
}

/**
 * A plain-English sentence built from the filters that were APPLIED, not the
 * model's own words, so it can't misrepresent the executed query (decisions.md
 * §5) — "total from Acme over $500" rather than a technical filter dump.
 */
export function describeQuery(
  aggregate: QueryDsl["aggregate"],
  appliedFilters: QueryFilter[],
): string {
  const head = AGGREGATE_PHRASES[aggregate];
  const clauses = clausesFrom(appliedFilters);

  if (clauses.length === 0) {
    return aggregate === QueryAggregate.None ? "All documents" : `${head} across all documents`;
  }
  return `${head} ${joinNaturally(clauses)}`;
}
