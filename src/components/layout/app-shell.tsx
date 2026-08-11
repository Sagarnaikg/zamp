"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Layers } from "lucide-react";
import { A11Y, ROUTES } from "@/constants";
import { features } from "@/config/features";
import { cn } from "@/lib/utils/cn";
import { ThemeToggle } from "./theme-toggle";

const MAIN_CONTENT_ID = "main-content";

interface NavItem {
  href: string;
  label: string;
  enabled: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.documents, label: "Documents", enabled: true },
  { href: ROUTES.ledger, label: "Ledger", enabled: true },
  { href: ROUTES.query, label: "Ask", enabled: features.naturalLanguageQuery },
];

/**
 * Full-bleed chrome: a header bar across the top, content below. The nav is
 * centred independently of the logo and actions — equal-width flexible
 * spacers on both sides, so it stays put rather than drifting as those grow.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      {/* First tab stop: lets keyboard users jump the nav on every page. */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
      >
        {A11Y.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-shell/85 backdrop-blur">
        <div className="flex items-center gap-4 px-5 py-3 sm:px-7">
          <div className="flex flex-1 items-center">
            <Link
              href={ROUTES.home}
              className="flex items-center gap-3 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface-inverse text-surface-inverse-foreground">
                <Layers className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[15px] font-bold tracking-tight text-foreground">
                  Zamp
                </span>
                <span className="block text-[13px] text-muted">
                  Document intelligence
                </span>
              </span>
            </Link>
          </div>

          <nav
            aria-label={A11Y.primaryNavigation}
            className="flex shrink-0 items-center gap-1.5"
          >
            {NAV_ITEMS.filter((item) => item.enabled).map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  // Tells assistive tech which page you're on, not just the styling.
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    active
                      ? "bg-surface-inverse text-surface-inverse-foreground"
                      : "text-muted hover:bg-surface-raised hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-1 items-center justify-end">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} className="flex-1 px-5 py-6 sm:px-7">
        {children}
      </main>
    </div>
  );
}
