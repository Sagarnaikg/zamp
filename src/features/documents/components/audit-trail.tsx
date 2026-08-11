"use client";

import { History } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDate, formatText } from "@/lib/utils/format";
import type { AuditLogEntry } from "../types";

/**
 * The insert-only record of human corrections (§9). Kept as its own card
 * below the review: it's history rather than current state, and it only
 * exists once someone has actually changed something.
 */
export function AuditTrail({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <Card className="mt-5 p-6 sm:p-7">
      <CardHeader icon={History} title="Your changes" />
      <ol className="mt-5 space-y-3.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="border-b border-border pb-3.5 text-[13px] last:border-0 last:pb-0"
          >
            <span className="font-medium text-foreground">{entry.field}</span>
            <span className="text-muted"> changed from </span>
            <span className="text-muted line-through">{formatText(entry.oldValue)}</span>
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
  );
}
