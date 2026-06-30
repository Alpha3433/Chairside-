"use client";

/**
 * GoOnboarding — what a personalized link opens to. Greets the booked client by
 * first name + appointment time (the only things revealed pre-confirmation),
 * gates with a light identity check, then drops them straight into the SAME
 * client flow with NO contact entry (prefilled, bookingToken-carried).
 */

import { useState } from "react";
import { ClientFlow, type BaseStyleOption } from "./ClientFlow";
import { TextInput, Labeled } from "@/components/controls";
import { btn } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Prefill {
  name: string;
  hairType: string;
  density: string;
  faceShape: string | null;
}

export function GoOnboarding({
  token,
  shopName,
  shopSlug,
  firstName,
  appointmentAt,
  hasPhone,
  baseStyles,
  renderEnabled,
  visualizationEnabled,
}: {
  token: string;
  shopName: string;
  shopSlug: string;
  firstName: string | null;
  appointmentAt: string | null;
  hasPhone: boolean;
  baseStyles: BaseStyleOption[];
  renderEnabled: boolean;
  visualizationEnabled: boolean;
}) {
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apptLabel = appointmentAt
    ? new Date(appointmentAt).toLocaleString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tokens/${token}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(hasPhone ? { digits } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't confirm.");
        return;
      }
      setPrefill(data.prefill as Prefill);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (prefill) {
    return (
      <ClientFlow
        shopName={shopName}
        shopSlug={shopSlug}
        baseStyles={baseStyles}
        renderEnabled={renderEnabled}
        visualizationEnabled={visualizationEnabled}
        prefill={{
          name: prefill.name,
          hairType: prefill.hairType,
          density: prefill.density,
          faceShape: prefill.faceShape ?? "",
        }}
        bookingToken={token}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Chairside · {shopName}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-ink">
        Hi{firstName ? ` ${firstName}` : ""} 👋
      </h1>
      <p className="mt-1 text-sm text-neutral-600">
        You&apos;re booked at {shopName}
        {apptLabel ? ` — ${apptLabel}` : ""}. Let&apos;s set up your cut. No typing your details —
        we already know it&apos;s your booking.
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
        {hasPhone ? (
          <>
            <p className="text-sm font-semibold text-ink">Quick check it&apos;s you</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Enter the last 3 digits of your phone number.
            </p>
            <div className="mt-3">
              <Labeled label="Last 3 digits">
                <TextInput value={digits} onChange={(v) => setDigits(v.replace(/\D/g, "").slice(0, 3))} type="tel" placeholder="•••" />
              </Labeled>
            </div>
            {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
            <button
              type="button"
              onClick={confirm}
              disabled={busy || digits.length < 3}
              className={cn(btn.base, btn.primary, "mt-4 w-full")}
            >
              {busy ? "…" : "That's me — continue"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">Confirm it&apos;s you</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {apptLabel ? `You're booked for ${apptLabel}.` : "Confirm this is your booking."}
            </p>
            {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className={cn(btn.base, btn.primary, "mt-4 w-full")}
            >
              {busy ? "…" : "Yes, that's me — continue"}
            </button>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-neutral-400">
        We only show your first name and appointment until you confirm. Your contact details are
        never in this link.
      </p>
    </main>
  );
}
