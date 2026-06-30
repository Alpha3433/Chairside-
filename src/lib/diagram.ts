/**
 * diagram.ts — pure helpers for the deterministic head diagram.
 *
 * Every value here is a function of the structured Spec. The diagram (both the
 * React HeadDiagram and the standalone exportable SVG in lib/specCard.ts) is
 * drawn from these numbers, NOT from any image. Same spec in → same diagram out,
 * always.
 */

import {
  type Spec,
  type Guard,
  type FadeHeight,
  type FadeType,
  GUARD_MM,
  guardToMm,
  guardLabel,
} from "./spec";

/**
 * Guard → hex, light (short/skin) to dark (long). Kept in lockstep with the
 * `guard` palette in tailwind.config.ts so the diagram and the legend agree.
 */
export const GUARD_HEX: Record<Guard, string> = {
  skin: "#f6d7b0",
  "0": "#e9b384",
  "1": "#caa472",
  "2": "#a9885c",
  "3": "#8a6f49",
  "4": "#6f5a3b",
  "5": "#574730",
  "6": "#433627",
  "7": "#33291e",
  "8": "#241d15",
  scissor: "#2b2b2b",
};

/** Nearest guard colour for an arbitrary mm length (used for the top zone). */
export function mmToColor(mm: number): string {
  let best: Guard = "skin";
  let bestDelta = Infinity;
  (Object.keys(GUARD_MM) as Guard[]).forEach((g) => {
    if (g === "scissor") return;
    const delta = Math.abs(GUARD_MM[g] - mm);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = g;
    }
  });
  // Lengths well beyond #8 (25mm) read as the darkest tone.
  if (mm > 28) return GUARD_HEX["8"];
  return GUARD_HEX[best];
}

export function sidesColorHex(spec: Spec): string {
  return GUARD_HEX[spec.sidesGuard];
}

export function topColorHex(spec: Spec): string {
  if (spec.topMethod === "clipper" && spec.topGuard) {
    return GUARD_HEX[spec.topGuard];
  }
  return mmToColor(spec.topLengthMm);
}

/**
 * Fraction of head height (from the bottom) that the SHORT side colour reaches.
 * Higher fade → short hair climbs further up the head.
 */
export function fadeReach(fadeType: FadeType, fadeHeight: FadeHeight): number {
  if (fadeType === "none") return 0.16; // sides nearly uniform, blend only near crown
  const base: Record<FadeHeight, number> = { low: 0.3, mid: 0.45, high: 0.62 };
  return base[fadeHeight];
}

/** Width of the blend band, as a fraction of head height. */
export function fadeBand(fadeType: FadeType): number {
  switch (fadeType) {
    case "none":
      return 0.06;
    case "taper":
      return 0.08;
    case "skin":
    case "high":
      return 0.18;
    case "burst":
    case "drop":
      return 0.16;
    default:
      return 0.13;
  }
}

/**
 * Gradient stops (offset 0 = top of head, 1 = bottom) for a vertical fade from
 * the top colour down to the sides colour. Returned as ready-to-render stops.
 */
export interface GradientStop {
  offset: number;
  color: string;
}

export function fadeGradientStops(spec: Spec): GradientStop[] {
  const reach = fadeReach(spec.fadeType, spec.fadeHeight);
  const band = fadeBand(spec.fadeType);
  const top = topColorHex(spec);
  const sides = sidesColorHex(spec);

  const sideStart = clamp01(1 - reach - band / 2); // where blend begins (upper)
  const sideFull = clamp01(1 - reach + band / 2); // where it's fully sides colour

  return [
    { offset: 0, color: top },
    { offset: sideStart, color: top },
    { offset: sideFull, color: sides },
    { offset: 1, color: sides },
  ];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Short top-zone label, e.g. "~25mm (#8)" or "~40mm". */
export function topZoneLabel(spec: Spec): string {
  if (spec.topMethod === "clipper" && spec.topGuard && spec.topGuard !== "scissor") {
    return `~${spec.topLengthMm}mm (${guardLabel(spec.topGuard)})`;
  }
  return `~${spec.topLengthMm}mm`;
}

export function sidesZoneLabel(spec: Spec): string {
  if (spec.sidesGuard === "skin") return "skin";
  if (spec.sidesGuard === "scissor") return "scissor";
  return `#${spec.sidesGuard}`;
}

export { guardToMm };
