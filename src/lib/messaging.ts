/**
 * messaging.ts — pluggable, FUNCTIONAL-ONLY customer messaging.
 *
 * The only thing we ever send a customer is the link to THEIR booking's brief.
 * No marketing (Principle: messaging is functional only). Provider is pluggable;
 * with no key it's a stub that logs and reports `sent: false`.
 */

export interface MessageInput {
  to: string; // phone or email (the customer's own booking contact)
  firstName?: string | null;
  shopName: string;
  link: string;
  appointmentAt?: Date | null;
}

export interface MessageResult {
  sent: boolean;
  stub: boolean;
  channel: "sms" | "email" | "none";
}

export function isMessagingEnabled(): boolean {
  return process.env.MESSAGING_ENABLED === "true" && !!process.env.MESSAGING_API_KEY;
}

function bodyFor(input: MessageInput): string {
  const when = input.appointmentAt
    ? ` for your ${input.appointmentAt.toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} appointment`
    : "";
  return `Hi${input.firstName ? " " + input.firstName : ""}, set up your cut at ${input.shopName}${when}: ${input.link}`;
}

export async function sendBookingLink(input: MessageInput): Promise<MessageResult> {
  const channel: "sms" | "email" = input.to.includes("@") ? "email" : "sms";
  const providerUrl = (process.env.MESSAGING_PROVIDER_URL || "").trim();

  if (!isMessagingEnabled() || !providerUrl) {
    // Stub: never silently pretend to send. The link is still attached to the
    // booking (Square) / returned to the Zap, so the flow works without SMS.
    console.log(`[messaging stub] would ${channel} ${input.to}: ${bodyFor(input)}`);
    return { sent: false, stub: true, channel };
  }

  try {
    const res = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.MESSAGING_API_KEY ?? ""}`,
      },
      body: JSON.stringify({ channel, to: input.to, body: bodyFor(input) }),
      signal: AbortSignal.timeout(15_000),
    });
    return { sent: res.ok, stub: false, channel };
  } catch {
    return { sent: false, stub: false, channel };
  }
}
