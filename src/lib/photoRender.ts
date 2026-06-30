/**
 * photoRender.ts — paint a chosen style onto the client's captured photo.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Principle 1: the render is the LOOK; it never produces spec NUMBERS.      │
 * │ Data flows one way: (photo + structured Spec) ──► illustration. There is  │
 * │ no path that reads a guard size or length back out of a rendered image.   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * PLUGGABLE + FLAGGED (Principles 1 & 4): when RENDER_ENABLED and a key +
 * RENDER_PROVIDER_URL are set, we call a swappable image-to-image / hair-region
 * inpainting provider. Otherwise we return a DETERMINISTIC STUB COMPOSITE — the
 * client's own photo with a clearly-labelled overlay of the chosen spec — so the
 * flow is demoable and honest without ever faking an AI result. Callers cache by
 * (photo, specHash) so a render is billed at most once.
 */

import type { Spec } from "./spec";
import type { Angle } from "./angles";
import { ANGLE_LABELS } from "./angles";
import { isRenderEnabled, buildPrompt } from "./render";

export interface PhotoRenderInput {
  photoBytes: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  spec: Spec;
  summary: string;
  angle: Angle;
}

export interface PhotoRenderResult {
  bytes: Buffer;
  mimeType: string;
  provider: string;
  status: "done" | "stub";
}

export async function renderOnPhoto(input: PhotoRenderInput): Promise<PhotoRenderResult> {
  const providerUrl = (process.env.RENDER_PROVIDER_URL || "").trim();

  if (isRenderEnabled() && providerUrl) {
    try {
      const remote = await callProvider(providerUrl, input);
      if (remote) return remote;
    } catch {
      // Fail safe to the stub — a render outage must never break the flow.
    }
  }

  return stubComposite(input);
}

// ---------------------------------------------------------------------------
// Pluggable remote provider (seam). Vendors differ, so this posts a generic
// envelope and expects { image: <base64> } back. Swap the body/parse for your
// provider. The prompt is derived PURELY from the structured spec; a real
// integration should also pass a hair-region MASK (client-side selfie/hair
// segmentation, e.g. MediaPipe) so the model edits only the hair.
// ---------------------------------------------------------------------------
async function callProvider(
  url: string,
  input: PhotoRenderInput,
): Promise<PhotoRenderResult | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.RENDER_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      image: input.photoBytes.toString("base64"),
      mimeType: input.mimeType,
      // Text conditioning from structured params only (no image-derived spec).
      prompt: `${buildPrompt(input.spec)}, ${input.angle} view, edit only the hair region, photoreal`,
      // mask: <base64 hair mask> — wire client-side hair segmentation here.
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { image?: string; mimeType?: string };
  if (!data.image) return null;
  return {
    bytes: Buffer.from(data.image, "base64"),
    mimeType: data.mimeType || "image/png",
    provider: "remote",
    status: "done",
  };
}

// ---------------------------------------------------------------------------
// Deterministic stub composite — the client's photo + a labelled overlay.
//
// Produced as a self-contained SVG with the photo embedded as a data URI, so it
// needs no native image libraries, is cache-friendly, and renders anywhere an
// <img> does. It is OBVIOUSLY a placeholder (it doesn't restyle hair), which is
// the honest behaviour when no generative provider is wired.
// ---------------------------------------------------------------------------
function stubComposite(input: PhotoRenderInput): PhotoRenderResult {
  const w = input.width && input.width > 0 ? input.width : 810;
  const h = input.height && input.height > 0 ? input.height : 1080;
  const dataUri = `data:${input.mimeType};base64,${input.photoBytes.toString("base64")}`;
  const summaryLines = wrap(input.summary, Math.max(24, Math.floor(w / 11)), 3);
  const lineH = Math.round(h * 0.026);
  const fs = Math.round(h * 0.022);
  const pad = Math.round(w * 0.04);
  const bandH = pad * 2 + summaryLines.length * lineH + lineH;

  const summaryText = summaryLines
    .map(
      (ln, i) =>
        `<text x="${pad}" y="${h - bandH + pad + lineH + i * lineH}" font-family="${FONT}" font-size="${fs}" fill="#ffffff">${esc(
          ln,
        )}</text>`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image href="${dataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="${w}" height="${h}" fill="#1f2937" opacity="0.06"/>
  <g>
    <rect x="${pad}" y="${pad}" width="${Math.round(w * 0.62)}" height="${Math.round(
      h * 0.05,
    )}" rx="${Math.round(h * 0.012)}" fill="#000000" opacity="0.62"/>
    <text x="${pad + Math.round(w * 0.025)}" y="${pad + Math.round(h * 0.034)}" font-family="${FONT}" font-size="${Math.round(
      h * 0.02,
    )}" font-weight="700" fill="#ffffff" letter-spacing="0.5">ILLUSTRATION — NOT A GUARANTEE</text>
  </g>
  <rect x="0" y="${h - bandH}" width="${w}" height="${bandH}" fill="#000000" opacity="0.55"/>
  <text x="${pad}" y="${h - bandH + pad + Math.round(lineH * 0.2)}" font-family="${FONT}" font-size="${Math.round(
    fs * 0.8,
  )}" font-weight="700" fill="#a7f3d0" letter-spacing="0.6">${esc(
    ANGLE_LABELS[input.angle].toUpperCase(),
  )} · PREVIEW STUB</text>
  ${summaryText}
</svg>`;

  return {
    bytes: Buffer.from(svg, "utf8"),
    mimeType: "image/svg+xml",
    provider: "stub",
    status: "stub",
  };
}

const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrap(text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim();
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[.,;:]?$/, "") + "…";
    return kept;
  }
  return lines;
}
