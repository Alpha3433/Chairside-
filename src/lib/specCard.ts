/**
 * specCard.ts — build a self-contained SVG of the spec sheet for EXPORT/SHARE.
 *
 * This is the brief's "exportable/shareable as an image". Critically, it is the
 * cleanest possible demonstration of Principle 3: the shareable IMAGE is
 * generated *from* the structured Spec, deterministically — the data flows
 * Spec → image, never the reverse. There is no AI and no pixel input. Same spec
 * in → byte-identical SVG out.
 *
 * Pure (no React, no DB) so it can be served from a route handler and converted
 * to PNG client-side. The head-diagram geometry mirrors components/HeadDiagram
 * via nested <svg viewBox="0 0 110 150"> blocks, so both renderers agree.
 */

import {
  type Spec,
  type HairType,
  type Density,
  LABELS,
  guardLabel,
} from "./spec";
import {
  fadeGradientStops,
  sidesColorHex,
  topColorHex,
  topZoneLabel,
  sidesZoneLabel,
} from "./diagram";
import { fadeDescriptor, generateExpectation } from "./specSummary";

export interface SpecCardInput {
  spec: Spec;
  summary: string;
  title: string;
  subtitle?: string;
  hairType?: HairType;
  density?: Density;
}

const W = 680;
const PAD = 28;
const SKIN = "#f0d9c2";
const SKIN_DARK = "#e3c3a6";
const OUTLINE = "#3a2f28";
const INK = "#1a1a1a";
const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Greedy word-wrap into at most `maxLines` lines of ~`max` characters. */
function wrap(text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= max) {
      cur = (cur + " " + w).trim();
    } else {
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

function text(
  x: number,
  y: number,
  s: string,
  opts: {
    size?: number;
    weight?: number;
    fill?: string;
    anchor?: "start" | "middle" | "end";
    upper?: boolean;
    spacing?: number;
  } = {},
): string {
  const { size = 14, weight = 400, fill = INK, anchor = "start", upper, spacing } = opts;
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${
    upper ? ' letter-spacing="0.6"' : spacing ? ` letter-spacing="${spacing}"` : ""
  }>${esc(upper ? s.toUpperCase() : s)}</text>`;
}

function topValue(spec: Spec): string {
  const style = LABELS.topStyle[spec.topStyle];
  const dir =
    spec.topDirection === "none" ? "" : `, ${LABELS.topDirection[spec.topDirection].toLowerCase()}`;
  let method = "";
  if (spec.topMethod === "scissor") method = " (scissor)";
  else if (spec.topGuard && spec.topGuard !== "scissor")
    method = ` (${guardLabel(spec.topGuard)} clipper)`;
  return `~${spec.topLengthMm}mm${method} · ${style}${dir}`;
}

function sidesValue(spec: Spec): string {
  return spec.fadeType === "none"
    ? `${guardLabel(spec.sidesGuard)} all over · no fade`
    : `${guardLabel(spec.sidesGuard)} · ${fadeDescriptor(spec)}`;
}

function beardValue(spec: Spec): string {
  if (spec.beard && spec.beard.style !== "none") {
    return `${LABELS.beardStyle[spec.beard.style]}${
      spec.beard.lengthMm != null ? ` · ~${spec.beard.lengthMm}mm` : ""
    }`;
  }
  return "None / clean";
}

// --- Head-diagram shapes (mirror components/HeadDiagram, viewBox 0 0 110 150) -

function zoneTag(x: number, y: number, s: string, anchor: "start" | "middle" | "end"): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="9" font-weight="600" fill="#1f2937" stroke="#ffffff" stroke-width="2.5" paint-order="stroke">${esc(s)}</text>`;
}

function frontShapes(gid: string, topLabel: string, sideLabel: string): string {
  return `
    <ellipse cx="20" cy="84" rx="6" ry="10" fill="${SKIN_DARK}" stroke="${OUTLINE}" stroke-width="1"/>
    <ellipse cx="90" cy="84" rx="6" ry="10" fill="${SKIN_DARK}" stroke="${OUTLINE}" stroke-width="1"/>
    <ellipse cx="55" cy="66" rx="40" ry="48" fill="url(#${gid})" stroke="${OUTLINE}" stroke-width="1.2"/>
    <ellipse cx="55" cy="82" rx="31" ry="40" fill="${SKIN}"/>
    <line x1="40" y1="78" x2="50" y2="78" stroke="${SKIN_DARK}" stroke-width="2" stroke-linecap="round"/>
    <line x1="60" y1="78" x2="70" y2="78" stroke="${SKIN_DARK}" stroke-width="2" stroke-linecap="round"/>
    ${zoneTag(55, 30, topLabel, "middle")}
    ${zoneTag(14, 68, sideLabel, "start")}
    ${zoneTag(96, 68, sideLabel, "end")}`;
}

function sideShapes(spec: Spec, gid: string, topLabel: string, sideLabel: string): string {
  const sharp = spec.neckline === "blocked";
  const napePath = sharp
    ? "M14 98 L34 98 L34 104 L14 104 z"
    : "M14 98 q12 8 22 0 q-3 8 -22 4 z";
  return `
    <ellipse cx="52" cy="64" rx="42" ry="48" fill="url(#${gid})" stroke="${OUTLINE}" stroke-width="1.2"/>
    <path d="M64 30 q26 6 26 44 q0 30 -22 40 q-6 3 -10 -2 q-4 -6 -10 -6 q-14 0 -14 -34 q0 -38 30 -42 z" fill="${SKIN}"/>
    <path d="M90 74 q6 4 0 8" fill="none" stroke="${SKIN_DARK}" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="60" cy="80" rx="6" ry="9" fill="${SKIN_DARK}" stroke="${OUTLINE}" stroke-width="1"/>
    <rect x="66" y="86" width="5" height="14" rx="2" fill="${sidesColorHex(spec)}"/>
    <path d="${napePath}" fill="${sidesColorHex(spec)}" stroke="${sharp ? OUTLINE : "none"}" stroke-width="1" opacity="${sharp ? 1 : 0.85}"/>
    ${zoneTag(48, 26, topLabel, "middle")}
    ${zoneTag(12, 92, sideLabel, "start")}`;
}

function necklineBackPath(neckline: Spec["neckline"], color: string): string {
  switch (neckline) {
    case "blocked":
      return `<rect x="20" y="100" width="70" height="10" fill="${color}" stroke="${OUTLINE}" stroke-width="1"/>`;
    case "rounded":
      return `<path d="M20 100 q35 22 70 0 z" fill="${color}" stroke="${OUTLINE}" stroke-width="1"/>`;
    case "tapered":
      return `<path d="M24 98 q31 30 62 0 q-31 8 -62 0 z" fill="${color}" opacity="0.7"/>`;
    default:
      return `<path d="M22 100 q10 8 18 4 q12 10 24 2 q10 6 20 -2 q-40 12 -62 -4 z" fill="${color}" opacity="0.85"/>`;
  }
}

function backShapes(spec: Spec, gid: string, sideLabel: string): string {
  return `
    <rect x="42" y="104" width="26" height="34" rx="6" fill="${SKIN}" stroke="${OUTLINE}" stroke-width="1"/>
    <ellipse cx="16" cy="74" rx="5" ry="10" fill="${SKIN_DARK}" stroke="${OUTLINE}" stroke-width="1"/>
    <ellipse cx="94" cy="74" rx="5" ry="10" fill="${SKIN_DARK}" stroke="${OUTLINE}" stroke-width="1"/>
    <ellipse cx="55" cy="62" rx="40" ry="50" fill="url(#${gid})" stroke="${OUTLINE}" stroke-width="1.2"/>
    ${necklineBackPath(spec.neckline, sidesColorHex(spec))}
    ${zoneTag(14, 64, sideLabel, "start")}
    ${zoneTag(96, 64, sideLabel, "end")}
    <text x="55" y="128" text-anchor="middle" font-family="${FONT}" font-size="8" fill="#4b5563">${esc(
      LABELS.neckline[spec.neckline].toLowerCase() + " neckline",
    )}</text>`;
}

function field(x: number, y: number, label: string, value: string): string {
  // Values like a long "Top" line can exceed the half-width column; wrap to a
  // second line (still inside the 60px row) rather than running off the card.
  const lines = wrap(value, 34, 2);
  let out = text(x, y, label, { size: 10, weight: 600, fill: "#9ca3af", upper: true });
  lines.forEach((ln, i) => {
    out += text(x, y + 18 + i * 16, ln, { size: 13, weight: 600, fill: INK });
  });
  return out;
}

/** Build the complete standalone SVG. Returns a full `<svg …>…</svg>` string. */
export function buildSpecCardSvg(input: SpecCardInput): string {
  const { spec, summary, title, subtitle, hairType, density } = input;
  const gid = "fade";
  const stops = fadeGradientStops(spec);
  const topLabel = topZoneLabel(spec);
  const sideLabel = sidesZoneLabel(spec);

  const parts: string[] = [];
  let y = 0;

  // Header band
  parts.push(`<rect x="0" y="0" width="${W}" height="92" fill="#f7f6f3"/>`);
  parts.push(`<rect x="0" y="91" width="${W}" height="1" fill="#ececec"/>`);
  parts.push(text(PAD, 32, "Chairside · cut spec", { size: 11, weight: 700, fill: "#9ca3af", upper: true }));
  parts.push(text(PAD, 60, title, { size: 22, weight: 700, fill: INK }));
  if (subtitle) parts.push(text(PAD, 80, subtitle, { size: 12, fill: "#6b7280" }));
  // "Authored spec" badge
  parts.push(
    `<rect x="${W - PAD - 116}" y="34" width="116" height="24" rx="12" fill="#ecfdf5" stroke="#a7f3d0"/>`,
  );
  parts.push(
    text(W - PAD - 58, 50, "Authored spec", {
      size: 10,
      weight: 700,
      fill: "#047857",
      anchor: "middle",
      upper: true,
    }),
  );
  y = 92;

  // Summary
  y += 30;
  parts.push(text(PAD, y, "Summary", { size: 10, weight: 600, fill: "#9ca3af", upper: true }));
  const sumLines = wrap(summary, 64, 3);
  y += 22;
  for (const line of sumLines) {
    parts.push(text(PAD, y, line, { size: 15, weight: 600, fill: INK }));
    y += 22;
  }
  y += 8;
  parts.push(`<rect x="${PAD}" y="${y}" width="${W - 2 * PAD}" height="1" fill="#f0f0f0"/>`);

  // Fields grid (2 columns × 3 rows)
  y += 28;
  const colX = [PAD, PAD + (W - 2 * PAD) / 2 + 8];
  const rows: Array<[string, string]> = [
    ["Sides & back", sidesValue(spec)],
    ["Top", topValue(spec)],
    ["Neckline", LABELS.neckline[spec.neckline]],
    ["Part", LABELS.part[spec.part]],
    ["Texture / finish", LABELS.texture[spec.texture]],
    ["Beard", beardValue(spec)],
  ];
  for (let i = 0; i < rows.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    parts.push(field(colX[col], y + row * 60, rows[i][0], rows[i][1]));
  }
  y += 3 * 60 + 6;

  // Hair note (optional)
  if (hairType && density) {
    const note = generateExpectation(spec, hairType, density);
    const noteLines = wrap(note, 78, 3);
    const boxH = 26 + noteLines.length * 17;
    parts.push(
      `<rect x="${PAD}" y="${y}" width="${W - 2 * PAD}" height="${boxH}" rx="10" fill="#fffbeb" stroke="#fde68a"/>`,
    );
    parts.push(
      text(PAD + 14, y + 19, `On ${LABELS.hairType[hairType].toLowerCase()}, ${LABELS.density[density].toLowerCase()} density`, {
        size: 10,
        weight: 700,
        fill: "#b45309",
        upper: true,
      }),
    );
    let ny = y + 37;
    for (const line of noteLines) {
      parts.push(text(PAD + 14, ny, line, { size: 12, fill: "#92400e" }));
      ny += 17;
    }
    y += boxH + 14;
  }

  // Diagram
  parts.push(`<rect x="${PAD}" y="${y}" width="${W - 2 * PAD}" height="1" fill="#f0f0f0"/>`);
  y += 24;
  parts.push(text(PAD, y, "Labelled diagram", { size: 10, weight: 600, fill: "#9ca3af", upper: true }));
  y += 12;
  const cellW = (W - 2 * PAD) / 3;
  const headW = 124;
  const headH = (headW / 110) * 150;
  const views: Array<[string, string]> = [
    ["Front", frontShapes(gid, topLabel, sideLabel)],
    ["Side", sideShapes(spec, gid, topLabel, sideLabel)],
    ["Back", backShapes(spec, gid, sideLabel)],
  ];
  for (let i = 0; i < views.length; i++) {
    const cx = PAD + i * cellW + (cellW - headW) / 2;
    parts.push(
      `<svg x="${cx}" y="${y}" width="${headW}" height="${headH}" viewBox="0 0 110 150">${views[i][1]}</svg>`,
    );
    parts.push(
      text(PAD + i * cellW + cellW / 2, y + headH + 14, views[i][0], {
        size: 10,
        weight: 600,
        fill: "#6b7280",
        anchor: "middle",
        upper: true,
      }),
    );
  }
  y += headH + 26;

  // Legend
  parts.push(`<rect x="${PAD}" y="${y - 4}" width="14" height="14" rx="3" fill="${sidesColorHex(spec)}" stroke="#d1d5db"/>`);
  parts.push(text(PAD + 22, y + 7, `Sides ${sidesZoneLabel(spec)}`, { size: 12, fill: "#4b5563" }));
  parts.push(`<rect x="${PAD + 150}" y="${y - 4}" width="14" height="14" rx="3" fill="${topColorHex(spec)}" stroke="#d1d5db"/>`);
  parts.push(text(PAD + 172, y + 7, `Top ${topZoneLabel(spec)}`, { size: 12, fill: "#4b5563" }));
  y += 30;

  // Footer
  parts.push(`<rect x="0" y="${y}" width="${W}" height="1" fill="#ececec"/>`);
  y += 26;
  parts.push(
    text(PAD, y, "Numbers come from structured settings — never read off a picture.", {
      size: 11,
      fill: "#9ca3af",
    }),
  );
  y += 24;

  const H = y;
  const grad = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">${stops
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
    .join("")}</linearGradient></defs>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cut spec: ${esc(
    summary,
  )}">${grad}<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>${parts.join("")}</svg>`;
}

/** A filesystem-friendly filename for a downloaded spec card. */
export function specCardFilename(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `chairside-spec-${slug || "cut"}.svg`;
}
