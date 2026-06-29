import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isBarberAuthed } from "@/lib/auth";
import { normalizeContact, isPlausibleContact } from "@/lib/contact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manually log a NON-BRIEFED visit, so a pilot shop can build the baseline
 * cohort the retention metric compares against (Risk 3). Barber-gated.
 */
export async function POST(req: Request) {
  if (!isBarberAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shopSlug = str(body.shopSlug);
  const name = str(body.name).trim();
  const contactRaw = str(body.contact);
  const visitedAtRaw = str(body.visitedAt);

  if (!name) return bad("Name is required.");
  if (!isPlausibleContact(contactRaw)) return bad("A valid phone or email is required.");

  const shop = await prisma.shop.findUnique({ where: { slug: shopSlug } });
  if (!shop) return bad("Unknown shop.", 404);

  const visitedAt = visitedAtRaw ? new Date(visitedAtRaw) : new Date();
  if (Number.isNaN(visitedAt.getTime())) return bad("Invalid visit date.");

  const contact = normalizeContact(contactRaw);
  const client = await prisma.client.upsert({
    where: { contact },
    create: { name, contact, hairType: "straight", density: "medium" },
    update: { name },
  });

  await prisma.visit.create({
    data: {
      clientId: client.id,
      shopId: shop.id,
      briefed: false,
      visitedAt,
    },
  });

  return NextResponse.json({ ok: true });
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
