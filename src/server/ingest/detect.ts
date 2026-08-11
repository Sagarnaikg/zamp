import { FileKind, MimeType } from "@/server/constants";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * A digital PDF has a usable text layer and routes to a cheap text model; a
 * scan does not and needs vision (decisions.md §3, §6). The threshold is
 * low on purpose — even sparse invoices clear it, scans don't.
 */
const TEXT_LAYER_THRESHOLD = 100;

export async function detectFileKind(
  data: Buffer,
  mimeType: string,
): Promise<{ kind: FileKind; text?: string }> {
  if (mimeType !== MimeType.Pdf) {
    return { kind: FileKind.Image };
  }
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  const trimmed = text.trim();
  if (trimmed.length >= TEXT_LAYER_THRESHOLD) {
    return { kind: FileKind.DigitalPdf, text: trimmed };
  }
  return { kind: FileKind.ScannedPdf };
}
