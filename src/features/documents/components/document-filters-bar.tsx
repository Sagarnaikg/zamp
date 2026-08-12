import { X } from "lucide-react";
import { DocumentStatus } from "@/server/constants";
import { STATUS_LABELS } from "@/constants";
import { SearchInput } from "@/components/ui/search-input";
import { SelectPill, type SelectOption } from "@/components/ui/select-pill";
import type { DocumentFilters } from "../document-filters";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  ...Object.values(DocumentStatus).map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  })),
];

export function DocumentFiltersBar({
  filters,
  defaultFilters,
  onChange,
  resultCount,
}: {
  filters: DocumentFilters;
  /** What the page opened with, so "active" means "changed", not "non-empty". */
  defaultFilters: DocumentFilters;
  onChange: (filters: DocumentFilters) => void;
  /** Shown so a filter that zeroes the list reads as "no matches", not "broken". */
  resultCount: number;
}) {
  const hasActiveFilters =
    filters.search !== defaultFilters.search ||
    filters.status !== defaultFilters.status ||
    filters.dateFrom !== defaultFilters.dateFrom ||
    filters.dateTo !== defaultFilters.dateTo;

  function set<K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-48">
        <SearchInput
          label="Search by vendor or filename"
          placeholder="Search by vendor or filename…"
          value={filters.search}
          onChange={(event) => set("search", event.target.value)}
        />
      </div>

      <SelectPill
        label="Status"
        options={STATUS_OPTIONS}
        value={filters.status}
        onChange={(event) =>
          set("status", event.target.value as DocumentStatus | "all")
        }
      />

      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor="filter-date-from">
          From date
        </label>
        <input
          id="filter-date-from"
          type="date"
          value={filters.dateFrom}
          max={filters.dateTo || undefined}
          onChange={(event) => set("dateFrom", event.target.value)}
          className="h-9 rounded-full bg-surface-raised px-3.5 text-[13px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <span className="text-[13px] text-muted">to</span>
        <label className="sr-only" htmlFor="filter-date-to">
          To date
        </label>
        <input
          id="filter-date-to"
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          onChange={(event) => set("dateTo", event.target.value)}
          className="h-9 rounded-full bg-surface-raised px-3.5 text-[13px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onChange(defaultFilters)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden />
          Clear
        </button>
      )}

      {hasActiveFilters && (
        <span aria-live="polite" className="ml-auto text-[13px] text-muted">
          {resultCount} {resultCount === 1 ? "match" : "matches"}
        </span>
      )}
    </div>
  );
}
