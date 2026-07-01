"use client";

/**
 * TryOn — tap-to-preview: paint the chosen look onto the client's own photos.
 *
 * Cost discipline (Principle 4): the FRONT renders on tap; side angles render
 * only on the explicit "Preview all angles" action, in PARALLEL (one tap = the
 * slowest single render, not the sum). Every render is cached server-side by
 * (photo, spec) — and client-side in a map KEYED BY specHash that the parent
 * owns, so previews survive step changes and toggling a control back to a
 * previous value restores that look instantly with zero network and zero cost.
 *
 * Keying results by the hash they were REQUESTED for also makes stale races
 * impossible: a render that lands after the spec changed files under its own
 * (old) hash and is never shown as current. If the spec changes while a preview
 * is on screen, the old preview stays visible but explicitly STALE (dimmed +
 * "Spec changed") rather than snapping back to the raw photo.
 *
 * The render is the LOOK only and is always labelled "Illustration — not a
 * guarantee"; the numbers live in the spec sheet beside it (Principle 1).
 */

import { useMemo, useRef, useState } from "react";
import type { Spec } from "@/lib/spec";
import { specHash } from "@/lib/specHash";
import { type Angle, ANGLE_LABELS } from "@/lib/angles";
import type { CapturedPhoto } from "./CaptureFlow";
import { btn, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface RenderResult {
  url: string;
  status: string;
  provider: string;
}

/** specHash → angle → render. Owned by ClientFlow so previews persist across steps. */
export type RenderMap = Record<string, Partial<Record<string, RenderResult>>>;

export function TryOn({
  photos,
  spec,
  renders,
  onRenders,
}: {
  photos: CapturedPhoto[];
  spec: Spec;
  renders: RenderMap;
  onRenders: (updater: (prev: RenderMap) => RenderMap) => void;
}) {
  const front = photos.find((p) => p.angle === "front") ?? photos[0];
  const sides = photos.filter((p) => p.id !== front?.id);
  const curHash = useMemo(() => specHash(spec), [spec]);

  const [busy, setBusy] = useState<null | "front" | "all">(null);
  const [error, setError] = useState<string | null>(null);
  // The last hash we successfully showed, so a spec change can keep the old
  // preview visible-but-stale instead of flashing back to the raw photo.
  const lastShownHash = useRef<string | null>(null);

  const current = renders[curHash] ?? {};
  if (current[front?.angle ?? "front"]) lastShownHash.current = curHash;
  const staleSet = lastShownHash.current && lastShownHash.current !== curHash ? renders[lastShownHash.current] ?? {} : {};

  if (!front) return null;

  async function renderPhoto(photo: CapturedPhoto, forHash: string): Promise<void> {
    try {
      const res = await fetch("/api/renders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, spec }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Render failed — tap to retry.");
        return;
      }
      const r: RenderResult = { url: data.url, status: data.status, provider: data.provider };
      // Pre-decode so the swap paints instantly (no "done but nothing changed" gap).
      await preload(r.url);
      // File the result under the hash it was REQUESTED for — never the current one.
      onRenders((prev) => ({ ...prev, [forHash]: { ...(prev[forHash] ?? {}), [photo.angle]: r } }));
    } catch {
      setError("Network hiccup — tap to retry.");
    }
  }

  async function previewFront() {
    if (current[front!.angle]) return; // already previewed for this exact spec
    setBusy("front");
    setError(null);
    try {
      await renderPhoto(front!, curHash);
    } finally {
      setBusy(null);
    }
  }

  async function previewAll() {
    setBusy("all");
    setError(null);
    try {
      // Only the angles not yet rendered for THIS spec — and all in parallel.
      const pending = [front!, ...sides].filter((p) => !current[p.angle]);
      await Promise.allSettled(pending.map((p) => renderPhoto(p, curHash)));
    } finally {
      setBusy(null);
    }
  }

  const frontFresh = current[front.angle];
  const frontStale = !frontFresh ? staleSet[front.angle] : undefined;
  const shown = frontFresh ?? frontStale;
  const allDone = [front, ...sides].every((p) => current[p.angle]);
  const isStub = Object.values(current).some((r) => r?.status === "stub");

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Try it on your photo</p>
        <Badge tone="neutral">Illustration</Badge>
      </div>
      <p className="mb-3 text-xs text-neutral-500">
        A preview of the look on you. The numbers come from the spec, never from the picture.
      </p>

      <div className="relative overflow-hidden rounded-xl bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shown ? shown.url : front.url}
          alt={shown ? "Illustrative render of the cut on your photo" : "Your front photo"}
          className={cn("max-h-[52vh] w-full object-contain", frontStale && "opacity-40")}
        />
        {frontFresh ? (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
            Illustration — not a guarantee
          </span>
        ) : frontStale ? (
          <span className="absolute left-2 top-2 rounded bg-amber-500/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Spec changed — tap to update
          </span>
        ) : (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-center text-xs text-white">
            Your photo — tap below to preview the cut on it
          </span>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
              Painting your look…
            </span>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {frontFresh ? (
          <span className={cn(btn.base, "cursor-default bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")}>
            Previewed ✓
          </span>
        ) : (
          <button type="button" onClick={previewFront} disabled={busy !== null} className={cn(btn.base, btn.primary)}>
            {busy === "front" ? "Rendering…" : frontStale ? "Update preview" : "Preview on my photo"}
          </button>
        )}
        {sides.length > 0 && !allDone ? (
          <button type="button" onClick={previewAll} disabled={busy !== null} className={cn(btn.base, btn.secondary)}>
            {busy === "all" ? "Rendering…" : "Preview all angles"}
          </button>
        ) : null}
      </div>

      {/* Rendered side angles (current spec only — stale sides are never shown) */}
      {sides.some((p) => current[p.angle]) ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[front, ...sides].map((p) => {
            const r = current[p.angle];
            return (
              <div key={p.id} className="relative overflow-hidden rounded-lg border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(r ?? { url: p.url }).url}
                  alt={ANGLE_LABELS[p.angle as Angle]}
                  className="aspect-[3/4] w-full object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">
                  {ANGLE_LABELS[p.angle as Angle]}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
        {isStub
          ? "Preview stub: a real generative render is wired behind the render flag. Previews are cached — revisiting a look is instant and free."
          : "Previews are cached — revisiting a look is instant and free."}
      </p>
    </div>
  );
}

function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
    // decode() paints even faster where supported; fall back to onload.
    img.decode?.().then(() => resolve()).catch(() => undefined);
  });
}
