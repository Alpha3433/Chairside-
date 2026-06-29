/** Small date/format helpers used across the dashboard. */

export function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Mask a contact for at-a-glance display (privacy in a shared dashboard). */
export function maskContact(contact: string): string {
  if (contact.includes("@")) {
    const [u, d] = contact.split("@");
    const head = u.slice(0, 2);
    return `${head}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
  }
  const digits = contact.replace(/\D/g, "");
  return digits.length > 3 ? `•••${digits.slice(-3)}` : contact;
}
