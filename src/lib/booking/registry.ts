/**
 * booking/registry.ts — resolve an adapter by platform and dispatch attach-back.
 */

import type { BookingAdapter, AttachResult } from "./types";
import { SquareAdapter } from "./square";
import { ZapierAdapter } from "./zapier";
import { FallbackAdapter } from "./fallback";

export function getAdapter(platform: string): BookingAdapter {
  switch (platform) {
    case "square":
      return SquareAdapter;
    case "zapier":
      return ZapierAdapter;
    default:
      return FallbackAdapter;
  }
}

export const ADAPTERS: BookingAdapter[] = [SquareAdapter, ZapierAdapter, FallbackAdapter];

/** Attach a labelled link to the platform dashboard (Tier 1 only; others no-op → null). */
export async function attachLink(args: {
  platform: string;
  shopId: string;
  externalBookingId?: string | null;
  externalCustomerId?: string | null;
  key: string;
  label: string;
  url: string;
}): Promise<AttachResult | null> {
  const adapter = getAdapter(args.platform);
  if (!adapter.attachLink) return null;
  return adapter.attachLink(args);
}
