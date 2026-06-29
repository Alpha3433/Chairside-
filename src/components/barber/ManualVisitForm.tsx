"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextInput, Labeled } from "@/components/controls";
import { btn } from "@/components/ui";
import { cn } from "@/lib/cn";
import { isPlausibleContact } from "@/lib/contact";

/**
 * Log a non-briefed visit so the pilot can build the baseline cohort the
 * retention metric compares against.
 */
export function ManualVisitForm({ shopSlug }: { shopSlug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ok = name.trim().length > 0 && isPlausibleContact(contact);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopSlug, name, contact, visitedAt: date || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed.");
        return;
      }
      setName("");
      setContact("");
      setDate("");
      setDone(true);
      router.refresh();
      setTimeout(() => setDone(false), 2500);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Labeled label="Name">
          <TextInput value={name} onChange={setName} placeholder="Client name" />
        </Labeled>
        <Labeled label="Phone or email">
          <TextInput value={contact} onChange={setContact} placeholder="contact" />
        </Labeled>
        <Labeled label="Visit date (optional)">
          <TextInput value={date} onChange={setDate} type="date" />
        </Labeled>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {done ? <p className="text-sm text-emerald-600">Logged ✓</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={!ok || busy}
        className={cn(btn.base, btn.secondary)}
      >
        {busy ? "…" : "Log non-briefed visit"}
      </button>
    </div>
  );
}
