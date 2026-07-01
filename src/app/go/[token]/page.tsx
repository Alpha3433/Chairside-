import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseSpecJson } from "@/lib/specSerialize";
import { generateSummary } from "@/lib/specSummary";
import { isVisualizationEnabled } from "@/lib/render";
import { loadToken } from "@/lib/onboard";
import { isUsable, phoneTail } from "@/lib/tokens";
import { briefSharePath } from "@/lib/urls";
import { GoOnboarding } from "@/components/client/GoOnboarding";
import { ClientFlow, type BaseStyleOption } from "@/components/client/ClientFlow";

export const dynamic = "force-dynamic";

/**
 * The personalized-link landing. Resolves the token SERVER-SIDE — no PII is
 * ever in the URL — and branches on token state to keep friction minimal:
 *
 *  - consumed  → the brief already exists; go straight to its spec page
 *                (reopening the link must never dead-end at a 409 later).
 *  - confirmed → identity was already proven (the /find disambiguator, or a
 *                walk-in with nothing to gate) — drop straight into the flow
 *                with zero contact entry and NO redundant "is this you?" tap.
 *  - pending   → show only first name + appointment time, gated by the light
 *                confirmation (last phone digits) before anything else.
 */
export default async function GoPage({ params }: { params: { token: string } }) {
  const tok = await loadToken(params.token);
  if (!tok || !tok.client) return <Expired />;

  // Already submitted: reopening the link should land on the finished spec.
  if (tok.status === "consumed") {
    const brief = await prisma.brief.findFirst({
      where: { bookingTokenId: tok.id },
      select: { id: true },
    });
    if (brief) redirect(briefSharePath(brief.id));
    return <Expired />;
  }

  if (!isUsable(tok)) return <Expired />;

  const bases = await prisma.baseStyle.findMany({ orderBy: { name: "asc" } });
  const baseStyles: BaseStyleOption[] = bases.map((b) => {
    const spec = parseSpecJson(b.defaultSpecJson);
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      tags: b.tags.split(",").filter(Boolean),
      barberValidated: b.barberValidated,
      spec,
      summary: generateSummary(spec),
    };
  });

  // Identity already proven — skip the gate entirely and prefill server-side
  // (the contact itself never reaches the browser in this mode).
  if (tok.status === "confirmed") {
    return (
      <ClientFlow
        shopName={tok.shop.name}
        shopSlug={tok.shop.slug}
        baseStyles={baseStyles}
        visualizationEnabled={isVisualizationEnabled()}
        prefill={{
          name: tok.client.name,
          hairType: tok.client.hairType,
          density: tok.client.density,
          faceShape: tok.client.faceShape ?? "",
        }}
        bookingToken={tok.token}
      />
    );
  }

  // Pending: reveal only a first name + appointment time until confirmed.
  return (
    <GoOnboarding
      token={tok.token}
      shopName={tok.shop.name}
      shopSlug={tok.shop.slug}
      firstName={tok.customerFirstName ?? tok.client.name.split(" ")[0] ?? null}
      appointmentAt={tok.appointmentAt ? tok.appointmentAt.toISOString() : null}
      hasPhone={!!phoneTail(tok.client.contact)}
      baseStyles={baseStyles}
      visualizationEnabled={isVisualizationEnabled()}
    />
  );
}

function Expired() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Chairside</p>
      <h1 className="mt-2 text-xl font-bold text-ink">This link has expired</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Personalized links are single-use and time-limited for your privacy. Ask your shop for a
        fresh link, or open the shop&apos;s QR to start as a walk-in.
      </p>
    </main>
  );
}
