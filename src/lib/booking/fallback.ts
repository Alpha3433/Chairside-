/**
 * booking/fallback.ts — Tier 3 (universal) adapter: the static desk QR.
 *
 * A static QR can't carry identity, so it lands on a minimal "find your booking
 * / I'm a walk-in" step. This adapter is intentionally thin — the real work is
 * the shared onboard pipeline. It exists so every shop, including closed
 * platforms (Fresha) and walk-ins, has a working path with ZERO integration.
 */

import { prisma } from "../db";
import type { BookingAdapter } from "./types";
import { phoneTail } from "../tokens";

export const FallbackAdapter: BookingAdapter = {
  platform: "fallback",
  isConfigured: () => true, // always available — no platform needed
};

/**
 * The minimum-disambiguator match (only used when there is genuinely no booking
 * context): a returning client whose first name matches and whose phone ends
 * with the given digits. Scoped to people who have history at THIS shop, so a
 * stranger can't fish for arbitrary profiles.
 */
export async function findReturningClient(
  shopId: string,
  firstName: string,
  lastDigits: string,
): Promise<{ id: string; name: string } | null> {
  const fn = firstName.trim().toLowerCase();
  const digits = lastDigits.replace(/\D/g, "").slice(-3);
  if (!fn || digits.length < 3) return null;

  const candidates = await prisma.client.findMany({
    where: {
      OR: [{ briefs: { some: { shopId } } }, { visits: { some: { shopId } } }],
    },
    select: { id: true, name: true, contact: true },
    take: 200,
  });

  const match = candidates.find(
    (c) => c.name.trim().toLowerCase().split(" ")[0] === fn && phoneTail(c.contact, 3) === digits,
  );
  return match ? { id: match.id, name: match.name } : null;
}
