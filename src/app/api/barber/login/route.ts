import { NextResponse } from "next/server";
import { codeMatches, BARBER_COOKIE, COOKIE_VALUE_OK } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code = (body as { code?: unknown })?.code;
  if (typeof code !== "string" || !codeMatches(code)) {
    return NextResponse.json({ error: "Incorrect access code." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(BARBER_COOKIE, COOKIE_VALUE_OK, {
    httpOnly: true,
    sameSite: "lax",
    // Secure in production so the session cookie is never sent over plaintext
    // HTTP; left off in dev so http://localhost still works.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 2 weeks
  });
  return res;
}
