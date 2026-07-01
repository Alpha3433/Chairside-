/**
 * platforms.ts — known booking platforms and their HONEST tier.
 *
 * Tier reflects what each platform actually allows, not marketing:
 *   1 = deep (OAuth + webhooks + attach-back)  → Square
 *   2 = trigger (a Zapier/Make "new appointment" → our inbound webhook)
 *   3 = universal fallback (static desk QR; closed platforms + walk-ins)
 *
 * Booksy and Fresha have no open public API / third-party webhooks, so they are
 * Tier 3 by default and Tier 2 ONLY if the shop can produce a trigger. We never
 * fabricate a deep API for them. If Booksy ever grants partner API access, a
 * deep adapter slots into the same BookingAdapter interface — the seam is here.
 */

export interface PlatformMeta {
  id: string;
  label: string;
  tier: 1 | 2 | 3;
  attachBack: boolean;
  note: string;
}

export const PLATFORMS: Record<string, PlatformMeta> = {
  square: {
    id: "square",
    label: "Square",
    tier: 1,
    attachBack: true,
    note: "OAuth + booking webhooks; the brief attaches back to the appointment.",
  },
  gettimely: {
    id: "gettimely",
    label: "Gettimely",
    tier: 2,
    attachBack: false,
    note: "No public API — connect via a Zapier trigger.",
  },
  booksy: {
    id: "booksy",
    label: "Booksy",
    tier: 3,
    attachBack: false,
    note:
      "No open public API / webhooks for third parties. Desk QR by default; or Tier 2 if you can wire a Zapier/Make 'new appointment' trigger (send platform=booksy).",
  },
  fresha: {
    id: "fresha",
    label: "Fresha",
    tier: 3,
    attachBack: false,
    note: "Closed platform — desk QR.",
  },
  zapier: { id: "zapier", label: "Zapier", tier: 2, attachBack: false, note: "Generic inbound webhook." },
  fallback: { id: "fallback", label: "desk QR", tier: 3, attachBack: false, note: "Walk-ins / closed platforms." },
  walk_in: { id: "walk_in", label: "walk-in", tier: 3, attachBack: false, note: "Fresh profile." },
};

export function platformLabel(id: string): string {
  return PLATFORMS[id]?.label ?? id;
}

/** Platforms that can deliver bookings through the generic (Zapier-style) inbound webhook. */
export const TRIGGER_PLATFORMS = ["zapier", "booksy", "gettimely", "other"] as const;

export function isTriggerPlatform(p: string): boolean {
  return (TRIGGER_PLATFORMS as readonly string[]).includes(p);
}
