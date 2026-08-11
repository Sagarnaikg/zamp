import { CorrectableField } from "@/server/constants";

export interface ReviewFieldSpec {
  field: CorrectableField;
  label: string;
  /** Right-aligned and tabular — the money columns. */
  numeric?: boolean;
  placeholder?: string;
}

/**
 * The correctable fields, in reading order rather than schema order: who
 * billed you, what for, and how much. Ordering is a product decision, so it
 * lives beside the feature rather than following the database.
 */
export const REVIEW_FIELDS: ReviewFieldSpec[] = [
  { field: CorrectableField.Vendor, label: "Vendor", placeholder: "Not found" },
  { field: CorrectableField.InvoiceNumber, label: "Invoice number", placeholder: "Not found" },
  { field: CorrectableField.DocDate, label: "Date", placeholder: "YYYY-MM-DD" },
  { field: CorrectableField.Category, label: "Category", placeholder: "Not found" },
  { field: CorrectableField.Currency, label: "Currency", placeholder: "e.g. USD" },
  { field: CorrectableField.Subtotal, label: "Subtotal", numeric: true, placeholder: "0.00" },
  { field: CorrectableField.Tax, label: "Tax", numeric: true, placeholder: "0.00" },
  { field: CorrectableField.Total, label: "Total", numeric: true, placeholder: "0.00" },
];
