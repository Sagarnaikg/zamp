import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { API_MESSAGES, UPLOADS_DIRECTORY } from "@/server/constants";
import type { StorageDriver } from "./index";

// Disk storage is local-dev only — production filesystems on serverless
// platforms are read-only outside /tmp. Ignored here rather than fixed
// structurally, since the dynamic key below is what triggers the trace.
const UPLOADS_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), UPLOADS_DIRECTORY);

function resolveSafe(key: string): string {
  const resolved = path.resolve(/* turbopackIgnore: true */ UPLOADS_DIR, key);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error(API_MESSAGES.invalidStorageKey(key));
  }
  return resolved;
}

export const diskDriver: StorageDriver = {
  async put(key, data) {
    const filePath = resolveSafe(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return key;
  },

  async get(storagePath) {
    return readFile(resolveSafe(storagePath));
  },
};
