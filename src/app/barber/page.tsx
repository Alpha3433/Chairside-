import { isBarberAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BarberLogin } from "@/components/barber/BarberLogin";
import { LogoutButton } from "@/components/barber/LogoutButton";
import { Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BarberHome() {
  if (!isBarberAuthed()) return <BarberLogin />;

  const shops = await prisma.shop.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { briefs: true } },
      briefs: { where: { status: { in: ["submitted", "seen"] } }, select: { id: true } },
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Chairside · Barber
          </p>
          <h1 className="mt-1 text-2xl font-bold text-ink">Choose a shop</h1>
        </div>
        <LogoutButton />
      </div>
      <div className="space-y-3">
        {shops.map((s) => (
          <a key={s.id} href={`/barber/${s.slug}`} className="block">
            <Card className="flex items-center justify-between p-4 transition hover:border-neutral-900">
              <div>
                <p className="font-semibold text-ink">{s.name}</p>
                <p className="text-xs text-neutral-400">{s._count.briefs} briefs total</p>
              </div>
              {s.briefs.length > 0 ? (
                <Badge tone="amber">{s.briefs.length} waiting</Badge>
              ) : (
                <Badge tone="neutral">Clear</Badge>
              )}
            </Card>
          </a>
        ))}
      </div>
    </main>
  );
}
