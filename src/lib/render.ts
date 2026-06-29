/**
 * render.ts — the OPTIONAL, feature-flagged illustrative render.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ HARD ARCHITECTURAL FENCE (Principle 3 of the brief).                      │
 * │                                                                           │
 * │ This module takes a Spec and returns an IMAGE URL. Data flows ONE WAY:    │
 * │     Spec  ──►  image                                                      │
 * │ There is intentionally NO function here that takes an image and returns   │
 * │ any spec field. The render is illustrative only and is always labelled    │
 * │ as such in the UI. If you are ever tempted to "read the guard size back   │
 * │ from the render", stop — that is the exact failure mode this product is   │
 * │ built to avoid.                                                           │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * When RENDER_ENABLED !== "true" (the default) or no API key is configured,
 * this returns null and the UI shows a labelled placeholder. Wiring a real
 * image API here is the only change needed to switch the illustration on.
 */

import type { Spec } from "./spec";

export function isRenderEnabled(): boolean {
  return process.env.RENDER_ENABLED === "true" && !!process.env.RENDER_API_KEY;
}

/**
 * Produce an illustrative image URL for a spec, or null when rendering is off.
 *
 * @returns image URL (string) or null. NEVER returns spec data.
 */
export async function renderIllustration(spec: Spec): Promise<string | null> {
  if (!isRenderEnabled()) return null;

  // --- Integration seam -----------------------------------------------------
  // Build a prompt from the STRUCTURED spec and call your image API here. The
  // result must be treated as decoration only — never parsed back into fields.
  //
  //   const prompt = buildPrompt(spec); // text from structured params only
  //   const res = await fetch("https://your-image-api/...", { ... });
  //   return (await res.json()).imageUrl;
  //
  // Until a real API is wired, fail safe to the placeholder.
  void spec;
  return null;
}

/** A short, human prompt derived purely from structured params (no image in). */
export function buildPrompt(spec: Spec): string {
  return [
    `${spec.fadeType} fade`,
    `sides guard ${spec.sidesGuard}`,
    `top ~${spec.topLengthMm}mm ${spec.topStyle}`,
    `${spec.neckline} neckline`,
    spec.beard && spec.beard.style !== "none" ? `${spec.beard.style} beard` : "clean shave",
    "barbershop reference illustration, front view, neutral background",
  ].join(", ");
}
