import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeContact, isPlausibleContact } from "@/lib/contact";
import { parseSpec, specToCreateData, SpecValidationError } from "@/lib/specSerialize";
import { renderIllustration } from "@/lib/render";
import { HAIR_TYPES, DENSITIES, FACE_SHAPES, USE_CASE_TAGS } from "@/lib/spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a brief. This is the heart of the client flow's final step.
 *
 * The client is UPSERTED by their portable contact key, so a returning person
 * (even at a new shop) is the same Client row and their history accrues. The
 * requested spec is built ONLY via parseSpec — structured params in, validated
 * spec out. There is no path here that derives a spec from an image.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shopSlug = str(body.shopSlug);
  const name = str(body.name).trim();
  const contactRaw = str(body.contact);
  const hairType = str(body.hairType);
  const density = str(body.density);
  const faceShapeRaw = str(body.faceShape);
  const useCaseTag = str(body.useCaseTag);
  const baseStyleId = body.baseStyleId ? str(body.baseStyleId) : null;
  const notes = body.notes ? str(body.notes).slice(0, 2000) : null;

  if (!name) return bad("Name is required.");
  if (!isPlausibleContact(contactRaw)) return bad("A valid phone or email is required.");
  if (!HAIR_TYPES.includes(hairType as never)) return bad("Invalid hair type.");
  if (!DENSITIES.includes(density as never)) return bad("Invalid density.");
  if (faceShapeRaw && !FACE_SHAPES.includes(faceShapeRaw as never)) return bad("Invalid face shape.");
  if (!USE_CASE_TAGS.includes(useCaseTag as never)) return bad("Invalid use-case tag.");

  const shop = await prisma.shop.findUnique({ where: { slug: shopSlug } });
  if (!shop) return bad("Unknown shop.", 404);

  let spec;
  try {
    spec = parseSpec(body.spec);
  } catch (e) {
    if (e instanceof SpecValidationError) return bad(e.message);
    throw e;
  }

  if (baseStyleId) {
    const base = await prisma.baseStyle.findUnique({ where: { id: baseStyleId } });
    if (!base) return bad("Unknown base style.", 404);
  }

  // The illustrative render is SERVER-derived from the structured spec (the
  // one-way Spec→image fence), never accepted from the request body — so the
  // public spec page can't be made to embed an attacker-supplied image URL.
  const renderUrl = await renderIllustration(spec);

  const contact = normalizeContact(contactRaw);

  // Upsert the portable client. Update mutable context on return visits.
  const client = await prisma.client.upsert({
    where: { contact },
    create: { name, contact, hairType, density, faceShape: faceShapeRaw || null },
    update: { name, hairType, density, faceShape: faceShapeRaw || null },
  });

  const requestedSpec = await prisma.styleSpec.create({
    data: specToCreateData(spec, { baseStyleId, renderUrl }),
  });

  const brief = await prisma.brief.create({
    data: {
      clientId: client.id,
      shopId: shop.id,
      requestedSpecId: requestedSpec.id,
      useCaseTag,
      status: "submitted",
      notes,
    },
  });

  // Attach any captured photos (visualization layer) to this brief — but only
  // ones that belong to THIS client and aren't already on another brief, so a
  // caller can't staple someone else's photos onto their brief.
  const photoIds = Array.isArray(body.photoIds)
    ? body.photoIds.filter((x): x is string => typeof x === "string").slice(0, 8)
    : [];
  if (photoIds.length) {
    await prisma.photo.updateMany({
      where: { id: { in: photoIds }, clientId: client.id, briefId: null },
      data: { briefId: brief.id },
    });
  }

  return NextResponse.json({ ok: true, briefId: brief.id, clientId: client.id });
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
