"use client";

import { create } from "zustand";
import { UploadStatus } from "@/constants";

/**
 * The one piece of genuinely global client state (decisions.md §28).
 *
 * Uploads outlive the component that started them: a user drops three scans,
 * navigates to review the first, and still expects to see the other two
 * progressing. React Query owns server state and can't model in-flight local
 * files, and lifting this into a page component would lose it on navigation.
 * Everything else in the app is local `useState` or a query — no Redux, and
 * no global store for things one screen owns.
 */

export interface UploadItem {
  /** Client-generated; the server id only exists once the upload finishes. */
  id: string;
  filename: string;
  status: UploadStatus;
  percent: number;
  documentId?: string;
  error?: string;
}

interface UploadState {
  items: UploadItem[];
  enqueue: (id: string, filename: string) => void;
  setProgress: (id: string, percent: number) => void;
  setStatus: (id: string, status: UploadStatus, documentId?: string) => void;
  fail: (id: string, error: string) => void;
  clearFinished: () => void;
}

function replace(
  items: UploadItem[],
  id: string,
  patch: Partial<UploadItem>,
): UploadItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export const useUploadStore = create<UploadState>((set) => ({
  items: [],

  enqueue: (id, filename) =>
    set((state) => ({
      items: [
        ...state.items,
        { id, filename, status: UploadStatus.Queued, percent: 0 },
      ],
    })),

  setProgress: (id, percent) =>
    set((state) => ({
      items: replace(state.items, id, {
        percent,
        status: UploadStatus.Uploading,
      }),
    })),

  setStatus: (id, status, documentId) =>
    set((state) => ({ items: replace(state.items, id, { status, documentId }) })),

  fail: (id, error) =>
    set((state) => ({
      items: replace(state.items, id, { status: UploadStatus.Failed, error }),
    })),

  clearFinished: () =>
    set((state) => ({
      items: state.items.filter((item) => item.status !== UploadStatus.Done),
    })),
}));
