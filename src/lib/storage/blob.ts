import { put } from "@vercel/blob";
import type { StorageDriver } from "./index";

export const blobDriver: StorageDriver = {
  async put(key, data, contentType) {
    const blob = await put(key, data, {
      access: "public",
      contentType,
      // The random suffix is the only access control without auth; the URL
      // is unguessable and only ever surfaced inside the owning workspace.
      addRandomSuffix: true,
    });
    return blob.url;
  },

  async get(storagePath) {
    const res = await fetch(storagePath);
    if (!res.ok) {
      throw new Error(`Blob fetch failed (${res.status}) for ${storagePath}`);
    }
    return Buffer.from(await res.arrayBuffer());
  },
};
