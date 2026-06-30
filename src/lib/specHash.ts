/**
 * specHash.ts — a deterministic hash of the structured Spec.
 *
 * This is the cache key (Principle 4: never re-bill the metered render provider
 * for the same look on the same photo) and the link between a brief's requested
 * spec and the renders made for it, without a brittle FK. Same spec content →
 * same hash, regardless of object key order.
 */

import type { Spec } from "./spec";

/** Canonical, order-stable string for a spec's structured fields only. */
export function canonicalizeSpec(spec: Spec): string {
  return JSON.stringify([
    spec.sidesGuard,
    spec.fadeType,
    spec.fadeHeight,
    spec.topMethod,
    spec.topLengthMm,
    spec.topGuard ?? null,
    spec.topStyle,
    spec.topDirection,
    spec.neckline,
    spec.part,
    spec.texture,
    spec.beard?.style ?? null,
    spec.beard?.lengthMm ?? null,
  ]);
}

/** Short, low-collision hash (djb2 ⊕ sdbm) — adequate as a content cache key. */
export function specHash(spec: Spec): string {
  const s = canonicalizeSpec(spec);
  let h1 = 5381;
  let h2 = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 * 33) ^ c) >>> 0;
    h2 = (c + (h2 << 6) + (h2 << 16) - h2) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}
