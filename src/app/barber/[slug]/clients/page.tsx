import { notFound, redirect } from "next/navigation";
import { isBarberAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BarberShell } from "@/components/barber/BarberShell";
import { Card, Badge } from "@/components/ui";
import { LABELS } from "@/lib/spec";
import { maskContact, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ params }: { params: { slug: string } }) {
  if (!isBarberAuthed()) redirect("/barber");
  const shop = await prisma.shop.findUnique({ where: { slug: params.slug } });
  if (!shop) notFound();

  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { briefs: { some: { shopId: shop.id } } },
        { visits: { some: { shopId: shop.id } } },
      ],
    },
    include: {
      briefs: {
        where: { shopId: shop.id },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { requestedSpec: true, actualSpec: true },
      },
      _count: { select: { briefs: true, visits: true } },
    },
  });

  // Most-recently-active first.
  clients.sort((a, b) => {
    const at = a.briefs[0]?.createdAt.getTime() ?? 0;
    const bt = b.briefs[0]?.createdAt.getTime() ?? 0;
    return bt - at;
  });

  return (
    <BarberShell shopName={shop.name} shopSlug={shop.slug} active="clients">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Clients</h2>
        <Badge tone="neutral">{clients.length}</Badge>
      </div>
      <p className="mb-5 text-xs text-neutral-400">
        Counts span every shop — the profile is portable and keyed to the
        client&apos;s contact.
      </p>

      <div className="space-y-3">
        {clients.map((c) => {
          const latest = c.briefs[0];
          const latestSpec = latest?.actualSpec ?? latest?.requestedSpec ?? null;
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{c.name}</span>
                    <span className="text-xs text-neutral-400">{maskContact(c.contact)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {LABELS.hairType[c.hairType as keyof typeof LABELS.hairType]} ·{" "}
                    {LABELS.density[c.density as keyof typeof LABELS.density]} density · {c._count.visits} visit
                    {c._count.visits === 1 ? "" : "s"} · {c._count.briefs} brief
                    {c._count.briefs === 1 ? "" : "s"} (all shops)
                  </p>
                  {latestSpec ? (
                    <p className="mt-1.5 truncate text-sm text-neutral-600">{latestSpec.summaryText}</p>
                  ) : (
                    <p className="mt-1.5 text-sm text-neutral-400">Non-briefed visit on record.</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {latest ? (
                    <>
                      <span className="text-xs text-neutral-400">{formatDate(latest.createdAt)}</span>
                      <a
                        href={`/barber/${shop.slug}/brief/${latest.id}`}
                        className="text-xs font-semibold text-neutral-800 hover:underline"
                      >
                        Open latest →
                      </a>
                    </>
                  ) : (
                    <Badge tone="neutral">No brief</Badge>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </BarberShell>
  );
}
