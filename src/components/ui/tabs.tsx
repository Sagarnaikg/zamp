"use client";

import { useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface TabSpec<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Small count or status shown after the label. */
  badge?: ReactNode;
}

export interface TabsProps<T extends string> {
  tabs: TabSpec<T>[];
  active: T;
  onChange: (value: T) => void;
  /** Ties each tab to its panel for assistive tech; must be unique per page. */
  idPrefix: string;
}

/**
 * Tablist following the WAI-ARIA pattern: arrows move between tabs, Home/End
 * jump to the ends, and only the active tab is in the page's tab order — so
 * Tab moves out to the panel rather than through every tab in turn.
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  function focusTab(index: number) {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']");
    const target = buttons?.[index];
    if (!target) return;
    target.focus();
    onChange(tabs[index].value);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const current = tabs.findIndex((tab) => tab.value === active);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab((current + 1) % tabs.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab((current - 1 + tabs.length) % tabs.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-0.5 rounded-full bg-surface-raised p-0.5"
    >
      {tabs.map((tab) => {
        const selected = tab.value === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            role="tab"
            id={`${idPrefix}-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.value}`}
            // Roving tabindex: the tablist is one stop, arrows move within it.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium",
              "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              "focus-visible:outline-accent",
              selected
                ? "bg-surface text-foreground shadow-card"
                : "text-muted hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />}
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel<T extends string>({
  value,
  active,
  idPrefix,
  children,
}: {
  value: T;
  active: T;
  idPrefix: string;
  children: ReactNode;
}) {
  if (value !== active) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      tabIndex={0}
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </div>
  );
}
