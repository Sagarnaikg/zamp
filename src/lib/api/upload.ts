import { env } from "@/config/env";
import { apiErrorFromResponse, networkError } from "./errors";

/**
 * Uploads go through XMLHttpRequest rather than `fetch` for one reason:
 * fetch cannot report upload progress. A finance user dropping a 10MB scan
 * needs to see it moving, so the older API earns its place here.
 */
export function uploadWithProgress<T>(
  path: string,
  file: File,
  handlers: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {},
): Promise<T> {
  const { onProgress, signal } = handlers;

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.open("POST", `${env.apiBaseUrl}${path}`);
    xhr.withCredentials = true;

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      let parsed: unknown = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = xhr.responseText;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as T);
        return;
      }
      reject(apiErrorFromResponse(xhr.status, parsed));
    });

    xhr.addEventListener("error", () => reject(networkError()));
    xhr.addEventListener("abort", () =>
      reject(new DOMException("Upload aborted", "AbortError")),
    );

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(formData);
  });
}
