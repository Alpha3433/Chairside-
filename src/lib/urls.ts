/**
 * urls.ts — build absolute URLs for QR codes and the shareable spec link.
 *
 * The brief requires the spec sheet to be shareable as a link and reachable via
 * a QR code, regardless of the shop's booking system (platform-agnostic). QR
 * codes need an ABSOLUTE url, so we resolve a base URL from, in order:
 *   1. APP_URL (set this in production so QR points at your real domain), then
 *   2. the incoming request's forwarded host/proto (works in dev with no config),
 *   3. a localhost fallback.
 */

import { headers } from "next/headers";

export function getBaseUrl(): string {
  const fromEnv = (process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      // Loopback hosts have no TLS listener in dev, so default them to http
      // (otherwise QR/share links to 127.0.0.1 etc. would be unreachable).
      const hostname = host.split(":")[0].replace(/^\[|\]$/g, "");
      const isLocal = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
      const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() is only available in a request scope; fall through.
  }
  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  const base = getBaseUrl();
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** The link/QR a shop hands a client. */
export function shopClientPath(slug: string): string {
  return `/s/${slug}`;
}

/** The public, shareable spec link for a submitted brief. */
export function briefSharePath(briefId: string): string {
  return `/b/${briefId}`;
}
