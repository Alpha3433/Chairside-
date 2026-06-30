import { NextResponse } from "next/server";
import { qrSvg } from "@/lib/qr";

export const runtime = "nodejs";

/**
 * Render a QR code (SVG) for arbitrary text — used for the shop's client link
 * and the shareable spec link. Output is pure SVG rects (no script), so the
 * encoded text is never reflected as markup.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") ?? "";
  const size = Math.min(Math.max(Number(searchParams.get("size")) || 220, 80), 600);

  if (!text || text.length > 1024) {
    return NextResponse.json({ error: "Missing or too-long 'text'." }, { status: 400 });
  }

  const svg = await qrSvg(text, { width: size });
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
