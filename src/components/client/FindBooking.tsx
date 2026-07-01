"use client";

/**
 * FindBooking — what the static desk QR lands on. With no booking context it
 * keeps friction minimal: tap today's appointment (if a readable platform is
 * connected), else first name + last 3 digits, else start as a walk-in. Each
 * path returns a personalized link the browser then opens (PII never in a URL).
 */

import { useState } from "react";
import { TextInput, Labeled } from "@/components/controls";
import { btn, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Appt {
  externalBookingId: string;
  firstName: string;
  time: string;
}

export function FindBooking({
  shopName,
  shopSlug,
  appointments,
}: {
  shopName: string;
  shopSlug: string;
  appointments: Appt[];
}) {
  // With no appointment list to tap (no readable platform connected — the
  // common Tier-3 case), land straight on the find form instead of an
  // interstitial: the form carries its own walk-in escape hatch.
  const [mode, setMode] = useState<"home" | "find">(appointments.length ? "home" : "find");
  const [firstName, setFirstName] = useState("");
  const [lastDigits, setLastDigits] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function call(payload: Record<string, unknown>, tag: string) {
    setBusy(tag);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch("/api/fallback/find", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopSlug, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (data.found === false) {
        setNotFound(true);
        return;
      }
      if (data.link) window.location.assign(data.link);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Chairside · {shopName}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Let&apos;s set up your cut</h1>
      <p className="mt-1 text-sm text-neutral-500">No app, no account — just find your booking or start fresh.</p>

      {error ? (
        <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
      ) : null}

      {appointments.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Today&apos;s appointments</p>
          <div className="space-y-2">
            {appointments.map((a) => (
              <button
                key={a.externalBookingId}
                type="button"
                disabled={busy !== null}
                onClick={() => call({ mode: "appointment", externalBookingId: a.externalBookingId }, a.externalBookingId)}
                className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left hover:border-neutral-900"
              >
                <span className="font-semibold text-ink">{a.firstName}</span>
                <span className="text-xs text-neutral-400">{a.time}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "home" ? (
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => setMode("find")}
            className={cn(btn.base, btn.secondary, "w-full")}
          >
            Find my booking
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => call({ mode: "walkin" }, "walkin")}
            className={cn(btn.base, btn.primary, "w-full")}
          >
            {busy === "walkin" ? "…" : "I'm a walk-in"}
          </button>
        </div>
      ) : (
        <form
          className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (firstName.trim() && lastDigits.length >= 3 && busy === null) {
              call({ mode: "find", firstName, lastDigits }, "find");
            }
          }}
        >
          <p className="text-sm font-semibold text-ink">Find your booking</p>
          <p className="mt-0.5 text-xs text-neutral-500">Just enough to recognise you — nothing typed twice.</p>
          <div className="mt-3 space-y-3">
            <Labeled label="First name">
              <TextInput
                value={firstName}
                onChange={setFirstName}
                placeholder="First name"
                name="given-name"
                autoComplete="given-name"
                enterKeyHint="next"
                autoFocus
              />
            </Labeled>
            <Labeled label="Last 3 digits of your phone">
              <TextInput
                value={lastDigits}
                onChange={(v) => setLastDigits(v.replace(/\D/g, "").slice(0, 3))}
                type="tel"
                inputMode="numeric"
                maxLength={3}
                enterKeyHint="go"
                placeholder="•••"
              />
            </Labeled>
          </div>
          {notFound ? (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
              Couldn&apos;t find a match. Double-check, or continue as a walk-in.
            </div>
          ) : null}
          <button
            type="submit"
            disabled={busy !== null || !firstName.trim() || lastDigits.length < 3}
            className={cn(btn.base, btn.primary, "mt-4 w-full")}
          >
            {busy === "find" ? "…" : "Continue"}
          </button>
          <div className="mt-2 flex items-center justify-between text-sm">
            <button type="button" onClick={() => setMode("home")} className="text-neutral-500 hover:text-neutral-800">
              ← Back
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => call({ mode: "walkin", firstName }, "walkin")}
              className="text-neutral-500 hover:text-neutral-800"
            >
              I&apos;m a walk-in
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-[11px] text-neutral-400">
        <Badge tone="neutral">Private</Badge> We only use this to recognise your booking. Your details
        are never in a link.
      </p>
    </main>
  );
}
