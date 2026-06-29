import { prisma } from "@/lib/db";
import { PrimaryLink, Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const shops = await prisma.shop.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-neutral-400">
          Chairside
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink">
          Say exactly what you want, before you&apos;re in the chair.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          Build a precise haircut spec your barber can read in five seconds and
          trust — guard sizes, top length, fade, neckline. Structured, not
          guessed, and never reverse-engineered from a picture.
        </p>
      </header>

      <Card className="mb-6 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Try a shop (client side — no install, no account)
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          In a real shop you&apos;d arrive here via a link or QR code.
        </p>
        <ul className="mt-4 space-y-2">
          {shops.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-ink">{s.name}</p>
                <p className="text-xs text-neutral-400">/s/{s.slug}</p>
              </div>
              <PrimaryLink href={`/s/${s.slug}`}>Build a cut →</PrimaryLink>
            </li>
          ))}
        </ul>
        {shops.length === 0 ? (
          <p className="mt-3 text-sm text-rose-600">
            No shops seeded yet. Run <code>npm run db:seed</code>.
          </p>
        ) : null}
      </Card>

      <Card className="mb-6 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Barber dashboard
          </h2>
          <Badge tone="blue">Web login</Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Queue of incoming briefs, counter-propose, mark complete, and a
          retention dashboard comparing briefed vs. non-briefed return rates.
        </p>
        <div className="mt-4">
          <a
            href="/barber"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Open barber dashboard →
          </a>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Portability demo
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          A client profile is keyed to the person (phone/email), not the shop.
          Open <strong>Sharp &amp; Co</strong> and enter the contact{" "}
          <code className="rounded bg-neutral-100 px-1">jordan@example.com</code>{" "}
          — even though Jordan&apos;s history was built at Fade Lab, it travels
          with them and loads here.
        </p>
      </Card>

      <p className="mt-8 text-center text-xs text-neutral-400">
        MVP. Seeded specs are developer placeholders — a real barber must
        validate them before any pilot.
      </p>
    </main>
  );
}
