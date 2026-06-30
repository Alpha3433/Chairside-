import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SquareAdapter } from "@/lib/booking/square";
import { FindBooking } from "@/components/client/FindBooking";

export const dynamic = "force-dynamic";

/**
 * The static desk-QR landing (Tier 3). If the shop has a readable platform
 * connected (Square), we show today's appointments to tap; otherwise the
 * FindBooking component falls back to the minimum disambiguator / walk-in.
 */
export default async function FindPage({ params }: { params: { slug: string } }) {
  const shop = await prisma.shop.findUnique({ where: { slug: params.slug } });
  if (!shop) notFound();

  const integ = await prisma.shopIntegration.findUnique({
    where: { shopId_platform: { shopId: shop.id, platform: "square" } },
  });

  let appointments: { externalBookingId: string; firstName: string; time: string }[] = [];
  if (integ?.accessToken && SquareAdapter.listAppointments) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const list = await SquareAdapter.listAppointments(shop.id, start, end);
    appointments = list
      .filter((b) => b.customer.firstName)
      .map((b) => ({
        externalBookingId: b.externalBookingId,
        firstName: b.customer.firstName ?? "Guest",
        time: b.appointmentAt
          ? b.appointmentAt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
          : "",
      }));
  }

  return <FindBooking shopName={shop.name} shopSlug={shop.slug} appointments={appointments} />;
}
