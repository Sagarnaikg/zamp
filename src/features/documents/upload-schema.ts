import { z } from "zod";
import { API_MESSAGES, UPLOAD } from "@/server/constants";

/**
 * Client-side upload validation, mirroring the server's rules (§7) so the
 * user hears about a 20MB file instantly instead of after uploading it. The
 * server still enforces the same limits — this is UX, not security, and the
 * shared constants are what keep the two from drifting apart.
 */
const uploadSchema = z.object({
  file: z.instanceof(File).superRefine((file, ctx) => {
    if (!UPLOAD.acceptedMimeTypes.includes(file.type as never)) {
      ctx.addIssue({
        code: "custom",
        message: API_MESSAGES.unsupportedFileType(
          file.type,
          UPLOAD.acceptedMimeTypes.join(", "),
        ),
      });
    }
    if (file.size > UPLOAD.maxBytes) {
      ctx.addIssue({
        code: "custom",
        message: API_MESSAGES.fileTooLarge(
          (file.size / 1024 / 1024).toFixed(1),
          UPLOAD.maxBytes / 1024 / 1024,
        ),
      });
    }
  }),
});

/** Validates one file, returning the first problem in the user's words. */
export function validateUploadFile(file: File): string | null {
  const result = uploadSchema.safeParse({ file });
  return result.success ? null : (result.error.issues[0]?.message ?? null);
}
