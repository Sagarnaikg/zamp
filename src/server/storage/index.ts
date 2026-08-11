import { diskDriver } from "./disk";
import { blobDriver } from "./blob";

/**
 * Storage abstraction so the app runs anywhere (decisions.md §14). `put`
 * returns the path persisted on the document row; `get` resolves it back.
 */
export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(storagePath: string): Promise<Buffer>;
}

export function getStorage(): StorageDriver {
  return process.env.BLOB_READ_WRITE_TOKEN ? blobDriver : diskDriver;
}
