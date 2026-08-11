"use client";

import { useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonVariant, UploadStatus } from "@/constants";
import { UPLOAD } from "@/server/constants";
import { cn } from "@/lib/utils/cn";
import { useUploadDocument } from "../hooks";
import { useUploadStore } from "../upload-store";
import { validateUploadFile } from "../upload-schema";

/**
 * Drop target plus a real file input. The input is the accessible path — a
 * div with drag handlers is unreachable by keyboard — and dropping is the
 * convenience layered on top.
 *
 * Progress is tracked per file in the upload store so it survives navigating
 * away mid-upload (§28).
 */
export function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const upload = useUploadDocument();
  const { items, enqueue, setProgress, setStatus, fail } = useUploadStore();

  const active = items.filter(
    (item) => item.status !== UploadStatus.Done && item.status !== UploadStatus.Failed,
  );

  async function send(files: FileList | null) {
    if (!files || files.length === 0) return;
    setRejected(null);

    for (const file of Array.from(files)) {
      const problem = validateUploadFile(file);
      if (problem) {
        setRejected(problem);
        continue;
      }

      const id = crypto.randomUUID();
      enqueue(id, file.name);
      try {
        const result = await upload.mutateAsync({
          file,
          onProgress: (percent) => setProgress(id, percent),
        });
        setStatus(id, UploadStatus.Done, result.document.id);
      } catch (error) {
        fail(id, error instanceof Error ? error.message : "Upload failed");
      }
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void send(event.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "rounded-card border border-dashed bg-surface px-6 py-12 text-center transition-colors",
        dragging ? "border-accent bg-surface-raised" : "border-border-strong",
      )}
    >
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-raised text-foreground">
        <UploadCloud className="size-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="mt-5 text-base font-semibold text-foreground">
        Drop an invoice or receipt
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        PDF, JPEG, PNG or WebP · up to {UPLOAD.maxBytes / 1024 / 1024}MB
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD.acceptedMimeTypes.join(",")}
        className="sr-only"
        onChange={(event) => {
          void send(event.target.files);
          // Lets the same file be picked twice in a row.
          event.target.value = "";
        }}
      />
      <Button
        variant={ButtonVariant.Primary}
        className="mt-6"
        onClick={() => inputRef.current?.click()}
      >
        Choose a file
      </Button>

      {rejected && (
        <p role="alert" className="mt-4 text-[13px] text-danger">
          {rejected}
        </p>
      )}

      {active.length > 0 && (
        <ul className="mx-auto mt-7 max-w-md space-y-3 text-left">
          {active.map((item) => (
            <li key={item.id}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-foreground">{item.filename}</span>
                <span className="shrink-0 text-muted">
                  {item.status === UploadStatus.Uploading
                    ? `${item.percent}%`
                    : "Reading…"}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={item.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Uploading ${item.filename}`}
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-raised"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
