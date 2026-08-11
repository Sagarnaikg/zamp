import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  body: string;
  icon?: LucideIcon;
  /** The one action that resolves the emptiness, when there is one. */
  action?: ReactNode;
}

export function EmptyState({ title, body, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card bg-surface px-6 py-20 text-center">
      {Icon && (
        <span className="mb-5 inline-flex size-14 items-center justify-center rounded-full bg-surface-raised text-muted">
          <Icon className="size-6" strokeWidth={1.5} aria-hidden />
        </span>
      )}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{body}</p>
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}
