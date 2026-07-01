/**
 * storage.ts — the storage stub for captured photos and rendered previews.
 *
 * Dev backend is the local filesystem under STORAGE_DIR (default `.uploads`,
 * gitignored, and crucially NOT under /public so nothing is statically served).
 * Bytes are reachable ONLY through the gated /api/photos and /api/renders routes
 * (Principle 5: faces are sensitive — never public). Swap this module's three
 * functions for S3/GCS in production without touching callers.
 */

import { promises as fs } from "fs";
import path from "path";

const ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(process.cwd(), ".uploads");

/** Resolve a key to an absolute path, refusing traversal out of ROOT. */
function resolveKey(key: string): string {
  const clean = key.replace(/\\/g, "/").replace(/\.\.+/g, "").replace(/^\/+/, "");
  const p = path.resolve(ROOT, clean);
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return p;
}

export async function putObject(key: string, bytes: Buffer | Uint8Array): Promise<void> {
  const p = resolveKey(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, bytes);
}

export async function getObject(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolveKey(key));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await fs.unlink(resolveKey(key));
  } catch {
    /* already gone — deletion is idempotent */
  }
}
