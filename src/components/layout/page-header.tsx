import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
}

/** Breadcrumb, display title, actions pushed right — the reference's page head. */
export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-6 pt-4">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1 rounded-full text-[13px] text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="truncate text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}
