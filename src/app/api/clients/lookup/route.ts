import { NextResponse } from "next/server";
import { normalizeContact, isPlausibleContact } from "@/lib/contact";
import { getClientByContact, getClientHistory } from "@/lib/clientHistory";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recognise a returning client by their portable contact key — including across
 * shops — and return their cut history. This powers the live portability demo
 * (Principle 4 / acceptance criterion 2): a person who enters their own contact
 * at any shop sees the history that travels with them.
 *
 * PRIVACY NOTE (intentional MVP trade-off): the brief's recognition model is
 * "name + phone/email, no account", so possession of the contact is the only
 * key. That means anyone who knows a person's contact can see their (minimal)
 * history. We blunt brute-force enumeration with a rate limit and never echo the
 * contact back, but the real production fix is possession verification — a
 * one-time code to the phone/email before returning history. That belongs at
 * this exact seam; the rest of the flow already only needs name + hair context.
 */
export async function POST(req: Request) {
  if (!rateLimit(`lookup:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Too many lookups — please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const contactRaw = (body as { contact?: unknown })?.contact;
  if (typeof contactRaw !== "string" || !isPlausibleContact(contactRaw)) {
    return NextResponse.json({ error: "A valid phone or email is required." }, { status: 400 });
  }

  const contact = normalizeContact(contactRaw);
  const client = await getClientByContact(contact);
  if (!client) return NextResponse.json({ found: false });

  const history = await getClientHistory(client.id);
  return NextResponse.json({
    found: true,
    client: {
      // Note: `contact` is deliberately NOT echoed back — the caller typed it,
      // and re-emitting it only widens the data the endpoint discloses.
      id: client.id,
      name: client.name,
      hairType: client.hairType,
      density: client.density,
      faceShape: client.faceShape,
    },
    history: history.map((h) => ({
      briefId: h.briefId,
      shopName: h.shopName,
      status: h.status,
      useCaseTag: h.useCaseTag,
      createdAt: h.createdAt,
      summary: h.summary,
      isActual: h.isActual,
    })),
  });
}
