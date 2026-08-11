import { ChevronRight } from "lucide-react";
import { StaticField } from "@/components/ui/field";
import { humanizeKey } from "@/lib/utils/format";
import type { ExtraField } from "@/server/db/schema";

/**
 * Everything on the document that didn't fit the fixed schema — PO numbers,
 * payment terms, tax IDs. Collapsed by default: the capture net (§17) is
 * deliberately greedy, so this can run long, and none of it is what a
 * reviewer came to check. The count in the summary means it's still obvious
 * something is there.
 *
 * A native <details> rather than React state: it collapses without
 * JavaScript, and the keyboard and screen-reader behaviour is free.
 */
export function ExtraFields({ fields }: { fields: ExtraField[] }) {
  return (
    <details className="group mt-7">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full text-[13px] font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 text-muted transition-transform group-open:rotate-90"
          strokeWidth={2}
          aria-hidden
        />
        Other fields on the document
        <span className="font-normal text-muted">({fields.length})</span>
      </summary>

      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <StaticField
            key={field.key}
            // The label as printed, so it matches what's on the page.
            label={field.label || humanizeKey(field.key)}
            value={field.value}
          />
        ))}
      </dl>
    </details>
  );
}
