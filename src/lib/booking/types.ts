/**
 * booking/types.ts — the common adapter contract.
 *
 * "All platforms" is honest only because the tiers share ONE pipeline
 * (lib/onboard) and differ just in how an event arrives and how the link is
 * delivered. Each adapter implements only what its platform actually allows:
 *   - Square (Tier 1, deep): events via webhook, attach-back + read appointments.
 *   - Zapier (Tier 2, trigger): events via inbound webhook; no attach/read.
 *   - Fallback (Tier 3): no events at all — static QR → find-booking / walk-in.
 */

import type { NormalizedCustomer } from "../onboard";

export interface NormalizedBooking {
  externalBookingId: string;
  externalCustomerId?: string | null;
  appointmentAt?: Date | null;
  customer: NormalizedCustomer;
}

export type AttachResult = "attached" | "stub" | "failed";

export interface BookingAdapter {
  platform: string;
  /** Env-level configuration present (the platform can do live calls). */
  isConfigured(): boolean;
  /** Tier 1 only: list a shop's appointments in a window (for the fallback). */
  listAppointments?(shopId: string, fromIso: string, toIso: string): Promise<NormalizedBooking[]>;
  /** Tier 1 only: attach a labelled link to the booking + customer in the platform. */
  attachLink?(args: {
    shopId: string;
    externalBookingId?: string | null;
    externalCustomerId?: string | null;
    key: string;
    label: string;
    url: string;
  }): Promise<AttachResult>;
}
