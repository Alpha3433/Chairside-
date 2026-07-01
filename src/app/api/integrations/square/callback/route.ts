import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { exchangeCode } from "@/lib/booking/square";
import { absoluteUrl } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Square OAuth callback: validate the state cookie set at connect, exchange the
 * code for seller tokens, and store the ShopIntegration. The state cookie (set
 * during the barber-gated connect) is the gate here.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthErr = searchParams.get("error");

  const raw = cookies().get("sq_oauth")?.value;
  let saved: { state: string; slug: string } | null = null;
  try {
    saved = raw ? (JSON.parse(raw) as { state: string; slug: string }) : null;
  } catch {
    saved = null;
  }
  if (!saved) return NextResponse.redirect(absoluteUrl("/barber"));
  const slug = saved.slug;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(absoluteUrl(`/barber/${slug}/integrations?error=${reason}`));
    res.cookies.set("sq_oauth", "", { path: "/", maxAge: 0 });
    return res;
  };

  if (oauthErr || !code || !state || state !== saved.state) return fail("denied");

  try {
    const tokens = await exchangeCode(code, absoluteUrl("/api/integrations/square/callback"));
    const shop = await prisma.shop.findUnique({ where: { slug } });
    if (!shop) return fail("unknown_shop");
    await prisma.shopIntegration.upsert({
      where: { shopId_platform: { shopId: shop.id, platform: "square" } },
      create: {
        shopId: shop.id,
        platform: "square",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        merchantId: tokens.merchantId,
        tokenExpiresAt: tokens.expiresAt,
        status: "connected",
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        merchantId: tokens.merchantId,
        tokenExpiresAt: tokens.expiresAt,
        status: "connected",
      },
    });
    const res = NextResponse.redirect(absoluteUrl(`/barber/${slug}/integrations?connected=1`));
    res.cookies.set("sq_oauth", "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return fail("exchange_failed");
  }
}
