import { notFound, redirect } from "next/navigation";
import { isBarberAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rowToSpec } from "@/lib/specSerialize";
import { getClientHistory } from "@/lib/clientHistory";
import { SpecSheet } from "@/components/SpecSheet";
import { BriefActions } from "@/components/barber/BriefActions";
import { BarberShell } from "@/components/barber/BarberShell";
import { Badge, Card } from "@/components/ui";
import { LABELS, type HairType, type Density } from "@/lib/spec";
import { formatDate, timeAgo } from "@/lib/format";
import { briefSharePath } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default async function BriefDetail({
  params,
}: {
  params: { slug: string; id: string };
}) {
  if (!isBarberAuthed()) redirect("/barber");
  const shop = await prisma.shop.findUnique({ where: { slug: params.slug } });
  if (!shop) notFound();

  const brief = await prisma.brief.findUnique({
    where: { id: params.id },
    include: { client: true, requestedSpec: true, barberSpec: true, actualSpec: true },
  });
  if (!brief || brief.shopId !== shop.id) notFound();

  const hairContext = {
    hairType: brief.client.hairType as HairType,
    density: brief.client.density as Density,
  };
  const requestedSpec = rowToSpec(brief.requestedSpec);
  const barberSpec = brief.barberSpec ? rowToSpec(brief.barberSpec) : null;
  const actualSpec = brief.actualSpec ? rowToSpec(brief.actualSpec) : null;

  const history = (await getClientHistory(brief.client.id)).filter((h) => h.briefId !== brief.id);

  return (
    <BarberShell shopName={shop.name} shopSlug={shop.slug} active="queue">
      <a href={`/barber/${shop.slug}`} className="text-sm text-neutral-400 hover:text-neutral-700">
        ← Back to queue
      </a>

      {/* Client header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink">{brief.client.name}</h2>
          <p className="text-sm text-neutral-500">{brief.client.contact}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {LABELS.hairType[hairContext.hairType]} · {LABELS.density[hairContext.density]} density
            {brief.client.faceShape ? ` · ${LABELS.faceShape[brief.client.faceShape as keyof typeof LABELS.faceShape]} face` : ""}
            {" · submitted "}
            {timeAgo(brief.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone="purple">{LABELS.useCaseTag[brief.useCaseTag as keyof typeof LABELS.useCaseTag] ?? brief.useCaseTag}</Badge>
          <Badge tone="neutral">{LABELS.briefStatus[brief.status as keyof typeof LABELS.briefStatus] ?? brief.status}</Badge>
          <a
            href={briefSharePath(brief.id)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800"
          >
            Open shareable spec ↗
          </a>
        </div>
      </div>

      {brief.notes ? (
        <Card className="mt-4 bg-amber-50 p-3 ring-amber-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Client note</p>
          <p className="mt-0.5 text-sm text-amber-900">{brief.notes}</p>
        </Card>
      ) : null}

      {/* Specs */}
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Requested</p>
          <SpecSheet
            spec={requestedSpec}
            summary={brief.requestedSpec.summaryText}
            title="Requested by client"
            hairContext={hairContext}
            renderUrl={brief.requestedSpec.renderUrl}
            showIllustrationSlot={!!brief.requestedSpec.renderUrl}
          />
        </div>
        {barberSpec ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-500">Your counter-proposal</p>
            <SpecSheet spec={barberSpec} summary={brief.barberSpec!.summaryText} title="Closest achievable" hairContext={hairContext} />
            {brief.barberNote ? (
              <Card className="mt-2 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Your note</p>
                <p className="mt-0.5 text-sm text-neutral-700">{brief.barberNote}</p>
              </Card>
            ) : null}
          </div>
        ) : null}
        {actualSpec ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">What was actually done</p>
            <SpecSheet spec={actualSpec} summary={brief.actualSpec!.summaryText} title="Actual cut" hairContext={hairContext} />
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="mt-6">
        <BriefActions
          shopSlug={shop.slug}
          briefId={brief.id}
          status={brief.status}
          requestedSpec={requestedSpec}
          barberSpec={barberSpec}
          hairContext={hairContext}
        />
      </div>

      {/* Portable history */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-ink">Client history (all shops)</h3>
        <p className="text-xs text-neutral-400">
          This travels with the client — it&apos;s keyed to their contact, not your shop.
        </p>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No other visits on record.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((h) => (
              <Card key={h.briefId} className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{h.shopName}</span>
                  <span className="text-xs text-neutral-400">
                    {h.completedAt ? formatDate(h.completedAt) : formatDate(h.createdAt)}
                    {h.shopSlug !== shop.slug ? " · other shop" : ""}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-neutral-600">{h.summary}</p>
                <div className="mt-1 flex gap-1.5">
                  <Badge tone={h.isActual ? "green" : "neutral"}>
                    {h.isActual ? "Completed" : LABELS.briefStatus[h.status as keyof typeof LABELS.briefStatus] ?? h.status}
                  </Badge>
                  <Badge tone="neutral">{LABELS.useCaseTag[h.useCaseTag as keyof typeof LABELS.useCaseTag] ?? h.useCaseTag}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </BarberShell>
  );
}
