import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  squareEnabled,
  verifyWebhookSignature,
  fetchSquareBooking,
  normalizeSquare,
} from "@/lib/booking/square";
import { onboardBooking } from "@/lib/onboard";
import { attachLink } from "@/lib/booking/registry";
import { sendBookingLink } from "@/lib/messaging";
import { absoluteUrl } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SquareEvent {
  type?: string;
  merchant_id?: string;
  data?: { object?: { booking?: Record<string, unknown>; customer?: Record<string, unknown> } };
}

/**
 * Tier 1 Square webhook: on booking.created / booking.updated, match/create the
 * portable profile, mint a personalized link, attach it to the appointment +
 * customer (custom attributes), and (optionally) message the customer.
 *
 * Live mode (SQUARE_ENABLED) REQUIRES a valid HMAC signature. Stub mode accepts
 * unsigned synthetic payloads so the pipeline is locally testable.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-square-hmacsha256-signature") ?? "";
  const notificationUrl =
    (process.env.SQUARE_WEBHOOK_URL || "").trim() || absoluteUrl("/api/webhooks/square");

  if (squareEnabled() && !verifyWebhookSignature(notificationUrl, raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: SquareEvent;
  try {
    event = JSON.parse(raw) as SquareEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = String(event.type ?? "");
  if (!type.startsWith("booking.")) return NextResponse.json({ ok: true, ignored: type });

  const bookingObj = event.data?.object?.booking;
  if (!bookingObj?.id) return NextResponse.json({ error: "No booking in event" }, { status: 400 });

  // Map the Square merchant to one of our connected shops.
  const integ = event.merchant_id
    ? await prisma.shopIntegration.findFirst({ where: { platform: "square", merchantId: event.merchant_id } })
    : null;
  if (!integ) return NextResponse.json({ ok: true, ignored: "unknown merchant" });

  const shop = await prisma.shop.findUnique({ where: { id: integ.shopId } });
  if (!shop) return NextResponse.json({ ok: true, ignored: "unknown shop" });

  // Live: fetch booking+customer from Square. Stub: normalize from the payload.
  const normalized =
    (await fetchSquareBooking(integ.shopId, String(bookingObj.id))) ??
    normalizeSquare(bookingObj, event.data?.object?.customer ?? null);

  const result = await onboardBooking({
    shopId: integ.shopId,
    platform: "square",
    customer: normalized.customer,
    externalBookingId: normalized.externalBookingId,
    appointmentAt: normalized.appointmentAt,
  });
  if (!result) return NextResponse.json({ ok: true, ignored: "no contact on customer" });

  // (a) Attach the onboarding link to the appointment + customer.
  const attach = await attachLink({
    platform: "square",
    shopId: integ.shopId,
    externalBookingId: normalized.externalBookingId,
    externalCustomerId: normalized.customer.externalCustomerId,
    key: "chairside_link",
    label: "Set up your cut",
    url: result.link,
  });

  // (b) Optionally send our own functional message with the link.
  const to = normalized.customer.phone || normalized.customer.email || "";
  const messaged = to
    ? await sendBookingLink({
        to,
        firstName: result.firstName,
        shopName: shop.name,
        link: result.link,
        appointmentAt: normalized.appointmentAt,
      })
    : { sent: false, stub: true, channel: "none" as const };

  return NextResponse.json({ ok: true, link: result.link, attach, messaged });
}
