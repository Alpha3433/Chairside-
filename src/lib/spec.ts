/**
 * spec.ts — the single source of truth for a haircut spec.
 *
 * CORE INVARIANT (Principle 3 of the brief):
 *   Spec numbers are AUTHORED from structured data, never inferred from pixels.
 *   Every field below is a structured parameter. The plain-language summary, the
 *   SVG head diagram, and the exportable spec-card image are all *derived
 *   deterministically* from these fields. The optional AI render (lib/render.ts)
 *   consumes this spec but can NEVER feed back into it — there is intentionally
 *   no image -> spec code path anywhere in the codebase.
 *
 * This module is environment-agnostic (no DB, no React) so it can be imported by
 * the Prisma seed, server routes, client components, and the SVG image builder.
 */

// ---------------------------------------------------------------------------
// Controlled vocabularies — the only legal values a client/barber can pick.
// ---------------------------------------------------------------------------

export const HAIR_TYPES = ["straight", "wavy", "curly", "coily"] as const;
export type HairType = (typeof HAIR_TYPES)[number];

export const DENSITIES = ["thin", "medium", "thick"] as const;
export type Density = (typeof DENSITIES)[number];

export const FACE_SHAPES = [
  "oval",
  "round",
  "square",
  "oblong",
  "heart",
  "diamond",
  "triangle",
  "unsure",
] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];

/**
 * Clipper guard. Integers 0–8 are standard plastic guards; "skin" means no
 * guard (bald clipper / zero); "scissor" means the section is cut with shears,
 * not clippers, so a guard number does not apply.
 */
export const GUARDS = [
  "skin",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "scissor",
] as const;
export type Guard = (typeof GUARDS)[number];

export const FADE_TYPES = [
  "none",
  "low",
  "mid",
  "high",
  "skin",
  "taper",
  "burst",
  "drop",
] as const;
export type FadeType = (typeof FADE_TYPES)[number];

/** Where on the head the fade line sits. Only meaningful when fadeType !== "none". */
export const FADE_HEIGHTS = ["low", "mid", "high"] as const;
export type FadeHeight = (typeof FADE_HEIGHTS)[number];

export const TOP_METHODS = ["clipper", "scissor"] as const;
export type TopMethod = (typeof TOP_METHODS)[number];

export const TOP_STYLES = [
  "buzz",
  "crop",
  "textured",
  "swept_back",
  "quiff",
  "pompadour",
  "slick_back",
  "spiky",
  "natural",
  "curls",
  "fringe",
] as const;
export type TopStyle = (typeof TOP_STYLES)[number];

export const TOP_DIRECTIONS = [
  "none",
  "forward",
  "swept_back",
  "to_the_side",
  "up_and_textured",
] as const;
export type TopDirection = (typeof TOP_DIRECTIONS)[number];

export const NECKLINES = ["blocked", "rounded", "tapered", "natural"] as const;
export type Neckline = (typeof NECKLINES)[number];

export const PARTS = ["none", "natural", "hard"] as const;
export type Part = (typeof PARTS)[number];

export const TEXTURES = [
  "natural",
  "textured_matte",
  "textured_shine",
  "sleek",
  "messy",
  "defined_curls",
] as const;
export type Texture = (typeof TEXTURES)[number];

export const BEARD_STYLES = [
  "none",
  "stubble",
  "short_boxed",
  "medium_boxed",
  "full",
  "goatee",
  "line_up_only",
] as const;
export type BeardStyle = (typeof BEARD_STYLES)[number];

export const USE_CASE_TAGS = [
  "new_barber",
  "big_change",
  "specific_complex_style",
  "walk_in_to_regular",
] as const;
export type UseCaseTag = (typeof USE_CASE_TAGS)[number];

export const BRIEF_STATUSES = [
  "submitted",
  "seen",
  "counter_proposed",
  "completed",
] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

// ---------------------------------------------------------------------------
// The Spec — a fully structured description of a cut.
// ---------------------------------------------------------------------------

export interface Beard {
  style: BeardStyle;
  /** Authored length in mm for clipper-defined beards; null for scissor/line-up. */
  lengthMm: number | null;
}

export interface Spec {
  // Sides & back
  sidesGuard: Guard;
  fadeType: FadeType;
  fadeHeight: FadeHeight;

  // Top
  topMethod: TopMethod;
  /** Authored length in mm — the number a barber actually works to. */
  topLengthMm: number;
  /** Optional guard equivalent when topMethod === "clipper". */
  topGuard: Guard | null;
  topStyle: TopStyle;
  topDirection: TopDirection;

  // Finishing
  neckline: Neckline;
  part: Part;
  texture: Texture;

  // Beard (optional)
  beard: Beard | null;
}

// ---------------------------------------------------------------------------
// Guard <-> millimetre conversion.
//
// Standard plastic clipper guards in millimetres. These are the conventional
// Wahl/Andis lengths. They are part of the authored, structured data — the
// diagram, summary, and image read mm from here, never from a picture.
// ---------------------------------------------------------------------------

export const GUARD_MM: Record<Guard, number> = {
  skin: 0,
  "0": 1.5,
  "1": 3,
  "2": 6,
  "3": 10,
  "4": 13,
  "5": 16,
  "6": 19,
  "7": 22,
  "8": 25,
  scissor: 0, // not clipper-defined; length lives in topLengthMm instead
};

export function guardToMm(guard: Guard): number {
  return GUARD_MM[guard];
}

/** Human label for a guard, e.g. "#1", "skin", "scissor". */
export function guardLabel(guard: Guard): string {
  if (guard === "skin") return "skin";
  if (guard === "scissor") return "scissor";
  return `#${guard}`;
}

// ---------------------------------------------------------------------------
// Display label maps — keep UI copy consistent everywhere the vocab appears.
// ---------------------------------------------------------------------------

export const LABELS = {
  hairType: {
    straight: "Straight",
    wavy: "Wavy",
    curly: "Curly",
    coily: "Coily",
  } satisfies Record<HairType, string>,
  density: {
    thin: "Thin",
    medium: "Medium",
    thick: "Thick",
  } satisfies Record<Density, string>,
  faceShape: {
    oval: "Oval",
    round: "Round",
    square: "Square",
    oblong: "Oblong",
    heart: "Heart",
    diamond: "Diamond",
    triangle: "Triangle",
    unsure: "Not sure",
  } satisfies Record<FaceShape, string>,
  fadeType: {
    none: "No fade",
    low: "Low fade",
    mid: "Mid fade",
    high: "High fade",
    skin: "Skin fade",
    taper: "Taper",
    burst: "Burst fade",
    drop: "Drop fade",
  } satisfies Record<FadeType, string>,
  fadeHeight: {
    low: "Low",
    mid: "Mid",
    high: "High",
  } satisfies Record<FadeHeight, string>,
  topMethod: {
    clipper: "Clipper",
    scissor: "Scissor",
  } satisfies Record<TopMethod, string>,
  topStyle: {
    buzz: "Buzz",
    crop: "Crop",
    textured: "Textured",
    swept_back: "Swept back",
    quiff: "Quiff",
    pompadour: "Pompadour",
    slick_back: "Slick back",
    spiky: "Spiky",
    natural: "Natural",
    curls: "Curls",
    fringe: "Fringe",
  } satisfies Record<TopStyle, string>,
  topDirection: {
    none: "—",
    forward: "Forward",
    swept_back: "Swept back",
    to_the_side: "To the side",
    up_and_textured: "Up & textured",
  } satisfies Record<TopDirection, string>,
  neckline: {
    blocked: "Blocked",
    rounded: "Rounded",
    tapered: "Tapered",
    natural: "Natural",
  } satisfies Record<Neckline, string>,
  part: {
    none: "None",
    natural: "Natural",
    hard: "Hard part",
  } satisfies Record<Part, string>,
  texture: {
    natural: "Natural",
    textured_matte: "Textured, matte",
    textured_shine: "Textured, shine",
    sleek: "Sleek",
    messy: "Messy",
    defined_curls: "Defined curls",
  } satisfies Record<Texture, string>,
  beardStyle: {
    none: "None",
    stubble: "Stubble",
    short_boxed: "Short boxed",
    medium_boxed: "Medium boxed",
    full: "Full",
    goatee: "Goatee",
    line_up_only: "Line-up only",
  } satisfies Record<BeardStyle, string>,
  useCaseTag: {
    new_barber: "New barber",
    big_change: "Big change",
    specific_complex_style: "Specific / complex style",
    walk_in_to_regular: "Walk-in → regular",
  } satisfies Record<UseCaseTag, string>,
  briefStatus: {
    submitted: "Submitted",
    seen: "Seen",
    counter_proposed: "Counter-proposed",
    completed: "Completed",
  } satisfies Record<BriefStatus, string>,
} as const;

// ---------------------------------------------------------------------------
// A sensible neutral default, used as the base when nothing else is selected.
// ---------------------------------------------------------------------------

export const DEFAULT_SPEC: Spec = {
  sidesGuard: "1",
  fadeType: "low",
  fadeHeight: "low",
  topMethod: "clipper",
  topLengthMm: 25,
  topGuard: "8",
  topStyle: "textured",
  topDirection: "swept_back",
  neckline: "natural",
  part: "none",
  texture: "textured_matte",
  beard: null,
};
