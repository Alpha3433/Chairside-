/**
 * angles.ts — the capture angles and their guidance copy.
 *
 * Front + both sides are the CORE set. Back is optional and honestly flagged:
 * a selfie can't reliably capture the back of the head (Principle 3 / non-goals).
 */

export const ANGLES = ["front", "left", "right", "back"] as const;
export type Angle = (typeof ANGLES)[number];

/** The required core set; "back" is optional/skippable. */
export const CORE_ANGLES: Angle[] = ["front", "left", "right"];

export function isAngle(v: unknown): v is Angle {
  return typeof v === "string" && (ANGLES as readonly string[]).includes(v);
}

export const ANGLE_LABELS: Record<Angle, string> = {
  front: "Front",
  left: "Left side",
  right: "Right side",
  back: "Back",
};

/** Short prompt shown while aligning to the silhouette for each angle. */
export const ANGLE_GUIDANCE: Record<Angle, string> = {
  front: "Face the camera straight on, eyes level, whole head in the outline.",
  left: "Show your LEFT side — turn your head ~45–90° so your left ear faces the camera.",
  right: "Show your RIGHT side — turn your head ~45–90° so your right ear faces the camera.",
  back:
    "Optional. A front selfie can't capture the back of your head — use the rear camera with a helper, or skip it.",
};

export const ANGLE_ORDER: Record<Angle, number> = { front: 0, left: 1, right: 2, back: 3 };
