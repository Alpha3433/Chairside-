import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isBarberAuthed } from "@/lib/auth";
import { parseSpec, specToCreateData, SpecValidationError } from "@/lib/specSerialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Barber counter-proposal: a "closest achievable on your hair" spec + note.
 * The tool serves the barber — it lets them adjust the structured spec and send
 * it back, rather than cornering them into an unachievable request.
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
    include: { requestedSpec: true },
  });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let spec;
  try {
    spec = parseSpec(body.spec);
  } catch (e) {
    if (e instanceof SpecValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : null;

  const barberSpec = await prisma.styleSpec.create({
    data: specToCreateData(spec, { baseStyleId: brief.requestedSpec.baseStyleId }),
  });

  await prisma.brief.update({
    where: { id: brief.id },
    data: {
      barberSpecId: barberSpec.id,
      barberNote: note,
      status: "counter_proposed",
      seenAt: brief.seenAt ?? new Date(),
    },
  });

  return NextResponse.json({ ok: true, barberSpecId: barberSpec.id });
}
