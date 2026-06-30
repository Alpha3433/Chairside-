import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve a rendered preview's bytes. Gated by the unguessable render id; private
 * cache. The render is an illustration of the spec — the UI always labels it
 * "Illustration — not a guarantee".
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const render = await prisma.render.findUnique({ where: { id: params.id } });
  if (!render || !render.storageKey) return new Response("Not found", { status: 404 });

  const bytes = await getObject(render.storageKey);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(bytes, {
    headers: {
      "content-type": render.mimeType,
      "cache-control": "private, no-store",
    },
  });
}
