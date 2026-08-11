import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants";
import { formatAmount, formatDate, formatText } from "@/lib/utils/format";
import type { LedgerRow } from "../types";

/**
 * The ledger proper: accepted documents only, so every number here has been
 * looked at by a human (§9). Each row links back to the document it came
 * from — the point of the ledger is that any figure can be traced.
 */
export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  return (
    <Table caption="Accepted documents, newest first">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Vendor</TableHeaderCell>
          <TableHeaderCell>Invoice number</TableHeaderCell>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Category</TableHeaderCell>
          <TableHeaderCell numeric>Total</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.documentId}>
            <TableCell>
              <Link
                href={ROUTES.review(row.documentId)}
                className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {formatText(row.vendor)}
              </Link>
              <span className="block text-[13px] text-muted">{row.filename}</span>
            </TableCell>
            <TableCell>{formatText(row.invoiceNumber)}</TableCell>
            <TableCell>{formatDate(row.docDate)}</TableCell>
            <TableCell>
              {row.category ? (
                <span className="inline-flex rounded-full bg-surface-raised px-3 py-1 text-[12px] font-medium">
                  {row.category.replace(/_/g, " ")}
                </span>
              ) : (
                formatText(null)
              )}
            </TableCell>
            <TableCell numeric>
              <span className="font-medium">
                {formatAmount(row.total, row.currency)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
