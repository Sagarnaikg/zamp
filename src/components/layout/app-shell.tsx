"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Layers } from "lucide-react";
import { A11Y, ROUTES } from "@/constants";
import { features } from "@/config/features";
import { cn } from "@/lib/utils/cn";

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
 * The reference's chrome: a soft grey page with one large rounded shell
 * floating on it, everything else nested inside.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-canvas p-3 sm:p-5">
      {/* First tab stop: lets keyboard users jump the nav on every page. */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
      >
        {A11Y.skipToContent}
      </a>

      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1600px] flex-col rounded-shell bg-shell shadow-shell sm:min-h-[calc(100vh-2.5rem)]">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5 sm:px-8">
          <Link
            href={ROUTES.home}
            className="flex items-center gap-3 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-inverse text-surface-inverse-foreground">
              <Layers className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-foreground">
                Zamp
              </span>
              <span className="block text-[13px] text-muted">Document intelligence</span>
            </span>
          </Link>

          <nav
            aria-label={A11Y.primaryNavigation}
            className="flex items-center gap-1.5 sm:ml-4"
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
        </header>

        <main
          id={MAIN_CONTENT_ID}
          className="flex-1 rounded-shell bg-canvas/40 px-3 pb-3 pt-1 sm:px-5 sm:pb-5"
        >
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
