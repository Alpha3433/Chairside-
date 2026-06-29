import { NextResponse } from "next/server";
import { BARBER_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BARBER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
