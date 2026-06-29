/**
 * clientHistory.ts — the portable, shop-agnostic cut history (Principle 4).
 *
 * History is keyed to the CLIENT, so it spans every shop the person has visited.
 * This is what travels with a returning client and makes leaving cost them their
 * record. Used by the client flow (recognition) and the barber dashboard.
 */

import { prisma } from "./db";
import { rowToSpec } from "./specSerialize";
import type { Spec } from "./spec";

export interface HistoryItem {
  briefId: string;
  shopName: string;
  shopSlug: string;
  status: string;
  useCaseTag: string;
  createdAt: Date;
  completedAt: Date | null;
  /** The spec that best represents this visit: actual if completed, else requested. */
  spec: Spec;
  summary: string;
  isActual: boolean;
}

export async function getClientByContact(contact: string) {
  return prisma.client.findUnique({ where: { contact } });
}

/** Full cross-shop history for a client, newest first. */
export async function getClientHistory(clientId: string): Promise<HistoryItem[]> {
  const briefs = await prisma.brief.findMany({
    where: { clientId },
    include: {
      shop: true,
      requestedSpec: true,
      actualSpec: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return briefs.map((b) => {
    const useActual = b.status === "completed" && b.actualSpec;
    const specRow = useActual ? b.actualSpec! : b.requestedSpec;
    return {
      briefId: b.id,
      shopName: b.shop.name,
      shopSlug: b.shop.slug,
      status: b.status,
      useCaseTag: b.useCaseTag,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
      spec: rowToSpec(specRow),
      summary: specRow.summaryText,
      isActual: !!useActual,
    };
  });
}
