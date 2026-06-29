import { notFound, redirect } from "next/navigation";
import { isBarberAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BarberShell } from "@/components/barber/BarberShell";
import { ManualVisitForm } from "@/components/barber/ManualVisitForm";
import { Card, Badge } from "@/components/ui";
import { computeRetention, retentionWindowDays, formatPct } from "@/lib/retention";
import { maskContact, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RetentionPage({ params }: { params: { slug: string } }) {
  if (!isBarberAuthed()) redirect("/barber");
  const shop = await prisma.shop.findUnique({ where: { slug: params.slug } });
  if (!shop) notFound();

  const visits = await prisma.visit.findMany({
    where: { shopId: shop.id },
    include: { client: true },
    orderBy: { visitedAt: "desc" },
  });

  const windowDays = retentionWindowDays();
  const result = computeRetention(
    visits.map((v) => ({ clientId: v.clientId, briefed: v.briefed, visitedAt: v.visitedAt })),
    windowDays,
  );

  return (
    <BarberShell shopName={shop.name} shopSlug={shop.slug} active="retention">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Rebooking</h2>
        <Badge tone="neutral">{windowDays}-day window</Badge>
      </div>
      <p className="mb-5 text-xs text-neutral-400">
        Do clients who arrived with a Chairside brief come back more than those
        who didn&apos;t? This is the number the pilot exists to produce.
      </p>

      {/* The comparison */}
      <div className="grid gap-4 sm:grid-cols-2">
        <CohortCard
          title="Briefed clients"
          tone="green"
          rate={result.briefed.repeatRate}
          returned={result.briefed.returned}
          total={result.briefed.clients}
        />
        <CohortCard
          title="Non-briefed clients"
          tone="neutral"
          rate={result.nonBriefed.repeatRate}
          returned={result.nonBriefed.returned}
          total={result.nonBriefed.clients}
        />
      </div>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Lift from briefing</p>
          <span
            className={
              result.liftPoints >= 0
                ? "text-lg font-bold text-emerald-600"
                : "text-lg font-bold text-rose-600"
            }
          >
            {result.liftPoints >= 0 ? "+" : ""}
            {result.liftPoints} pts
          </span>
        </div>
        <div className="mt-3">
          <CompareBar
            briefed={result.briefed.repeatRate}
            nonBriefed={result.nonBriefed.repeatRate}
          />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Briefed clients return at {formatPct(result.briefed.repeatRate)} vs{" "}
          {formatPct(result.nonBriefed.repeatRate)} for non-briefed, over a{" "}
          {windowDays}-day window.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
          Honest caveat: a client&apos;s first visit needs a full window to have
          had the chance to produce a return, so very recent visits and small
          cohorts make early numbers noisy. {result.totalClients} clients /{" "}
          {result.totalVisits} visits counted so far.
        </p>
      </Card>

      {/* Manual baseline entry */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-ink">Log a non-briefed visit</h3>
        <p className="mb-3 text-xs text-neutral-400">
          Record walk-ins who didn&apos;t use Chairside, so the comparison above
          has a baseline. A repeat contact is recognised automatically.
        </p>
        <Card className="p-4">
          <ManualVisitForm shopSlug={shop.slug} />
        </Card>
      </div>

      {/* Recent visits */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-ink">Recent visits</h3>
        <div className="mt-3 space-y-2">
          {visits.slice(0, 12).map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{v.client.name}</span>
                <span className="text-xs text-neutral-400">{maskContact(v.client.contact)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={v.briefed ? "green" : "neutral"}>{v.briefed ? "Briefed" : "Non-briefed"}</Badge>
                <span className="text-xs text-neutral-400">{timeAgo(v.visitedAt)}</span>
              </div>
            </div>
          ))}
          {visits.length === 0 ? (
            <p className="text-sm text-neutral-500">No visits recorded yet.</p>
          ) : null}
        </div>
      </div>
    </BarberShell>
  );
}

function CohortCard({
  title,
  tone,
  rate,
  returned,
  total,
}: {
  title: string;
  tone: "green" | "neutral";
  rate: number;
  returned: number;
  total: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-600">{title}</p>
        <Badge tone={tone}>{total} clients</Badge>
      </div>
      <p className={tone === "green" ? "mt-2 text-3xl font-bold text-emerald-600" : "mt-2 text-3xl font-bold text-neutral-700"}>
        {formatPct(rate)}
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        {returned} of {total} returned within the window
      </p>
    </Card>
  );
}

function CompareBar({ briefed, nonBriefed }: { briefed: number; nonBriefed: number }) {
  return (
    <div className="space-y-2">
      <BarRow label="Briefed" value={briefed} color="bg-emerald-500" />
      <BarRow label="Non-briefed" value={nonBriefed} color="bg-neutral-400" />
    </div>
  );
}

function BarRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-neutral-500">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-700">
        {formatPct(value)}
      </span>
    </div>
  );
}
