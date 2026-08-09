import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./index";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function resolveSafe(key: string): string {
  const resolved = path.resolve(UPLOADS_DIR, key);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error(`Invalid storage key: ${key}`);
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
