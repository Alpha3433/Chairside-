import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isBarberAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { squareEnabled, oauthAuthorizeUrl } from "@/lib/booking/square";
import { absoluteUrl } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start the Square OAuth connect for a shop (barber-gated). Stores a signed
 * state in an httpOnly cookie and redirects the seller to Square's consent page.
 */
export async function GET(req: Request) {
  if (!isBarberAuthed()) return NextResponse.redirect(absoluteUrl("/barber"));

  const slug = new URL(req.url).searchParams.get("shop") ?? "";
  const shop = await prisma.shop.findUnique({ where: { slug } });
  if (!shop) return NextResponse.redirect(absoluteUrl("/barber"));

  if (!squareEnabled()) {
    return NextResponse.redirect(absoluteUrl(`/barber/${slug}/integrations?error=not_configured`));
  }

  const state = randomBytes(16).toString("base64url");
  const redirectUri = absoluteUrl("/api/integrations/square/callback");
  const res = NextResponse.redirect(oauthAuthorizeUrl(state, redirectUri));
  res.cookies.set("sq_oauth", JSON.stringify({ state, slug }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
