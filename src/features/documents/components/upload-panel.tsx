"use client";

import { useRef, useState, type DragEvent } from "react";
import { Download, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ButtonVariant,
  ERROR_STATES,
  SAMPLES,
  SAMPLE_DOCUMENTS,
  UploadStatus,
  sampleUrl,
} from "@/constants";
import { UPLOAD } from "@/server/constants";
import { cn } from "@/lib/utils/cn";
import { useUploadDocument } from "../hooks";
import { useUploadStore, type UploadItem } from "../upload-store";
import { validateUploadFile } from "../upload-schema";

/**
 * One row in the in-flight upload list. Four states, each reading as what's
 * actually happening rather than a stalled percentage:
 * queued → uploading (real byte progress) → reading (server-side, no
 * progress to report, so a spinner rather than a frozen bar) → failed
 * (the reason, and a way to dismiss it).
 */
function UploadListItem({
  item,
  onDismiss,
}: {
  item: UploadItem;
  onDismiss: () => void;
}) {
  if (item.status === UploadStatus.Failed) {
    return (
      <li className="rounded-control bg-danger/10 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">
              {item.filename}
            </p>
            <p role="alert" className="mt-0.5 text-[13px] text-danger">
              {item.error ?? ERROR_STATES.uploadFailed}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Dismiss ${item.filename}`}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </li>
    );
  }

  const reading = item.status === UploadStatus.Processing;

  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="truncate text-foreground">{item.filename}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-muted">
          {reading && <Spinner className="size-3" />}
          {reading ? "Reading…" : `${item.percent}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={item.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          reading ? `Reading ${item.filename}` : `Uploading ${item.filename}`
        }
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-raised"
      >
        <div
          className={cn(
            "h-full rounded-full bg-accent transition-[width]",
            // Nothing client-side can measure server-side reading progress,
            // so the bar pulses instead of sitting frozen at 100%.
            reading && "animate-pulse",
          )}
          style={{ width: `${item.percent}%` }}
        />
      </div>
    </li>
  );
}

/**
 * A way in for someone with no invoice of their own to hand. Each sample
 * reaches a different path through the pipeline, so the descriptions say what
 * a sample is for rather than just naming the file.
 *
 * Plain anchors with `download` — these are static files, so there's nothing
 * for the client to do beyond pointing at them.
 */
function SampleDownloads() {
  return (
    <div className="mx-auto mt-8 max-w-2xl border-t border-border pt-6">
      <p className="text-[13px] text-muted">{SAMPLES.prompt}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {SAMPLE_DOCUMENTS.map((sample) => (
          <li key={sample.filename}>
            <a
              href={sampleUrl(sample.filename)}
              download
              className="flex h-full items-start gap-2.5 rounded-control bg-surface-raised px-3.5 py-2.5 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Download
                className="mt-0.5 size-3.5 shrink-0 text-muted"
                strokeWidth={2}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-foreground">
                  {sample.label}
                </span>
                <span className="block text-[12px] leading-snug text-muted">
                  {sample.description}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const { items, enqueue, setProgress, setStatus, fail, dismiss } = useUploadStore();

  // Done items are already in the table below — showing them here too is
  // redundant. Failed items stay until dismissed: silently dropping them was
  // the bug (an upload could fail with nothing on screen to show for it).
  const active = items.filter((item) => item.status !== UploadStatus.Done);

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
        fail(id, error instanceof Error ? error.message : ERROR_STATES.uploadFailed);
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
            <UploadListItem key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </ul>
      )}

      <SampleDownloads />
    </div>
  );
}
