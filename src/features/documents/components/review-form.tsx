"use client";

import { useForm } from "react-hook-form";
import { Check } from "lucide-react";
import {
  CORRECTABLE_TO_EXTRACTION_FIELD,
  CorrectableField,
} from "@/server/constants";
import { ACTIONS, ButtonVariant } from "@/constants";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ConfidenceBadge } from "@/components/domain/confidence-badge";
import { REVIEW_FIELDS } from "../review-fields";
import { useCorrectFields } from "../hooks";
import type { Extraction } from "../types";

type FormValues = Record<CorrectableField, string>;

function toFormValues(extraction: Extraction): FormValues {
  const values = {} as FormValues;
  for (const { field } of REVIEW_FIELDS) {
    values[field] = extraction[field] ?? "";
  }
  return values;
}

/**
 * The correction form. Two decisions worth naming:
 *
 * Only *dirty* fields are sent. The API records an audit entry and pins
 * confidence to 1 for every field it receives (§9), so submitting untouched
 * values would forge a human verification the user never made.
 *
 * Confidence sits on the label, not in a separate column — the question
 * "should I check this number?" has to be answerable without moving the eye.
 */
export function ReviewForm({
  documentId,
  extraction,
}: {
  documentId: string;
  extraction: Extraction;
}) {
  const correct = useCorrectFields(documentId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { dirtyFields, isDirty },
  } = useForm<FormValues>({ defaultValues: toFormValues(extraction) });

  const onSubmit = handleSubmit((values) => {
    const changed: Partial<Record<CorrectableField, string | null>> = {};
    for (const field of Object.keys(dirtyFields) as CorrectableField[]) {
      const value = values[field].trim();
      changed[field] = value === "" ? null : value;
    }
    if (Object.keys(changed).length === 0) return;

    // mutate, not mutateAsync: react-hook-form re-throws whatever the submit
    // handler rejects with, which would surface as an unhandled rejection
    // rather than the inline message below.
    correct.mutate(changed, {
      // Re-baseline so the freshly saved values are no longer "dirty".
      onSuccess: (result) => reset(toFormValues(result.extraction)),
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        {REVIEW_FIELDS.map(({ field, label, numeric, placeholder }) => {
          const meta = extraction.fieldMeta[CORRECTABLE_TO_EXTRACTION_FIELD[field]];
          return (
            <Field
              key={field}
              label={label}
              placeholder={placeholder}
              inputMode={numeric ? "decimal" : undefined}
              className={numeric ? "text-right tabular-nums" : undefined}
              annotation={
                meta && <ConfidenceBadge score={meta.confidence} reasons={meta.reasons} />
              }
              {...register(field)}
            />
          );
        })}
      </div>

      <div className="mt-7 flex items-center justify-between gap-4">
        <p aria-live="polite" className="text-[13px] text-muted">
          {correct.isSuccess && !isDirty ? (
            <span className="inline-flex items-center gap-1.5 text-confidence-strong">
              <Check className="size-4" strokeWidth={2} aria-hidden />
              Saved — those fields are now marked as confirmed by you
            </span>
          ) : isDirty ? (
            "Unsaved changes"
          ) : (
            "Correct anything that looks wrong, then accept."
          )}
        </p>
        <Button
          type="submit"
          variant={ButtonVariant.Secondary}
          disabled={!isDirty}
          loading={correct.isPending}
        >
          {ACTIONS.save}
        </Button>
      </div>

      {correct.isError && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {correct.error instanceof Error
            ? correct.error.message
            : "Could not save those changes."}
        </p>
      )}
    </form>
  );
}
