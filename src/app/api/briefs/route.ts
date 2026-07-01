import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeContact, isPlausibleContact } from "@/lib/contact";
import { parseSpec, specToCreateData, SpecValidationError } from "@/lib/specSerialize";
import { renderIllustration } from "@/lib/render";
import { HAIR_TYPES, DENSITIES, FACE_SHAPES, USE_CASE_TAGS } from "@/lib/spec";
import { loadToken } from "@/lib/onboard";
import { isUsable } from "@/lib/tokens";
import { attachLink } from "@/lib/booking/registry";
import { absoluteUrl } from "@/lib/urls";

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

  if (!HAIR_TYPES.includes(hairType as never)) return bad("Invalid hair type.");
  if (!DENSITIES.includes(density as never)) return bad("Invalid density.");
  if (faceShapeRaw && !FACE_SHAPES.includes(faceShapeRaw as never)) return bad("Invalid face shape.");
  if (!USE_CASE_TAGS.includes(useCaseTag as never)) return bad("Invalid use-case tag.");

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
  // one-way Spec→image fence), never accepted from the request body.
  const renderUrl = await renderIllustration(spec);

  // Resolve shop + client from EITHER a personalized booking token (identity
  // known server-side; no contact in the request) or the contact path.
  const bookingTokenStr = body.bookingToken ? str(body.bookingToken) : "";
  let shopId: string;
  let clientId: string;
  let bookingTokenId: string | null = null;
  let token: Awaited<ReturnType<typeof loadToken>> = null;

  if (bookingTokenStr) {
    token = await loadToken(bookingTokenStr);
    if (!token || !isUsable(token) || !token.client) return bad("This booking link has expired.", 410);
    if (token.status === "pending") return bad("Confirm your identity first.", 403);
    if (token.status === "consumed") return bad("This booking already has a brief.", 409);
    shopId = token.shopId;
    bookingTokenId = token.id;
    // Update mutable hair context from the flow; identity/name stay from the booking.
    const c = await prisma.client.update({
      where: { id: token.client.id },
      data: { hairType, density, faceShape: faceShapeRaw || null },
    });
    clientId = c.id;
  } else {
    if (!name) return bad("Name is required.");
    if (!isPlausibleContact(contactRaw)) return bad("A valid phone or email is required.");
    const shop = await prisma.shop.findUnique({ where: { slug: shopSlug } });
    if (!shop) return bad("Unknown shop.", 404);
    shopId = shop.id;
    const contact = normalizeContact(contactRaw);
    const client = await prisma.client.upsert({
      where: { contact },
      create: { name, contact, hairType, density, faceShape: faceShapeRaw || null },
      update: { name, hairType, density, faceShape: faceShapeRaw || null },
    });
    clientId = client.id;
  }

  const requestedSpec = await prisma.styleSpec.create({
    data: specToCreateData(spec, { baseStyleId, renderUrl }),
  });

  const brief = await prisma.brief.create({
    data: {
      clientId,
      shopId,
      requestedSpecId: requestedSpec.id,
      useCaseTag,
      status: "submitted",
      notes,
      bookingTokenId,
    },
  });

  // Attach captured photos owned by this client (and not already on a brief).
  const photoIds = Array.isArray(body.photoIds)
    ? body.photoIds.filter((x): x is string => typeof x === "string").slice(0, 8)
    : [];
  if (photoIds.length) {
    await prisma.photo.updateMany({
      where: { id: { in: photoIds }, clientId, briefId: null },
      data: { briefId: brief.id },
    });
  }

  // Tokenized booking: consume the token, then push the brief link back to the
  // platform dashboard (Tier 1 / Square via custom attributes; no-op elsewhere).
  if (token) {
    await prisma.bookingToken.update({
      where: { id: token.id },
      data: { status: "consumed", consumedAt: new Date() },
    });
    const sync = await attachLink({
      platform: token.platform,
      shopId,
      externalBookingId: token.externalBookingId,
      externalCustomerId: token.externalCustomerId,
      key: "chairside_brief",
      label: "Chairside brief",
      url: absoluteUrl(`/b/${brief.id}`),
    });
    if (sync) await prisma.brief.update({ where: { id: brief.id }, data: { syncStatus: sync } });
  }

  return NextResponse.json({ ok: true, briefId: brief.id, clientId });
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
