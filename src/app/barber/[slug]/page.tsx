import { notFound, redirect } from "next/navigation";
import { isBarberAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BarberShell } from "@/components/barber/BarberShell";
import { Card, Badge } from "@/components/ui";
import { LABELS } from "@/lib/spec";
import { timeAgo, maskContact } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<string, number> = {
  submitted: 0,
  seen: 1,
  counter_proposed: 2,
  completed: 3,
};
const STATUS_TONE: Record<string, "amber" | "blue" | "purple" | "green"> = {
  submitted: "amber",
  seen: "blue",
  counter_proposed: "purple",
  completed: "green",
};

export default async function QueuePage({ params }: { params: { slug: string } }) {
  if (!isBarberAuthed()) redirect("/barber");
  const shop = await prisma.shop.findUnique({ where: { slug: params.slug } });
  if (!shop) notFound();

  const briefs = await prisma.brief.findMany({
    where: { shopId: shop.id },
    include: {
      client: { include: { _count: { select: { visits: true, briefs: true } } } },
      requestedSpec: true,
    },
    orderBy: { createdAt: "desc" },
  });

  briefs.sort((a, b) => {
    const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    return s !== 0 ? s : b.createdAt.getTime() - a.createdAt.getTime();
  });

  const waiting = briefs.filter((b) => b.status === "submitted" || b.status === "seen").length;

  return (
    <BarberShell shopName={shop.name} shopSlug={shop.slug} active="queue">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Incoming briefs</h2>
        <Badge tone={waiting > 0 ? "amber" : "neutral"}>{waiting} waiting</Badge>
      </div>

      {briefs.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No briefs yet. Share <code>/s/{shop.slug}</code> with clients.
        </p>
      ) : (
        <div className="space-y-3">
          {briefs.map((b) => (
            <a key={b.id} href={`/barber/${shop.slug}/brief/${b.id}`} className="block">
              <Card className="p-4 transition hover:border-neutral-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{b.client.name}</span>
                      <span className="text-xs text-neutral-400">{maskContact(b.client.contact)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-neutral-600">{b.requestedSpec.summaryText}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
                      <span>{LABELS.hairType[b.client.hairType as keyof typeof LABELS.hairType]}</span>
                      <span>·</span>
                      <span>{LABELS.density[b.client.density as keyof typeof LABELS.density]} density</span>
                      <span>·</span>
                      <span>{b.client._count.visits} prior visit{b.client._count.visits === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{timeAgo(b.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>
                      {LABELS.briefStatus[b.status as keyof typeof LABELS.briefStatus] ?? b.status}
                    </Badge>
                    <Badge tone="neutral">{LABELS.useCaseTag[b.useCaseTag as keyof typeof LABELS.useCaseTag] ?? b.useCaseTag}</Badge>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </BarberShell>
  );
}
