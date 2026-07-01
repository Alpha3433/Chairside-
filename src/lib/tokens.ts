/**
 * tokens.ts — the personalized-link token (the onboarding "vehicle").
 *
 * A static printed QR can't carry identity — everyone scans the same code. So
 * identity-bearing onboarding uses a PER-BOOKING token: opaque, random
 * (256-bit), short-TTL, and mapped server-side to {shop, client, booking}. The
 * token is the ONLY thing in the URL (/go/<token>) — never name/phone/email/ids.
 */

import { randomBytes } from "crypto";

export function generateToken(): string {
  // 32 bytes = 256-bit, URL-safe, unguessable.
  return randomBytes(32).toString("base64url");
}

export function tokenTtlDays(): number {
  const v = Number(process.env.BOOKING_TOKEN_TTL_DAYS);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 14;
}

export function tokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + tokenTtlDays() * 24 * 60 * 60 * 1000);
}

export interface TokenLike {
  status: string;
  expiresAt: Date;
}

export function isUsable(t: TokenLike, now: Date = new Date()): boolean {
  return t.status !== "expired" && t.expiresAt.getTime() > now.getTime();
}

/** Trailing digits of a phone contact (for the light confirmation gate). */
export function phoneTail(contact: string | null | undefined, n = 3): string | null {
  // Only genuine phone-shaped contacts qualify. Synthetic keys (e.g. the
  // "walkin:<random>" contact minted for contactless walk-ins) contain letters
  // and would otherwise present a digits gate the user can never pass.
  if (!contact || contact.includes("@")) return null;
  if (!/^\+?[\d\s\-().]+$/.test(contact)) return null;
  const digits = contact.replace(/\D/g, "");
  return digits.length >= n ? digits.slice(-n) : null;
}

/**
 * Whether the provided trailing digits match the client's phone. Used to gate
 * the reveal of anything beyond first name + appointment time, so a forwarded
 * link can't trivially expose someone's data.
 */
export function digitsMatch(contact: string | null | undefined, provided: string): boolean {
  const tail = phoneTail(contact, 3);
  if (!tail) return false;
  const p = (provided || "").replace(/\D/g, "");
  return p.length >= 3 && p.slice(-3) === tail;
}
