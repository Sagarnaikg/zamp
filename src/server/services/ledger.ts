import { and, asc, avg, count, desc, eq, gte, ilike, lte, sum, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, extractions } from "@/server/db/schema";
import {
  describeQuery,
  translateQuery,
  type QueryDsl,
  type QueryFilter,
} from "@/server/llm/query-translate";

/**
 * The ledger is accepted documents only — every number in it has been
 * human-confirmed in review (decisions.md §9), which is what makes query
 * answers trustworthy.
 */

const ledgerColumns = {
  documentId: extractions.documentId,
  filename: documents.filename,
  vendor: extractions.vendor,
  invoiceNumber: extractions.invoiceNumber,
  docDate: extractions.docDate,
  currency: extractions.currency,
  subtotal: extractions.subtotal,
  tax: extractions.tax,
  total: extractions.total,
  category: extractions.category,
};

function baseCondition(workspaceId: string): SQL {
  return and(
    eq(extractions.workspaceId, workspaceId),
    eq(documents.status, "accepted"),
  )!;
}

export function listLedger(workspaceId: string) {
  return db
    .select(ledgerColumns)
    .from(extractions)
    .innerJoin(documents, eq(extractions.documentId, documents.id))
    .where(baseCondition(workspaceId))
    .orderBy(desc(extractions.docDate), asc(documents.filename));
}

/** Map one allow-listed DSL filter onto a typed column condition. */
function filterToCondition(filter: QueryFilter): SQL | null {
  switch (filter.field) {
    case "vendor":
      return filter.op === "contains"
        ? ilike(extractions.vendor, `%${filter.value}%`)
        : ilike(extractions.vendor, filter.value);
    case "invoice_number":
      return filter.op === "contains"
        ? ilike(extractions.invoiceNumber, `%${filter.value}%`)
        : ilike(extractions.invoiceNumber, filter.value);
    case "category":
      return eq(extractions.category, filter.value.toLowerCase());
    case "currency":
      return eq(extractions.currency, filter.value.toUpperCase());
    case "doc_date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filter.value)) return null;
      if (filter.op === "gte") return gte(extractions.docDate, filter.value);
      if (filter.op === "lte") return lte(extractions.docDate, filter.value);
      return eq(extractions.docDate, filter.value);
    }
    case "total": {
      const value = parseFloat(filter.value);
      if (isNaN(value)) return null;
      if (filter.op === "gte") return gte(extractions.total, String(value));
      if (filter.op === "lte") return lte(extractions.total, String(value));
      return eq(extractions.total, String(value));
    }
  }
}

export interface QueryResult {
  question: string;
  interpretation: string;
  dsl: QueryDsl;
  rows: Awaited<ReturnType<typeof listLedger>>;
  aggregate: { kind: QueryDsl["aggregate"]; value: number | null };
}

export async function runQuery(
  workspaceId: string,
  question: string,
): Promise<QueryResult> {
  const dsl = await translateQuery(question);

  const conditions: SQL[] = [baseCondition(workspaceId)];
  for (const filter of dsl.filters) {
    const condition = filterToCondition(filter);
    if (condition) conditions.push(condition);
  }
  const where = and(...conditions);

  const rows = await db
    .select(ledgerColumns)
    .from(extractions)
    .innerJoin(documents, eq(extractions.documentId, documents.id))
    .where(where)
    .orderBy(desc(extractions.docDate), asc(documents.filename));

  let value: number | null = null;
  if (dsl.aggregate !== "none") {
    const aggExpr =
      dsl.aggregate === "sum_total"
        ? sum(extractions.total)
        : dsl.aggregate === "avg_total"
          ? avg(extractions.total)
          : count();
    const [result] = await db
      .select({ value: aggExpr })
      .from(extractions)
      .innerJoin(documents, eq(extractions.documentId, documents.id))
      .where(where);
    value = result.value === null ? null : Number(result.value);
  }

  return {
    question,
    interpretation: describeQuery(dsl),
    dsl,
    rows,
    aggregate: { kind: dsl.aggregate, value },
  };
}
