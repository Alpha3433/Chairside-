/**
 * auth.ts — MVP-level barber dashboard gate.
 *
 * Intentionally lightweight: a single shared access code (BARBER_ACCESS_CODE)
 * unlocks the dashboard for a pilot shop. This is NOT production multi-tenant
 * auth — see Non-goals. The clean seam is here: swap this for per-barber magic
 * links / sessions without touching the pages, which only call `isBarberAuthed`.
 */

import { cookies } from "next/headers";

export const BARBER_COOKIE = "chairside_barber";
const COOKIE_OK = "ok";

export function expectedAccessCode(): string {
  return process.env.BARBER_ACCESS_CODE || "letmein";
}

/** Constant-time-ish comparison to discourage trivial timing games. */
export function codeMatches(submitted: string): boolean {
  const a = submitted ?? "";
  const b = expectedAccessCode();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Read-only check used by server components / route handlers. */
export function isBarberAuthed(): boolean {
  return cookies().get(BARBER_COOKIE)?.value === COOKIE_OK;
}

export const COOKIE_VALUE_OK = COOKIE_OK;
