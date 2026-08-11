"use client";

import { History, Table2, Tags } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { formatAmount, formatDate, formatText, humanizeKey } from "@/lib/utils/format";
import type { AuditLogEntry, Extraction, LineItem } from "../types";

/**
 * Everything below the fold of the review screen: the line items, the fields
 * that didn't fit the fixed schema, and what the user has already changed.
 *
 * The extra fields matter — the capture net (§17) exists so nothing legible is
 * lost, and hiding it would defeat that.
 */
export function ExtractionExtras({
  extraction,
  lineItems,
  auditLog,
}: {
  extraction: Extraction;
  lineItems: LineItem[];
  auditLog: AuditLogEntry[];
}) {
  const currency = extraction.currency;

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      {lineItems.length > 0 && (
        <Card className="p-6 sm:p-7 lg:col-span-2">
          <CardHeader icon={Table2} title="Line items" />
          <div className="mt-5">
            <Table caption="Line items extracted from this document">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Description</TableHeaderCell>
                  <TableHeaderCell numeric>Qty</TableHeaderCell>
                  <TableHeaderCell numeric>Unit price</TableHeaderCell>
                  <TableHeaderCell numeric>Amount</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatText(item.description)}</TableCell>
                    <TableCell numeric>{formatText(item.quantity)}</TableCell>
                    <TableCell numeric>
                      {formatAmount(item.unitPrice, currency)}
                    </TableCell>
                    <TableCell numeric>{formatAmount(item.amount, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {extraction.extraFields.length > 0 && (
        <Card className="p-6 sm:p-7">
          <CardHeader icon={Tags} title="Other fields on the document" />
          <dl className="mt-5 space-y-3.5">
            {extraction.extraFields.map((field) => (
              <div
                key={field.key}
                className="flex items-baseline justify-between gap-6 border-b border-border pb-3.5 last:border-0 last:pb-0"
              >
                {/* The label as printed, so it matches what's on the page. */}
                <dt className="text-[13px] text-muted">
                  {field.label || humanizeKey(field.key)}
                </dt>
                <dd className="text-right text-sm font-medium text-foreground">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {auditLog.length > 0 && (
        <Card className="p-6 sm:p-7">
          <CardHeader icon={History} title="Your changes" />
          <ol className="mt-5 space-y-3.5">
            {auditLog.map((entry) => (
              <li
                key={entry.id}
                className="border-b border-border pb-3.5 text-[13px] last:border-0 last:pb-0"
              >
                <span className="font-medium text-foreground">{entry.field}</span>
                <span className="text-muted"> changed from </span>
                <span className="text-muted line-through">
                  {formatText(entry.oldValue)}
                </span>
                <span className="text-muted"> to </span>
                <span className="font-medium text-foreground">
                  {formatText(entry.newValue)}
                </span>
                <span className="block text-subtle">
                  {formatDate(entry.createdAt.toString())}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
