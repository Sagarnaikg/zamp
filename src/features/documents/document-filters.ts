import { DocumentStatus } from "@/server/constants";
import type { DocumentListItem } from "./types";

export interface DocumentFilters {
  search: string;
  status: DocumentStatus | "all";
  /** Inclusive, as typed into a date input — empty string means unbounded. */
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: DocumentFilters = {
  search: "",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

/** YYYY-MM-DD in local time — `toISOString` converts to UTC first, which
 * shifts the date near midnight and is exactly wrong for a date-only input. */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The page's starting filters: the last week of uploads, so a workspace with
 * months of history doesn't dump its entire backlog into view on first load. */
export function defaultFilters(today: Date = new Date()): DocumentFilters {
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  return {
    ...EMPTY_FILTERS,
    dateFrom: toDateInputValue(weekAgo),
    dateTo: toDateInputValue(today),
  };
}

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
