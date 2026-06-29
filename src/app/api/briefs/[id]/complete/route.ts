import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isBarberAuthed } from "@/lib/auth";
import { parseSpec, specToCreateData, SpecValidationError } from "@/lib/specSerialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mark a brief complete and capture what was ACTUALLY done. This records the
 * real cut (which may differ from the request), building the client's portable
 * history and the barber's own record — value for the barber, not just demands.
 *
 * Completing also writes a briefed Visit, which feeds the retention metric.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isBarberAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brief = await prisma.brief.findUnique({
    where: { id: params.id },
    include: { requestedSpec: true, visit: true },
  });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let spec;
  try {
    spec = parseSpec(body.spec);
  } catch (e) {
    if (e instanceof SpecValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : brief.notes;

  const actualSpec = await prisma.styleSpec.create({
    data: specToCreateData(spec, { baseStyleId: brief.requestedSpec.baseStyleId }),
  });

  const now = new Date();
  await prisma.brief.update({
    where: { id: brief.id },
    data: {
      actualSpecId: actualSpec.id,
      status: "completed",
      completedAt: now,
      seenAt: brief.seenAt ?? now,
      notes,
    },
  });

  // Record the briefed visit (idempotent — one visit per brief).
  if (!brief.visit) {
    await prisma.visit.create({
      data: {
        clientId: brief.clientId,
        shopId: brief.shopId,
        briefId: brief.id,
        briefed: true,
        visitedAt: now,
      },
    });
  }

  return NextResponse.json({ ok: true, actualSpecId: actualSpec.id });
}
