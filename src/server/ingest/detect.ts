import { extractText, getDocumentProxy } from "unpdf";

export type FileKind = "digital_pdf" | "scanned_pdf" | "image";

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * A digital-native PDF has a usable text layer and routes to a cheap text
 * model; a scan does not and needs vision (decisions.md §3, §6). The
 * threshold is deliberately low — even sparse invoices have well over 100
 * characters of real text, while scans yield nothing or OCR noise.
 */
const TEXT_LAYER_THRESHOLD = 100;

export async function detectFileKind(
  data: Buffer,
  mimeType: string,
): Promise<{ kind: FileKind; text?: string }> {
  if (mimeType !== "application/pdf") {
    return { kind: "image" };
  }
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  const trimmed = text.trim();
  if (trimmed.length >= TEXT_LAYER_THRESHOLD) {
    return { kind: "digital_pdf", text: trimmed };
  }
  return { kind: "scanned_pdf" };
}
