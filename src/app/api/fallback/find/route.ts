import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { onboardBooking, createTokenForClient } from "@/lib/onboard";
import { findReturningClient } from "@/lib/booking/fallback";
import { fetchSquareBooking } from "@/lib/booking/square";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tier 3 fallback: the static desk QR has no booking context, so this resolves
 * the minimal disambiguator (first name + last 3 phone digits) for a returning
 * client, or starts a fresh walk-in profile. Returns a personalized link the
 * client opens — so even closed platforms and walk-ins reach the same flow.
 */
export async function POST(req: Request) {
  if (!rateLimit(`find:${clientIp(req)}`, 12, 60_000)) {
    return bad("Too many tries — please wait a moment.", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON");
  }

  const shopSlug = str(body.shopSlug);
  const mode = str(body.mode);
  const firstName = str(body.firstName).trim();
  const lastDigits = str(body.lastDigits);

  const shop = await prisma.shop.findUnique({ where: { slug: shopSlug } });
  if (!shop) return bad("Unknown shop.", 404);

  // Tapped one of "today's appointments" (only present when a readable platform
  // is connected). We re-fetch server-side and mint a PENDING token, so /go
  // still gates with last-digits — a shared desk QR can't expose a stranger.
  if (mode === "appointment") {
    const bookingId = str(body.externalBookingId);
    if (!bookingId) return bad("Missing appointment.");
    const normalized = await fetchSquareBooking(shop.id, bookingId);
    if (!normalized) return bad("Couldn't load that appointment.", 502);
    const result = await onboardBooking({
      shopId: shop.id,
      platform: "square",
      customer: normalized.customer,
      externalBookingId: normalized.externalBookingId,
      appointmentAt: normalized.appointmentAt,
    });
    if (!result) return bad("That appointment has no contact on file.", 422);
    return NextResponse.json({ ok: true, link: result.link });
  }

  if (mode === "walkin") {
    const result = await onboardBooking({
      shopId: shop.id,
      platform: "walk_in",
      customer: { firstName: firstName || null },
      allowContactless: true,
      confirmed: true, // no identity to gate — fresh profile
    });
    if (!result) return bad("Could not start a walk-in.", 500);
    return NextResponse.json({ ok: true, link: result.link });
  }

  // mode === "find"
  if (!firstName || lastDigits.replace(/\D/g, "").length < 3) {
    return bad("Enter your first name and the last 3 digits of your phone.");
  }
  const match = await findReturningClient(shop.id, firstName, lastDigits);
  if (!match) {
    return NextResponse.json({ ok: true, found: false });
  }
  // The disambiguator IS the confirmation, so the token is pre-confirmed.
  const { link } = await createTokenForClient({
    shopId: shop.id,
    clientId: match.id,
    platform: "fallback",
    firstName: match.name.split(" ")[0],
    confirmed: true,
  });
  return NextResponse.json({ ok: true, found: true, link });
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
