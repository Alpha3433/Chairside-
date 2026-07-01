/**
 * booking/square.ts — Tier 1 (deep) Square Appointments adapter.
 *
 * Real Square Connect v2 REST: OAuth, read Bookings + Customers, and attach the
 * brief/link back via Booking + Customer Custom Attributes. We READ and ATTACH —
 * we never CREATE bookings — so the free Appointments plan is enough.
 *
 * SAFE STUB MODE: when SQUARE_ENABLED is false (or a shop hasn't connected),
 * live calls are skipped and attach/list become logged no-ops, so the whole
 * pipeline (webhook → match/create → token → link) is demoable without a real
 * Square account. Flip SQUARE_ENABLED + connect a seller to go live.
 *
 * NOTE: a few things genuinely require a live Square seller and can't be
 * automated — creating the custom-attribute DEFINITIONS (done best-effort here),
 * verifying exact custom-attribute SCOPES, and making a team member "bookable"
 * (seller does this in Square's dashboard). These are flagged in onboarding.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "../db";
import type { BookingAdapter, NormalizedBooking, AttachResult } from "./types";

const SQUARE_VERSION = "2024-12-18";

export function squareEnabled(): boolean {
  return (
    process.env.SQUARE_ENABLED === "true" &&
    !!process.env.SQUARE_APP_ID &&
    !!process.env.SQUARE_APP_SECRET
  );
}

export function squareBaseUrl(): string {
  return process.env.SQUARE_ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export function squareScopes(): string {
  return (
    process.env.SQUARE_OAUTH_SCOPES ||
    "APPOINTMENTS_READ APPOINTMENTS_ALL_READ CUSTOMERS_READ CUSTOMERS_WRITE"
  );
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------
export function oauthAuthorizeUrl(state: string, redirectUri: string): string {
  const u = new URL(`${squareBaseUrl()}/oauth2/authorize`);
  u.searchParams.set("client_id", process.env.SQUARE_APP_ID ?? "");
  u.searchParams.set("scope", squareScopes());
  u.searchParams.set("session", "false");
  u.searchParams.set("state", state);
  u.searchParams.set("redirect_uri", redirectUri);
  return u.toString();
}

export interface SquareTokens {
  accessToken: string;
  refreshToken: string | null;
  merchantId: string | null;
  expiresAt: Date | null;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<SquareTokens> {
  const res = await fetch(`${squareBaseUrl()}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/json", "Square-Version": SQUARE_VERSION },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APP_ID,
      client_secret: process.env.SQUARE_APP_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Square token exchange failed (${res.status})`);
  const d = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    merchant_id?: string;
    expires_at?: string;
  };
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token ?? null,
    merchantId: d.merchant_id ?? null,
    expiresAt: d.expires_at ? new Date(d.expires_at) : null,
  };
}

// ---------------------------------------------------------------------------
// Webhook signature (HMAC-SHA256 over notificationUrl + rawBody, base64)
// ---------------------------------------------------------------------------
export function verifyWebhookSignature(notificationUrl: string, rawBody: string, signature: string): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) return false;
  const mac = createHmac("sha256", key).update(notificationUrl + rawBody).digest("base64");
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(signature || "");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Thin REST client (swap for the official `square` SDK if preferred)
// ---------------------------------------------------------------------------
class SquareClient {
  constructor(private token: string) {}

  private async req(path: string, init?: RequestInit) {
    const res = await fetch(`${squareBaseUrl()}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "Square-Version": SQUARE_VERSION,
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Square ${path} → ${res.status}`);
    return res.json();
  }

  async getBooking(id: string): Promise<Record<string, unknown>> {
    return (await this.req(`/v2/bookings/${id}`)).booking;
  }

  async getCustomer(id: string): Promise<Record<string, unknown>> {
    return (await this.req(`/v2/customers/${id}`)).customer;
  }

  async listBookings(locationId: string | null, startMin: string, startMax: string) {
    const qs = new URLSearchParams();
    if (locationId) qs.set("location_id", locationId);
    qs.set("start_at_min", startMin);
    qs.set("start_at_max", startMax);
    const data = (await this.req(`/v2/bookings?${qs.toString()}`)) as {
      bookings?: Record<string, unknown>[];
    };
    return data.bookings ?? [];
  }

  /** Best-effort: ensure a definition exists, then upsert the value. */
  async upsertBookingAttribute(bookingId: string, key: string, value: string) {
    await this.req(`/v2/bookings/custom-attribute-definitions`, {
      method: "POST",
      body: JSON.stringify({ custom_attribute_definition: { key, name: key, visibility: "VISIBILITY_READ_ONLY", schema: { type: "string" } } }),
    }).catch(() => undefined);
    await this.req(`/v2/bookings/${bookingId}/custom-attributes/${key}`, {
      method: "PUT",
      body: JSON.stringify({ custom_attribute: { value } }),
    });
  }

  async upsertCustomerAttribute(customerId: string, key: string, value: string) {
    await this.req(`/v2/customers/custom-attribute-definitions`, {
      method: "POST",
      body: JSON.stringify({ custom_attribute_definition: { key, name: key, visibility: "VISIBILITY_READ_WRITE_VALUES", schema: { type: "string" } } }),
    }).catch(() => undefined);
    await this.req(`/v2/customers/${customerId}/custom-attributes/${key}`, {
      method: "PUT",
      body: JSON.stringify({ custom_attribute: { value } }),
    });
  }
}

async function integrationFor(shopId: string) {
  return prisma.shopIntegration.findUnique({ where: { shopId_platform: { shopId, platform: "square" } } });
}

/** Normalize a Square booking + customer into our shared shape. */
export function normalizeSquare(
  booking: Record<string, unknown>,
  customer: Record<string, unknown> | null,
): NormalizedBooking {
  const startAt = typeof booking.start_at === "string" ? new Date(booking.start_at) : null;
  return {
    externalBookingId: String(booking.id ?? ""),
    externalCustomerId: (booking.customer_id as string) ?? (customer?.id as string) ?? null,
    appointmentAt: startAt,
    customer: {
      firstName: (customer?.given_name as string) ?? null,
      lastName: (customer?.family_name as string) ?? null,
      phone: (customer?.phone_number as string) ?? null,
      email: (customer?.email_address as string) ?? null,
      externalCustomerId: (customer?.id as string) ?? (booking.customer_id as string) ?? null,
    },
  };
}

/** Fetch + normalize a booking by id (used by the webhook). Returns null in stub/no-connect. */
export async function fetchSquareBooking(shopId: string, bookingId: string): Promise<NormalizedBooking | null> {
  const integ = await integrationFor(shopId);
  if (!squareEnabled() || !integ?.accessToken) return null;
  try {
    const client = new SquareClient(integ.accessToken);
    const booking = await client.getBooking(bookingId);
    const customerId = booking.customer_id as string | undefined;
    const customer = customerId ? await client.getCustomer(customerId) : null;
    return normalizeSquare(booking, customer);
  } catch {
    return null;
  }
}

export const SquareAdapter: BookingAdapter = {
  platform: "square",
  isConfigured: () => squareEnabled(),

  async listAppointments(shopId, fromIso, toIso) {
    const integ = await integrationFor(shopId);
    if (!squareEnabled() || !integ?.accessToken) return [];
    try {
      const client = new SquareClient(integ.accessToken);
      const bookings = await client.listBookings(integ.locationId, fromIso, toIso);
      const out: NormalizedBooking[] = [];
      for (const b of bookings) {
        const cid = b.customer_id as string | undefined;
        const customer = cid ? await client.getCustomer(cid).catch(() => null) : null;
        out.push(normalizeSquare(b, customer));
      }
      return out;
    } catch {
      return [];
    }
  },

  async attachLink({ shopId, externalBookingId, externalCustomerId, key, label, url }): Promise<AttachResult> {
    const integ = await integrationFor(shopId);
    if (!squareEnabled() || !integ?.accessToken) {
      console.log(`[square stub] would attach ${key} (${label}) = ${url} → booking=${externalBookingId} customer=${externalCustomerId}`);
      return "stub";
    }
    try {
      const client = new SquareClient(integ.accessToken);
      if (externalBookingId) await client.upsertBookingAttribute(externalBookingId, key, url);
      if (externalCustomerId) await client.upsertCustomerAttribute(externalCustomerId, key, url);
      return "attached";
    } catch {
      return "failed";
    }
  },
};
