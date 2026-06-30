/**
 * booking/zapier.ts — Tier 2 (trigger) adapter for Gettimely and any platform
 * reachable via Zapier/webhooks. Gettimely has no public API, so a shop's Zap
 * (e.g. "new appointment") POSTs to our inbound webhook, signed with a shared
 * secret. We can't write back into the platform UI — we deliver the personalized
 * link to the customer directly (and the brief still reaches the barber dashboard).
 */

import type { BookingAdapter } from "./types";
import type { NormalizedCustomer } from "../onboard";

export const ZapierAdapter: BookingAdapter = {
  platform: "zapier",
  isConfigured: () => !!process.env.ZAPIER_WEBHOOK_SECRET,
  // No attach/list: trigger-only platforms can't be written back to or read.
};

export function verifyZapierSecret(provided: string | null): boolean {
  const expected = process.env.ZAPIER_WEBHOOK_SECRET || "";
  return !!expected && provided === expected;
}

export interface ZapierPayload {
  shopSlug?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  appointmentAt?: string;
  externalBookingId?: string;
}

export function normalizeZapier(body: ZapierPayload): {
  customer: NormalizedCustomer;
  externalBookingId: string | null;
  appointmentAt: Date | null;
} {
  const appt = body.appointmentAt ? new Date(body.appointmentAt) : null;
  return {
    customer: {
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
    },
    externalBookingId: body.externalBookingId ?? null,
    appointmentAt: appt && !Number.isNaN(appt.getTime()) ? appt : null,
  };
}
