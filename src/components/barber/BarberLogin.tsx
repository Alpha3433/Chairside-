"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextInput, Labeled } from "@/components/controls";
import { btn } from "@/components/ui";
import { cn } from "@/lib/cn";

export function BarberLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/barber/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setError("Incorrect access code.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Chairside · Barber
      </p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Dashboard sign-in</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Enter your shop access code. (MVP-level shared code — not production auth.)
      </p>
      <div className="mt-6 space-y-4">
        <Labeled label="Access code">
          <TextInput value={code} onChange={setCode} type="password" placeholder="••••••" />
        </Labeled>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !code}
          className={cn(btn.base, btn.primary, "w-full")}
        >
          {busy ? "…" : "Sign in"}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-neutral-400">
        Default dev code: <code>letmein</code>
      </p>
    </main>
  );
}
