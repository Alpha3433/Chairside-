import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isBarberAuthed } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isBarberAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brief = await prisma.brief.findUnique({ where: { id: params.id } });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (brief.status === "submitted") {
    await prisma.brief.update({
      where: { id: brief.id },
      data: { status: "seen", seenAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
