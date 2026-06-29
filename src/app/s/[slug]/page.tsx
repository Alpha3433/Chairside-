import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseSpecJson } from "@/lib/specSerialize";
import { generateSummary } from "@/lib/specSummary";
import { isRenderEnabled } from "@/lib/render";
import { ClientFlow, type BaseStyleOption } from "@/components/client/ClientFlow";

export const dynamic = "force-dynamic";

export default async function ShopPage({ params }: { params: { slug: string } }) {
  const shop = await prisma.shop.findUnique({ where: { slug: params.slug } });
  if (!shop) notFound();

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

  return (
    <ClientFlow
      shopName={shop.name}
      shopSlug={shop.slug}
      baseStyles={baseStyles}
      renderEnabled={isRenderEnabled()}
    />
  );
}
