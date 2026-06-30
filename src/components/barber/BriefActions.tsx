"use client";

/**
 * BriefActions — the barber's two moves on a brief:
 *   1. Counter-propose a "closest achievable on your hair" spec + note.
 *   2. Mark complete, capturing what was ACTUALLY done.
 *
 * Both edit the spec ONLY through SpecControls (structured params). On open, a
 * submitted brief is auto-marked "seen".
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Spec, HairType, Density } from "@/lib/spec";
import { generateSummary } from "@/lib/specSummary";
import { SpecControls } from "@/components/SpecControls";
import { SpecSheet } from "@/components/SpecSheet";
import { TextArea, Labeled } from "@/components/controls";
import { btn } from "@/components/ui";
import { cn } from "@/lib/cn";

type Mode = "none" | "counter" | "complete";

export function BriefActions({
  shopSlug,
  briefId,
  status,
  requestedSpec,
  barberSpec,
  hairContext,
}: {
  shopSlug: string;
  briefId: string;
  status: string;
  requestedSpec: Spec;
  barberSpec: Spec | null;
  hairContext: { hairType: HairType; density: Density };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("none");
  const [spec, setSpec] = useState<Spec>(barberSpec ?? requestedSpec);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-mark a freshly opened submitted brief as seen.
  useEffect(() => {
    if (status === "submitted") {
      fetch(`/api/briefs/${briefId}/seen`, { method: "POST" }).then(() => router.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => generateSummary(spec), [spec]);

  function start(m: Mode) {
    setSpec(barberSpec ?? requestedSpec);
    setError(null);
    setMode(m);
  }

  async function submitCounter() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/briefs/${briefId}/counter`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed.");
        return;
      }
      setMode("none");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function submitComplete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/briefs/${briefId}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed.");
        return;
      }
      router.push(`/barber/${shopSlug}`);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "completed") {
    return (
      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
        This brief is complete. The actual cut is recorded in the client&apos;s history below.
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      ) : null}

      {mode === "none" ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => start("counter")} className={cn(btn.base, btn.secondary)}>
            Counter-propose
          </button>
          <button type="button" onClick={() => start("complete")} className={cn(btn.base, btn.primary)}>
            Mark complete + capture actual
          </button>
        </div>
      ) : null}

      {mode !== "none" ? (
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">
              {mode === "counter" ? "Counter-proposal" : "What was actually done"}
            </h3>
            <button type="button" onClick={() => setMode("none")} className="text-xs text-neutral-400 hover:text-neutral-700">
              Cancel
            </button>
          </div>

          <p className="mb-4 text-xs text-neutral-500">
            {mode === "counter"
              ? "Adjust to what's achievable on this client's hair, then send it back with a note."
              : "Adjust to match the finished cut. This builds the client's history and your record."}
          </p>

          <div className="mb-4">
            <SpecSheet spec={spec} summary={summary} title={mode === "counter" ? "Counter spec" : "Actual spec"} hairContext={hairContext} />
          </div>

          <SpecControls value={spec} onChange={setSpec} />

          {mode === "counter" ? (
            <div className="mt-4">
              <Labeled label="Note to client (optional)">
                <TextArea
                  value={note}
                  onChange={setNote}
                  placeholder="e.g. Your hair won't hold a true skin fade without irritation — went a touch longer, looks the same up top."
                />
              </Labeled>
            </div>
          ) : null}

          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setMode("none")} className={cn(btn.base, btn.secondary, "flex-1")}>
              Cancel
            </button>
            <button
              type="button"
              onClick={mode === "counter" ? submitCounter : submitComplete}
              disabled={busy}
              className={cn(btn.base, btn.primary, "flex-[2]")}
            >
              {busy ? "…" : mode === "counter" ? "Send counter-proposal" : "Save as complete"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
