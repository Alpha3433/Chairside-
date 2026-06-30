import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadToken } from "@/lib/onboard";
import { isUsable, phoneTail, digitsMatch } from "@/lib/tokens";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Light identity confirmation before any sensitive data is revealed or saved.
 * If the booking has a phone on file, the user must enter its last 3 digits;
 * otherwise an appointment-time tap suffices. Hard rate-limited because last-3-
 * digits is a small keyspace — a forwarded link must not be brute-forceable.
 *
 * On success the token is marked confirmed and the MINIMAL prefill (name + hair
 * context) is returned — never the raw contact, which stays server-side.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!rateLimit(`confirm:${clientIp(req)}:${params.token}`, 8, 300_000)) {
    return NextResponse.json({ error: "Too many tries — please wait a few minutes." }, { status: 429 });
  }

  const tok = await loadToken(params.token);
  if (!tok || !isUsable(tok) || !tok.client) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }

  let digits = "";
  try {
    const body = (await req.json()) as { digits?: unknown };
    if (typeof body.digits === "string") digits = body.digits;
  } catch {
    /* appointment-tap path sends no body */
  }

  const hasPhone = !!phoneTail(tok.client.contact);
  if (hasPhone && !digitsMatch(tok.client.contact, digits)) {
    return NextResponse.json({ error: "Those digits don't match. Check and try again." }, { status: 401 });
  }

  if (tok.status === "pending") {
    await prisma.bookingToken.update({
      where: { id: tok.id },
      data: { status: "confirmed", confirmedAt: new Date() },
    });
  }

  // Minimal prefill — NO contact. The flow submits with the token; the server
  // resolves identity from it, so the browser never holds the contact.
  return NextResponse.json({
    ok: true,
    prefill: {
      name: tok.client.name,
      hairType: tok.client.hairType,
      density: tok.client.density,
      faceShape: tok.client.faceShape,
    },
  });
}
