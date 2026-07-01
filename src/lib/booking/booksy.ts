/**
 * booking/booksy.ts — Booksy adapter.
 *
 * Booksy does NOT offer an open public API or third-party webhooks (access is
 * partner-gated), so there is honestly no deep tier here — building one would be
 * fabricating an API. Booksy reaches us either as a Tier-2 trigger (a shop's
 * Zapier/Make "new appointment" Zap → our inbound webhook with platform=booksy)
 * or via the Tier-3 desk QR. No attach/list: we can't write back into Booksy.
 *
 * If Booksy grants partner API access, a deep adapter implements the same
 * BookingAdapter interface (read booking/customer + attachLink) and registers
 * here — nothing else changes.
 */

import type { BookingAdapter } from "./types";

export const BooksyAdapter: BookingAdapter = {
  platform: "booksy",
  // "Configured" means the trigger path is available (a shared webhook secret is
  // set so a Booksy Zap can post to us). No deep credentials exist for Booksy.
  isConfigured: () => !!process.env.ZAPIER_WEBHOOK_SECRET,
};
