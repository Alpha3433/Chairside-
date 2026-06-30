import { notFound, redirect } from "next/navigation";
import { isBarberAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BarberShell } from "@/components/barber/BarberShell";
import { Card, Badge } from "@/components/ui";
import { squareEnabled } from "@/lib/booking/square";
import { getBaseUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_configured: "Square app credentials aren't set on the server yet (SQUARE_APP_ID / SQUARE_APP_SECRET).",
  denied: "Square connection was cancelled.",
  exchange_failed: "Couldn't complete the Square connection — please try again.",
  unknown_shop: "Shop not found.",
};

export default async function IntegrationsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { connected?: string; error?: string };
}) {
  if (!isBarberAuthed()) redirect("/barber");
  const shop = await prisma.shop.findUnique({ where: { slug: params.slug } });
  if (!shop) notFound();

  const square = await prisma.shopIntegration.findUnique({
    where: { shopId_platform: { shopId: shop.id, platform: "square" } },
  });
  const base = getBaseUrl();
  const deskUrl = `${base}/find/${shop.slug}`;
  const zapierUrl = `${base}/api/webhooks/zapier`;
  const squareConnected = !!square?.accessToken;

  return (
    <BarberShell shopName={shop.name} shopSlug={shop.slug} active="integrations">
      <h2 className="text-lg font-bold text-ink">Booking integrations</h2>
      <p className="mb-5 text-xs text-neutral-400">
        When a client books, send them a personalized link that already knows who they are — straight
        to scan + style, no contact entry. Coverage is tiered and honest: deep where the platform
        allows, trigger-based where webhooks exist, and a universal QR everywhere else.
      </p>

      {searchParams.connected ? (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Square connected ✓
        </div>
      ) : null}
      {searchParams.error ? (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {ERRORS[searchParams.error] ?? "Something went wrong."}
        </div>
      ) : null}

      {/* Tier 1 — Square */}
      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-ink">Square Appointments</p>
            <p className="text-xs text-neutral-400">Tier 1 · deep — read bookings &amp; attach the brief to the appointment</p>
          </div>
          {squareConnected ? (
            <Badge tone="green">Connected</Badge>
          ) : squareEnabled() ? (
            <Badge tone="amber">Not connected</Badge>
          ) : (
            <Badge tone="neutral">Server not configured</Badge>
          )}
        </div>
        {squareConnected ? (
          <p className="mt-2 text-xs text-neutral-500">
            Merchant <code>{square?.merchantId ?? "—"}</code>. New bookings now generate a personalized
            link and attach the brief back to the appointment.
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-neutral-500">
              We <strong>read + attach</strong> (we never create bookings), so the free Appointments
              plan is enough. You&apos;ll grant appointment + customer scopes.
            </p>
            <a
              href={`/api/integrations/square/connect?shop=${shop.slug}`}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Connect Square →
            </a>
            {!squareEnabled() ? (
              <p className="mt-2 text-[11px] text-neutral-400">
                Set <code>SQUARE_ENABLED=true</code> + app credentials on the server to enable the live
                connect.
              </p>
            ) : null}
          </>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
          Note: making a team member &quot;bookable&quot; is done by you in Square&apos;s dashboard and
          can&apos;t be automated. Custom-attribute scopes should be verified against current Square docs.
        </p>
      </Card>

      {/* Tier 2 — Booksy / Gettimely / others via Zapier */}
      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-ink">Booksy, Gettimely &amp; others, via Zapier</p>
            <p className="text-xs text-neutral-400">Tier 2 · trigger — a Zap/Make scenario posts new appointments to us</p>
          </div>
          <Badge tone={process.env.ZAPIER_WEBHOOK_SECRET ? "green" : "neutral"}>
            {process.env.ZAPIER_WEBHOOK_SECRET ? "Secret set" : "Add secret"}
          </Badge>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          <strong>Booksy</strong> and Gettimely have no open public API. If you can produce a
          &quot;new appointment&quot; trigger (Zapier / Make), POST it to:
        </p>
        <p className="mt-1 break-all rounded-lg bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700">
          POST {zapierUrl} <span className="text-neutral-400">(header X-Chairside-Secret)</span>
        </p>
        <p className="mt-2 text-[11px] text-neutral-400">
          Body: shopSlug=<code>{shop.slug}</code>, platform=<code>booksy</code>, firstName, lastName,
          phone or email, appointmentAt. We can&apos;t write back into the platform UI, so the
          personalized link goes to the client directly. No trigger available? The desk QR below
          covers Booksy too.
        </p>
      </Card>

      {/* Tier 3 — Fallback desk QR */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-ink">Desk QR (works everywhere)</p>
            <p className="text-xs text-neutral-400">Tier 3 · universal — Fresha, closed platforms, walk-ins</p>
          </div>
          <Badge tone="green">Always on</Badge>
        </div>
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr?text=${encodeURIComponent(deskUrl)}&size=320`}
            alt="Desk QR"
            width={148}
            height={148}
            className="h-36 w-36 rounded-lg border border-neutral-200 bg-white p-2"
          />
          <div className="min-w-0">
            <p className="break-all text-sm font-medium text-neutral-800">{deskUrl}</p>
            <p className="mt-2 text-xs text-neutral-500">
              Print it for the desk. A static QR can&apos;t know who scanned it, so it lands on a quick
              &quot;find your booking / I&apos;m a walk-in&quot; step — today&apos;s appointments to tap
              if Square is connected, otherwise first name + last 3 digits, or a fresh walk-in.
            </p>
          </div>
        </div>
      </Card>
    </BarberShell>
  );
}
