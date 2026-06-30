import { prisma } from "@/lib/db";
import { rowToSpec } from "@/lib/specSerialize";
import { buildSpecCardSvg } from "@/lib/specCard";
import type { HairType, Density } from "@/lib/spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The shareable spec as an IMAGE (SVG). Deterministically generated FROM the
 * structured spec (Principle 3) — no AI, no pixel input. For a completed brief
 * we show the actual cut; otherwise the requested spec.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const brief = await prisma.brief.findUnique({
    where: { id: params.id },
    include: { client: true, requestedSpec: true, actualSpec: true },
  });
  if (!brief) {
    return new Response("Not found", { status: 404 });
  }

  const useActual = brief.status === "completed" && brief.actualSpec;
  const specRow = useActual ? brief.actualSpec! : brief.requestedSpec;
  const spec = rowToSpec(specRow);

  const svg = buildSpecCardSvg({
    spec,
    summary: specRow.summaryText,
    title: brief.client.name ? `${brief.client.name}'s cut` : "Cut spec",
    subtitle: useActual ? "What was done at the chair" : "Requested spec",
    hairType: brief.client.hairType as HairType,
    density: brief.client.density as Density,
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
