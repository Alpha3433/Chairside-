import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { rowToSpec } from "@/lib/specSerialize";
import { SpecSheet } from "@/components/SpecSheet";
import { ShareSpec } from "@/components/ShareSpec";
import { Badge } from "@/components/ui";
import { LABELS, type HairType, type Density } from "@/lib/spec";
import { briefSharePath, getBaseUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const brief = await prisma.brief.findUnique({
    where: { id: params.id },
    include: { requestedSpec: true, actualSpec: true },
  });
  const spec = brief?.actualSpec ?? brief?.requestedSpec;
  return {
    title: "Cut spec · Chairside",
    description: spec?.summaryText ?? "A structured haircut spec.",
  };
}

/**
 * Public, read-only shareable spec page. This is the "shareable as a link" half
 * of the brief — reachable by anyone with the (unguessable) link, independent of
 * any booking system. The spec is rendered from structured data; the matching
 * image lives at /b/<id>/image.svg.
 */
export default async function PublicSpecPage({ params }: { params: { id: string } }) {
  const brief = await prisma.brief.findUnique({
    where: { id: params.id },
    include: { client: true, shop: true, requestedSpec: true, actualSpec: true },
  });
  if (!brief) notFound();

  const useActual = brief.status === "completed" && brief.actualSpec;
  const specRow = useActual ? brief.actualSpec! : brief.requestedSpec;
  const spec = rowToSpec(specRow);
  const firstName = brief.client.name.split(" ")[0];
  const path = briefSharePath(brief.id);
  const absoluteUrl = `${getBaseUrl()}${path}`;

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Chairside · shared spec
        </p>
        <Badge tone={useActual ? "green" : "neutral"}>
          {useActual ? "Completed" : LABELS.briefStatus[brief.status as keyof typeof LABELS.briefStatus] ?? brief.status}
        </Badge>
      </div>

      <h1 className="mb-1 text-xl font-bold text-ink">{firstName}&apos;s cut</h1>
      <p className="mb-4 text-sm text-neutral-500">
        For {brief.shop.name} · {LABELS.useCaseTag[brief.useCaseTag as keyof typeof LABELS.useCaseTag] ?? brief.useCaseTag}
      </p>

      <SpecSheet
        spec={spec}
        summary={specRow.summaryText}
        title={useActual ? "What was done" : "Requested spec"}
        hairContext={{
          hairType: brief.client.hairType as HairType,
          density: brief.client.density as Density,
        }}
        renderUrl={specRow.renderUrl}
        showIllustrationSlot={!!specRow.renderUrl}
      />

      {brief.notes ? (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Note</p>
          <p className="mt-0.5 text-sm text-amber-900">{brief.notes}</p>
        </div>
      ) : null}

      <div className="mt-5">
        <ShareSpec
          path={path}
          imagePath={`${path}/image.svg`}
          title={`${firstName}'s cut`}
          absoluteUrl={absoluteUrl}
        />
      </div>

      <p className="mt-6 text-center text-xs text-neutral-400">
        The numbers on this spec come from structured settings, never from a picture.
      </p>
    </main>
  );
}
