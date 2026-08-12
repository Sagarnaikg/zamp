/**
 * Demo documents, served from `public/samples/` rather than linked off GitHub
 * so trying the product never depends on a repository staying public — and so
 * they work offline and in local development too.
 *
 * Each one exists to reach a path the others can't: a text layer, a vision-only
 * photo, a reading two models genuinely disagree about, and a card number that
 * has to be redacted before anything is sent to a provider.
 */
export interface SampleDocument {
  filename: string;
  label: string;
  /** What this sample is for — the reason to pick it over the others. */
  description: string;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    filename: "clean-digital-invoice.pdf",
    label: "Clean invoice",
    description: "Digital PDF with a text layer — the straightforward path",
  },
  {
    filename: "receipt-photo.jpg",
    label: "Receipt photo",
    description: "Phone photo, no text layer — read by vision instead",
  },
  {
    filename: "faded-scan-invoice.jpg",
    label: "Faded scan",
    description: "Ambiguous digits — two readings disagree, a tiebreak settles it",
  },
  {
    filename: "invoice-with-card-number.pdf",
    label: "Card number",
    description: "Carries a card number — redacted before any model sees it",
  },
];

export const sampleUrl = (filename: string) => `/samples/${filename}`;
