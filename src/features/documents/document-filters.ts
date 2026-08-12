import { DocumentStatus } from "@/server/constants";
import type { DocumentListItem } from "./types";

export interface DocumentFilters {
  search: string;
  status: DocumentStatus | "all";
  /** Inclusive, as typed into a date input — empty string means unbounded. */
  dateFrom: string;
  dateTo: string;
}

/** The page's starting filters: unbounded. A narrower default (this used to
 * be the last 7 days) can make an upload outside that window read as a
 * failure — the upload appears to have vanished rather than just being
 * filtered out. Pagination is what keeps a long history from dumping onto
 * the page at once, not the date filter. */
export const defaultFilters: DocumentFilters = {
  search: "",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

/** Local-date comparison, so "to" includes the whole day rather than midnight. */
function withinRange(createdAt: Date, from: string, to: string): boolean {
  if (from && createdAt < new Date(`${from}T00:00:00`)) return false;
  if (to && createdAt > new Date(`${to}T23:59:59.999`)) return false;
  return true;
}

/**
 * Client-side filtering over an already-fetched list. A workspace's document
 * count is small enough that round-tripping to the server for this would be
 * pure latency, not a real scaling need.
 */
export function filterDocuments(
  documents: DocumentListItem[],
  filters: DocumentFilters,
): DocumentListItem[] {
  const query = filters.search.trim().toLowerCase();

  return documents.filter((document) => {
    if (
      query &&
      !document.filename.toLowerCase().includes(query) &&
      !document.vendor?.toLowerCase().includes(query) &&
      !document.invoiceNumber?.toLowerCase().includes(query)
    ) {
      return false;
    }
    if (filters.status !== "all" && document.status !== filters.status) return false;
    if (!withinRange(new Date(document.createdAt), filters.dateFrom, filters.dateTo)) {
      return false;
    }
    return true;
  });
}
