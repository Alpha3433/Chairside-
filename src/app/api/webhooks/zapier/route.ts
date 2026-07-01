import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyZapierSecret, normalizeZapier, type ZapierPayload } from "@/lib/booking/zapier";
import { isTriggerPlatform } from "@/lib/booking/platforms";
import { onboardBooking } from "@/lib/onboard";
import { sendBookingLink } from "@/lib/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tier 2 inbound webhook (Gettimely via Zapier, or any "new appointment" Zap).
 * Signed with a shared secret. Runs the SAME pipeline as Square, then delivers
 * the personalized link to the customer (we can't write back into the platform).
 */
export async function POST(req: Request) {
  if (!verifyZapierSecret(req.headers.get("x-chairside-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ZapierPayload;
  try {
    body = (await req.json()) as ZapierPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.shopSlug) return NextResponse.json({ error: "shopSlug is required." }, { status: 400 });
  const shop = await prisma.shop.findUnique({ where: { slug: body.shopSlug } });
  if (!shop) return NextResponse.json({ error: "Unknown shop." }, { status: 404 });

  // Tag the real source platform (e.g. Booksy/Gettimely via a Zap) so the brief
  // shows the right origin; fall back to a generic "zapier" label.
  const platform =
    typeof body.platform === "string" && isTriggerPlatform(body.platform) ? body.platform : "zapier";

  const { customer, externalBookingId, appointmentAt } = normalizeZapier(body);
  const result = await onboardBooking({
    shopId: shop.id,
    platform,
    customer,
    externalBookingId,
    appointmentAt,
  });
  if (!result) {
    return NextResponse.json({ error: "Need a phone or email to match the customer." }, { status: 422 });
  }

  const to = customer.phone || customer.email || "";
  const messaged = to
    ? await sendBookingLink({ to, firstName: result.firstName, shopName: shop.name, link: result.link, appointmentAt })
    : { sent: false, stub: true, channel: "none" as const };

  // Return the link so the Zap can also use it (e.g. drop into a consult-form field).
  return NextResponse.json({ ok: true, link: result.link, messaged });
}
