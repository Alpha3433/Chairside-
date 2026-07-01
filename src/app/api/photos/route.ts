import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { normalizeContact, isPlausibleContact } from "@/lib/contact";
import { isAngle } from "@/lib/angles";
import { putObject, deleteObject } from "@/lib/storage";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { loadToken } from "@/lib/onboard";
import { isUsable } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — client compresses well below this
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Upload a captured photo for an angle. Consent-gated (Principle 5): the client
 * must pass consent=true, and we stamp Client.photoConsentAt on first consent.
 * The client is upserted by their portable contact, so photos travel with them.
 * Bytes go to the storage stub (never /public); only the row id is returned.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Expected multipart form data.");
  }

  // Rate-limit per IDENTITY (token or contact) when we have one: a whole shop's
  // clients share one Wi-Fi IP, and a per-IP-only cap would 429 legitimate
  // capture bursts at rush hour. A looser per-IP ceiling stays as the abuse
  // backstop for requests with no identity at all.
  const identityKey =
    String(form.get("bookingToken") ?? "") || String(form.get("contact") ?? "");
  const limitOk = identityKey
    ? rateLimit(`photo-up:id:${identityKey}`, 30, 60_000) &&
      rateLimit(`photo-up:ip:${clientIp(req)}`, 300, 60_000)
    : rateLimit(`photo-up:ip:${clientIp(req)}`, 60, 60_000);
  if (!limitOk) return bad("Too many uploads — please wait a moment.", 429);

  const bookingToken = String(form.get("bookingToken") ?? "");
  const contactRaw = String(form.get("contact") ?? "");
  const angle = String(form.get("angle") ?? "");
  const consent = String(form.get("consent") ?? "") === "true";
  const width = toInt(form.get("width"));
  const height = toInt(form.get("height"));
  const file = form.get("photo");

  if (!consent) return bad("Photo consent is required before uploading.", 403);
  if (!isAngle(angle)) return bad("Invalid angle.");
  if (!(file instanceof File)) return bad("Missing photo file.");
  if (file.size > MAX_BYTES) return bad("Photo is too large.", 413);

  const mimeType = EXT[file.type] ? file.type : "image/jpeg";
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) return bad("Empty photo.");

  // Resolve the owning client either from a confirmed booking token (personalized
  // flow — no contact in the browser) or from the contact (normal flow).
  let client;
  if (bookingToken) {
    const tok = await loadToken(bookingToken);
    if (!tok || !isUsable(tok) || !tok.client) return bad("This link has expired.", 410);
    if (tok.status === "pending") return bad("Confirm your identity first.", 403);
    client = tok.client;
  } else {
    if (!isPlausibleContact(contactRaw)) return bad("A valid phone or email is required.");
    const contact = normalizeContact(contactRaw);
    client = await prisma.client.upsert({
      where: { contact },
      create: { name: "", contact, hairType: "straight", density: "medium", photoConsentAt: new Date() },
      update: {},
    });
  }
  if (!client.photoConsentAt) {
    await prisma.client.update({ where: { id: client.id }, data: { photoConsentAt: new Date() } });
  }

  const storageKey = `photos/${randomUUID()}.${EXT[mimeType]}`;
  await putObject(storageKey, bytes);

  const photo = await prisma.photo.create({
    data: { clientId: client.id, angle, storageKey, mimeType, width, height },
  });

  return NextResponse.json({
    id: photo.id,
    angle: photo.angle,
    url: `/api/photos/${photo.id}`,
    width: photo.width,
    height: photo.height,
  });
}

/**
 * Delete ALL of a client's photos + renders (consent withdrawal / right to
 * deletion, Principle 5). Contact-gated like recognition; rate-limited.
 */
export async function DELETE(req: Request) {
  if (!rateLimit(`photo-del:${clientIp(req)}`, 20, 60_000)) {
    return bad("Too many requests — please wait a moment.", 429);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }
  const contactRaw = (body as { contact?: unknown })?.contact;
  if (typeof contactRaw !== "string" || !isPlausibleContact(contactRaw)) {
    return bad("A valid phone or email is required.");
  }
  const client = await prisma.client.findUnique({
    where: { contact: normalizeContact(contactRaw) },
    include: { photos: { include: { renders: true } } },
  });
  if (!client) return NextResponse.json({ ok: true, deleted: 0 });

  for (const photo of client.photos) {
    for (const r of photo.renders) if (r.storageKey) await deleteObject(r.storageKey);
    await deleteObject(photo.storageKey);
  }
  await prisma.photo.deleteMany({ where: { clientId: client.id } }); // cascades renders
  await prisma.client.update({ where: { id: client.id }, data: { photoConsentAt: null } });

  return NextResponse.json({ ok: true, deleted: client.photos.length });
}

function toInt(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
