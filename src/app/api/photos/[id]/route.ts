import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getObject, deleteObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve a captured photo's bytes. Gated by the unguessable photo id (the same
 * model as the /b/[id] share link). Faces are sensitive (Principle 5), so the
 * response is marked private/no-store and the bytes never live under /public.
 *
 * Production hardening seam: add signed URLs or session/ownership checks here.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const photo = await prisma.photo.findUnique({ where: { id: params.id } });
  if (!photo) return new Response("Not found", { status: 404 });

  const bytes = await getObject(photo.storageKey);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(bytes, {
    headers: {
      "content-type": photo.mimeType,
      "cache-control": "private, no-store",
    },
  });
}

/** Delete a single photo (and its renders). Gated by the unguessable id. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const photo = await prisma.photo.findUnique({ where: { id: params.id }, include: { renders: true } });
  if (!photo) return NextResponse.json({ ok: true });

  for (const r of photo.renders) if (r.storageKey) await deleteObject(r.storageKey);
  await deleteObject(photo.storageKey);
  await prisma.photo.delete({ where: { id: photo.id } }); // cascades renders

  return NextResponse.json({ ok: true });
}
