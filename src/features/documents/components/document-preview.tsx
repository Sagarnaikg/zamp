"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { API_ROUTES } from "@/constants";
import { MimeType } from "@/server/constants";
import { Skeleton } from "@/components/ui/skeleton";

export interface DocumentPreviewProps {
  documentId: string;
  filename: string;
  mimeType: string;
}

/**
 * The original document, beside the values read out of it — the whole point of
 * the review screen is that a user can check one against the other without
 * leaving the page or trusting their memory.
 *
 * PDFs go in an `<iframe>` rather than an `<object>`: both hand off to the
 * browser's PDF viewer, but only the iframe reliably fires `load`, and without
 * that the loading skeleton never clears. Images render directly. Both come
 * from the same-origin file route, which enforces workspace scoping (§10).
 */
export function DocumentPreview({
  documentId,
  filename,
  mimeType,
}: DocumentPreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const source = API_ROUTES.documentFile(documentId);
  const isPdf = mimeType === MimeType.Pdf;

  return (
    <div className="space-y-3">
      <div className="relative h-[70vh] min-h-125 overflow-hidden rounded-panel bg-surface-raised">
        {isPdf ? (
          <iframe
            src={source}
            title={`Preview of ${filename}`}
            className="size-full border-0"
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <img
            src={source}
            alt={`Scan of ${filename}`}
            className="size-full object-contain"
            onLoad={() => setLoaded(true)}
          />
        )}

        {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      </div>

      {/* Always available — some browsers refuse to render PDFs inline at all. */}
      <a
        href={source}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full text-[13px] text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden />
        Open original in a new tab
      </a>
    </div>
  );
}
