/**
 * specSerialize.ts — convert between the structured `Spec` type, the persisted
 * `StyleSpec` row, and untrusted request input.
 *
 * `parseSpec` is the GATEKEEPER that enforces the core invariant: a spec can
 * only ever be built from structured, vocabulary-validated parameters. Request
 * bodies pass through here; there is no path that turns an image into a Spec.
 */

import {
  type Spec,
  type Beard,
  GUARDS,
  FADE_TYPES,
  FADE_HEIGHTS,
  TOP_METHODS,
  TOP_STYLES,
  TOP_DIRECTIONS,
  NECKLINES,
  PARTS,
  TEXTURES,
  BEARD_STYLES,
} from "./spec";
import { generateSummary } from "./specSummary";

// ---------------------------------------------------------------------------
// Validation helpers.
// ---------------------------------------------------------------------------

function oneOf<T extends readonly string[]>(
  allowed: T,
  value: unknown,
  field: string,
): T[number] {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  throw new SpecValidationError(
    `Invalid value for "${field}": ${JSON.stringify(value)}. Allowed: ${allowed.join(", ")}`,
  );
}

function intInRange(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new SpecValidationError(
      `Invalid value for "${field}": ${JSON.stringify(value)}. Expected number in [${min}, ${max}].`,
    );
  }
  return Math.round(n);
}

export class SpecValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpecValidationError";
  }
}

// ---------------------------------------------------------------------------
// Untrusted input -> validated Spec.
// ---------------------------------------------------------------------------

export function parseSpec(input: unknown): Spec {
  if (typeof input !== "object" || input === null) {
    throw new SpecValidationError("Spec must be an object.");
  }
  const o = input as Record<string, unknown>;

  let beard: Beard | null = null;
  const beardStyle = o.beardStyle ?? (o.beard as Record<string, unknown> | undefined)?.style;
  if (beardStyle != null && beardStyle !== "none") {
    const style = oneOf(BEARD_STYLES, beardStyle, "beard.style");
    const rawLen =
      o.beardLengthMm ?? (o.beard as Record<string, unknown> | undefined)?.lengthMm;
    beard = {
      style,
      lengthMm: rawLen == null || rawLen === "" ? null : intInRange(rawLen, "beard.lengthMm", 0, 60),
    };
  }

  const topMethod = oneOf(TOP_METHODS, o.topMethod, "topMethod");
  const topGuardRaw = o.topGuard;
  const topGuard =
    topGuardRaw == null || topGuardRaw === ""
      ? null
      : oneOf(GUARDS, topGuardRaw, "topGuard");

  return {
    sidesGuard: oneOf(GUARDS, o.sidesGuard, "sidesGuard"),
    fadeType: oneOf(FADE_TYPES, o.fadeType, "fadeType"),
    fadeHeight: oneOf(FADE_HEIGHTS, o.fadeHeight, "fadeHeight"),
    topMethod,
    topLengthMm: intInRange(o.topLengthMm, "topLengthMm", 0, 120),
    topGuard,
    topStyle: oneOf(TOP_STYLES, o.topStyle, "topStyle"),
    topDirection: oneOf(TOP_DIRECTIONS, o.topDirection, "topDirection"),
    neckline: oneOf(NECKLINES, o.neckline, "neckline"),
    part: oneOf(PARTS, o.part, "part"),
    texture: oneOf(TEXTURES, o.texture, "texture"),
    beard,
  };
}

/** Parse the JSON authored spec stored on a BaseStyle. */
export function parseSpecJson(json: string): Spec {
  return parseSpec(JSON.parse(json));
}

// ---------------------------------------------------------------------------
// Spec -> persisted columns. summaryText is DERIVED here, every time.
// ---------------------------------------------------------------------------

export interface StyleSpecCreateData {
  baseStyleId: string | null;
  sidesGuard: string;
  fadeType: string;
  fadeHeight: string;
  topMethod: string;
  topLengthMm: number;
  topGuard: string | null;
  topStyle: string;
  topDirection: string;
  neckline: string;
  part: string;
  texture: string;
  beardStyle: string | null;
  beardLengthMm: number | null;
  summaryText: string;
  renderUrl: string | null;
}

export function specToCreateData(
  spec: Spec,
  opts: { baseStyleId?: string | null; renderUrl?: string | null } = {},
): StyleSpecCreateData {
  return {
    baseStyleId: opts.baseStyleId ?? null,
    sidesGuard: spec.sidesGuard,
    fadeType: spec.fadeType,
    fadeHeight: spec.fadeHeight,
    topMethod: spec.topMethod,
    topLengthMm: spec.topLengthMm,
    topGuard: spec.topGuard,
    topStyle: spec.topStyle,
    topDirection: spec.topDirection,
    neckline: spec.neckline,
    part: spec.part,
    texture: spec.texture,
    beardStyle: spec.beard ? spec.beard.style : null,
    beardLengthMm: spec.beard ? spec.beard.lengthMm : null,
    // Derived, never supplied by the client.
    summaryText: generateSummary(spec),
    renderUrl: opts.renderUrl ?? null,
  };
}

// ---------------------------------------------------------------------------
// Persisted row -> Spec. Re-validates on the way out so a hand-edited DB can't
// smuggle an out-of-vocab value into the app.
// ---------------------------------------------------------------------------

// Minimal shape of a StyleSpec row (avoids importing Prisma types into shared lib).
export interface StyleSpecRowLike {
  sidesGuard: string;
  fadeType: string;
  fadeHeight: string;
  topMethod: string;
  topLengthMm: number;
  topGuard: string | null;
  topStyle: string;
  topDirection: string;
  neckline: string;
  part: string;
  texture: string;
  beardStyle: string | null;
  beardLengthMm: number | null;
}

export function rowToSpec(row: StyleSpecRowLike): Spec {
  return parseSpec({
    sidesGuard: row.sidesGuard,
    fadeType: row.fadeType,
    fadeHeight: row.fadeHeight,
    topMethod: row.topMethod,
    topLengthMm: row.topLengthMm,
    topGuard: row.topGuard,
    topStyle: row.topStyle,
    topDirection: row.topDirection,
    neckline: row.neckline,
    part: row.part,
    texture: row.texture,
    beardStyle: row.beardStyle,
    beardLengthMm: row.beardLengthMm,
  });
}
