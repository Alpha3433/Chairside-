/**
 * onboard.ts — the ONE pipeline every tier funnels into.
 *
 * Square webhook, Zapier webhook, and the fallback "find booking" step all call
 * onboardBooking(): match the booking's customer to the PORTABLE profile by
 * phone/email (create if new), mint a personalized token, and return the link.
 * Keeping this shared is what makes "all platforms" honest — the tiers differ
 * only in how the event arrives and how the link is delivered.
 */

import { prisma } from "./db";
import { normalizeContact, isPlausibleContact } from "./contact";
import { generateToken, tokenExpiry } from "./tokens";
import { absoluteUrl } from "./urls";

export interface NormalizedCustomer {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  externalCustomerId?: string | null;
}

export interface OnboardInput {
  shopId: string;
  platform: string; // square | zapier | fallback | walk_in
  customer: NormalizedCustomer;
  externalBookingId?: string | null;
  appointmentAt?: Date | null;
  /** walk_in: no contact yet — create a fresh, contactless profile. */
  allowContactless?: boolean;
  /** Mark the token confirmed immediately (walk-ins have no identity to gate). */
  confirmed?: boolean;
}

export interface OnboardResult {
  clientId: string;
  tokenId: string;
  token: string;
  link: string;
  isNewClient: boolean;
  firstName: string | null;
}

/** Prefer a phone contact, else email; null if neither is usable. */
export function pickContact(c: NormalizedCustomer): string | null {
  if (c.phone && isPlausibleContact(c.phone)) return normalizeContact(c.phone);
  if (c.email && isPlausibleContact(c.email)) return normalizeContact(c.email);
  return null;
}

export function personalizedLink(token: string): string {
  return absoluteUrl(`/go/${token}`);
}

export async function onboardBooking(input: OnboardInput): Promise<OnboardResult | null> {
  const { customer } = input;
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
  const contact = pickContact(customer);

  if (!contact && !input.allowContactless) return null;

  let client;
  let isNewClient = false;
  if (contact) {
    const existing = await prisma.client.findUnique({ where: { contact } });
    isNewClient = !existing;
    client = await prisma.client.upsert({
      where: { contact },
      create: { name: fullName, contact, hairType: "straight", density: "medium" },
      // Identity name from the booking is authoritative; don't touch hair context.
      update: fullName ? { name: fullName } : {},
    });
  } else {
    // Walk-in with no contact: a fresh, contactless profile keyed to a synthetic
    // unique contact so the schema's portable-key invariant holds.
    isNewClient = true;
    client = await prisma.client.create({
      data: {
        name: fullName || "Walk-in",
        contact: `walkin:${generateToken().slice(0, 16)}`,
        hairType: "straight",
        density: "medium",
      },
    });
  }

  const token = generateToken();
  const row = await prisma.bookingToken.create({
    data: {
      token,
      shopId: input.shopId,
      clientId: client.id,
      platform: input.platform,
      externalBookingId: input.externalBookingId ?? null,
      externalCustomerId: customer.externalCustomerId ?? null,
      customerFirstName: customer.firstName ?? (fullName ? fullName.split(" ")[0] : null),
      appointmentAt: input.appointmentAt ?? null,
      status: input.confirmed ? "confirmed" : "pending",
      confirmedAt: input.confirmed ? new Date() : null,
      expiresAt: tokenExpiry(),
    },
  });

  return {
    clientId: client.id,
    tokenId: row.id,
    token,
    link: personalizedLink(token),
    isNewClient,
    firstName: row.customerFirstName,
  };
}

export function isIntegrationsEnabled(): boolean {
  return (process.env.INTEGRATIONS_ENABLED ?? "true") !== "false";
}

/** Load a token with its client + shop (server-side resolution; never trust the URL for identity). */
export async function loadToken(token: string) {
  return prisma.bookingToken.findUnique({
    where: { token },
    include: { client: true, shop: true },
  });
}

/** Mint a token for an EXISTING client (fallback "find booking" disambiguator). */
export async function createTokenForClient(opts: {
  shopId: string;
  clientId: string;
  platform: string;
  firstName?: string | null;
  appointmentAt?: Date | null;
  confirmed?: boolean;
}): Promise<{ token: string; link: string }> {
  const token = generateToken();
  await prisma.bookingToken.create({
    data: {
      token,
      shopId: opts.shopId,
      clientId: opts.clientId,
      platform: opts.platform,
      customerFirstName: opts.firstName ?? null,
      appointmentAt: opts.appointmentAt ?? null,
      status: opts.confirmed ? "confirmed" : "pending",
      confirmedAt: opts.confirmed ? new Date() : null,
      expiresAt: tokenExpiry(),
    },
  });
  return { token, link: personalizedLink(token) };
}
