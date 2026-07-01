import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { parseSpec, SpecValidationError } from "@/lib/specSerialize";
import { generateSummary } from "@/lib/specSummary";
import { specHash } from "@/lib/specHash";
import { renderOnPhoto } from "@/lib/photoRender";
import { getObject, putObject } from "@/lib/storage";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { type Angle } from "@/lib/angles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXT: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Render a chosen spec onto a captured photo (the try-on). The render is the
 * LOOK only — the spec it visualises came from structured params (Principle 1).
 *
 * COST CONTROL (Principle 4): cached by (photoId, specHash). A repeat request
 * for the same look on the same photo returns the cached render and never
 * re-bills the provider. Callers render the FRONT by default and gate side
 * angles, so most taps touch only one photo.
 */
export async function POST(req: Request) {
  if (!rateLimit(`render:${clientIp(req)}`, 40, 60_000)) {
    return bad("Too many renders — please wait a moment.", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON");
  }

  const photoId = typeof body.photoId === "string" ? body.photoId : "";
  if (!photoId) return bad("photoId is required.");

  let spec;
  try {
    spec = parseSpec(body.spec);
  } catch (e) {
    if (e instanceof SpecValidationError) return bad(e.message);
    throw e;
  }

  const hash = specHash(spec);

  // Independent lookups — run together (the cache-hit path is the hot one).
  const [photo, cached] = await Promise.all([
    prisma.photo.findUnique({ where: { id: photoId } }),
    prisma.render.findUnique({ where: { photoId_specHash: { photoId, specHash: hash } } }),
  ]);
  if (!photo) return bad("Unknown photo.", 404);

  // Cache hit — never re-bill.
  if (cached && cached.storageKey) {
    return NextResponse.json({
      id: cached.id,
      url: `/api/renders/${cached.id}`,
      angle: cached.angle,
      status: cached.status,
      provider: cached.provider,
      cached: true,
    });
  }

  const photoBytes = await getObject(photo.storageKey);
  if (!photoBytes) return bad("Photo bytes are missing.", 404);

  const result = await renderOnPhoto({
    photoBytes,
    mimeType: photo.mimeType,
    width: photo.width,
    height: photo.height,
    spec,
    summary: generateSummary(spec),
    angle: photo.angle as Angle,
  });

  const storageKey = `renders/${randomUUID()}.${EXT[result.mimeType] ?? "png"}`;
  await putObject(storageKey, result.bytes);

  const render = await prisma.render.upsert({
    where: { photoId_specHash: { photoId, specHash: hash } },
    create: {
      photoId,
      angle: photo.angle,
      specHash: hash,
      storageKey,
      mimeType: result.mimeType,
      status: result.status,
      provider: result.provider,
    },
    update: {
      storageKey,
      mimeType: result.mimeType,
      status: result.status,
      provider: result.provider,
    },
  });

  return NextResponse.json({
    id: render.id,
    url: `/api/renders/${render.id}`,
    angle: render.angle,
    status: render.status,
    provider: render.provider,
    cached: false,
  });
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
