/**
 * rateLimit.ts — best-effort, in-memory, per-key rate limiter (MVP-level).
 *
 * This is a speed bump to blunt brute-force enumeration, NOT a real limiter:
 * in a multi-instance / serverless deploy the counters live per-instance and
 * reset on restart. A pilot should put a proper distributed limiter (or, better,
 * possession-verified recognition — see clients/lookup) in front of public
 * endpoints. Kept tiny and dependency-free on purpose.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Returns true if the call is allowed, false if the key is over its budget. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  // Opportunistic prune so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

/** Best-effort client IP from proxy headers (for keying the limiter). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
