/**
 * specSummary.ts — DERIVE human-readable text from a structured Spec.
 *
 * Everything here is a pure function of the structured Spec (+ hair context).
 * There is no image input anywhere. This is the "plain-language summary line"
 * and the hair-grounded expectation note from the brief.
 */

import {
  type Spec,
  type HairType,
  type Density,
  LABELS,
  guardLabel,
} from "./spec";

/** "#1" / "skin" / "scissor-cut" phrasing for the sides. */
function sidesPhrase(spec: Spec): string {
  if (spec.sidesGuard === "scissor") return "scissor-cut sides";
  if (spec.sidesGuard === "skin") return "skin on the sides";
  return `${guardLabel(spec.sidesGuard)} on the sides`;
}

/**
 * Public fade descriptor for labels, e.g. "Low skin fade", "Mid fade",
 * "No fade". Capitalised for use as a field value.
 */
export function fadeDescriptor(spec: Spec): string {
  return capitalize(fadePhrase(spec));
}

/** Fade phrase, avoiding redundancy when the fade type already encodes height. */
function fadePhrase(spec: Spec): string {
  switch (spec.fadeType) {
    case "none":
      return "no fade";
    case "low":
    case "mid":
    case "high":
      // The type already names the height (e.g. "low fade").
      return `${spec.fadeType} fade`;
    case "skin":
      return `${spec.fadeHeight} skin fade`;
    case "taper":
      return `${spec.fadeHeight} taper`;
    case "burst":
      return "burst fade";
    case "drop":
      return "drop fade";
    default:
      return "fade";
  }
}

function topPhrase(spec: Spec): string {
  const style = LABELS.topStyle[spec.topStyle].toLowerCase();
  const dir =
    spec.topDirection === "none"
      ? ""
      : `, ${LABELS.topDirection[spec.topDirection].toLowerCase()}`;
  if (spec.topMethod === "scissor") {
    return `~${spec.topLengthMm}mm scissor-cut ${style}${dir} on top`;
  }
  return `~${spec.topLengthMm}mm ${style}${dir} on top`;
}

/**
 * The plain-language summary line, e.g.
 * "Low skin fade, #1 on the sides blending up, ~25mm textured swept back on
 *  top, natural neckline."
 */
export function generateSummary(spec: Spec): string {
  const parts: string[] = [];

  if (spec.fadeType === "none") {
    parts.push(`No fade, ${sidesPhrase(spec)}`);
  } else {
    parts.push(`${capitalize(fadePhrase(spec))}, ${sidesPhrase(spec)} blending up`);
  }

  parts.push(topPhrase(spec));
  parts.push(`${LABELS.neckline[spec.neckline].toLowerCase()} neckline`);

  if (spec.part !== "none") {
    parts.push(`${LABELS.part[spec.part].toLowerCase()}`);
  }

  if (spec.beard && spec.beard.style !== "none") {
    const blen =
      spec.beard.lengthMm != null ? ` (~${spec.beard.lengthMm}mm)` : "";
    parts.push(`${LABELS.beardStyle[spec.beard.style].toLowerCase()} beard${blen}`);
  }

  return capitalize(parts.join(", ")) + ".";
}

/**
 * A short, honest expectation note grounded in the client's REAL hair. This is
 * the Risk-1 defuser: it tells the client how the cut will actually sit on
 * their hair type/density, rather than implying the render is a guarantee.
 */
export function generateExpectation(
  spec: Spec,
  hairType: HairType,
  density: Density,
): string {
  const notes: string[] = [];
  const longTop = spec.topLengthMm >= 20;

  switch (hairType) {
    case "curly":
      notes.push(
        longTop
          ? `On curly hair, ~${spec.topLengthMm}mm springs up shorter and fuller than it looks laid straight — expect volume and curl pattern, not length.`
          : `On curly hair, short lengths read as tight texture; the curl pattern will define the shape.`,
      );
      break;
    case "coily":
      notes.push(
        `On coily hair, length measures shorter once it coils; expect dense, sculpted texture. Defined "length on top" needs more starting length than straight hair.`,
      );
      break;
    case "wavy":
      notes.push(
        `On wavy hair, expect some movement and a softer edge than a sleek illustration; product choice will swing it matte vs. shine.`,
      );
      break;
    case "straight":
      notes.push(
        spec.texture === "defined_curls"
          ? `Straight hair won't hold defined curls without a perm — the texture here will read as separation/movement, not curl.`
          : `Straight hair will sit closest to the illustration, though fine/sparse areas show scalp at short guards.`,
      );
      break;
  }

  if (density === "thin") {
    notes.push(
      `With thinner density, very short sides (skin/low guards) and high fades expose more scalp — a slightly longer guard keeps coverage.`,
    );
  } else if (density === "thick") {
    notes.push(
      `With thick density, the top will carry volume; if you want it to lie flatter, go shorter or ask for thinning/texturising.`,
    );
  }

  return notes.join(" ");
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
