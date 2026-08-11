import { humanizeKey } from "@/lib/utils/format";
import type { ExtraField } from "@/server/db/schema";

/**
 * Everything on the document that didn't fit the fixed schema — PO numbers,
 * payment terms, tax IDs. Sits at the end of the extracted values rather than
 * in its own card, because it answers the same question as the fields above
 * it: what does this document actually say?
 *
 * Shown, never hidden: the capture net (§17) exists so nothing legible is
 * lost, and dropping it from the UI would quietly defeat that.
 */
export function ExtraFields({ fields }: { fields: ExtraField[] }) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <h3 className="text-[13px] font-semibold text-foreground">
        Other fields on the document
      </h3>
      <dl className="mt-4 space-y-3">
        {fields.map((field) => (
          <div
            key={field.key}
            className="flex items-baseline justify-between gap-6 border-b border-border pb-3 last:border-0 last:pb-0"
          >
            {/* The label as printed, so it matches what's on the page. */}
            <dt className="text-[13px] text-muted">
              {field.label || humanizeKey(field.key)}
            </dt>
            <dd className="text-right text-[13px] font-medium text-foreground">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
