import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseSpecJson } from "@/lib/specSerialize";
import { generateSummary } from "@/lib/specSummary";
import { isRenderEnabled, isVisualizationEnabled } from "@/lib/render";
import { loadToken } from "@/lib/onboard";
import { isUsable, phoneTail } from "@/lib/tokens";
import { GoOnboarding } from "@/components/client/GoOnboarding";
import type { BaseStyleOption } from "@/components/client/ClientFlow";

export const dynamic = "force-dynamic";

/**
 * The personalized-link landing. Resolves the token SERVER-SIDE and shows only
 * what's needed to orient the user — first name + appointment time — NOT contact
 * details. A light confirmation gate (last digits of phone, or an appointment
 * tap) must pass before the flow proceeds. No PII is ever in the URL.
 */
export default async function GoPage({ params }: { params: { token: string } }) {
  const tok = await loadToken(params.token);

  if (!tok || !isUsable(tok) || !tok.client) {
    return <Expired />;
  }

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

  // We pass ONLY a first name + appointment time + whether a phone is on file.
  // The actual contact/hair context is revealed by the confirm route, after the
  // gate passes — and the contact never reaches the browser at all.
  return (
    <GoOnboarding
      token={tok.token}
      shopName={tok.shop.name}
      shopSlug={tok.shop.slug}
      firstName={tok.customerFirstName ?? tok.client.name.split(" ")[0] ?? null}
      appointmentAt={tok.appointmentAt ? tok.appointmentAt.toISOString() : null}
      hasPhone={!!phoneTail(tok.client.contact)}
      baseStyles={baseStyles}
      renderEnabled={isRenderEnabled()}
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
