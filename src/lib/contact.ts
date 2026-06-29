/**
 * Normalise a contact (phone or email) into the canonical portable key.
 * The SAME person must produce the SAME key at any shop — that is the whole
 * portability moat — so normalisation has to be stable and total.
 */
export function normalizeContact(raw: string): string {
  const t = (raw ?? "").trim();
  if (t.includes("@")) return t.toLowerCase();
  // phone: keep a leading +, drop spaces / dashes / parens
  const plus = t.startsWith("+") ? "+" : "";
  return plus + t.replace(/[^\d]/g, "");
}

export function isPlausibleContact(raw: string): boolean {
  const t = normalizeContact(raw);
  if (t.includes("@")) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t);
  return t.replace(/\D/g, "").length >= 6;
}
