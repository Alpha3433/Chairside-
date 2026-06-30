"use client";

/**
 * TryOn — tap-to-preview: paint the chosen look onto the client's own photos.
 *
 * Cost discipline (Principle 4): the FRONT renders on tap; side angles render
 * only on the explicit "Preview all angles" action. Every render is cached
 * server-side by (photo, spec) AND not re-requested here once shown, so changing
 * nothing and re-viewing never re-bills. When the spec changes, previews are
 * cleared (they were for the old look) so nothing stale is ever shown as current.
 *
 * The render is the LOOK only and is always labelled "Illustration — not a
 * guarantee"; the numbers live in the spec sheet beside it (Principle 1).
 */

import { useEffect, useMemo, useState } from "react";
import type { Spec } from "@/lib/spec";
import { specHash } from "@/lib/specHash";
import { type Angle, ANGLE_LABELS } from "@/lib/angles";
import type { CapturedPhoto } from "./CaptureFlow";
import { btn, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

interface RenderResult {
  url: string;
  status: string;
  provider: string;
}

export function TryOn({ photos, spec }: { photos: CapturedPhoto[]; spec: Spec }) {
  const front = photos.find((p) => p.angle === "front") ?? photos[0];
  const sides = photos.filter((p) => p.id !== front?.id);
  const curHash = useMemo(() => specHash(spec), [spec]);

  const [renders, setRenders] = useState<Record<string, RenderResult>>({});
  const [busy, setBusy] = useState<null | "front" | "all">(null);
  const [error, setError] = useState<string | null>(null);

  // A spec change invalidates previews — they visualised the previous look.
  useEffect(() => {
    setRenders({});
    setError(null);
  }, [curHash]);

  if (!front) return null;

  async function renderPhoto(photo: CapturedPhoto): Promise<RenderResult | null> {
    const res = await fetch("/api/renders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoId: photo.id, spec }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Render failed.");
      return null;
    }
    return { url: data.url, status: data.status, provider: data.provider };
  }

  async function previewFront() {
    setBusy("front");
    setError(null);
    const r = await renderPhoto(front!);
    if (r) setRenders((m) => ({ ...m, [front!.angle]: r }));
    setBusy(null);
  }

  async function previewAll() {
    setBusy("all");
    setError(null);
    for (const p of [front!, ...sides]) {
      const r = await renderPhoto(p);
      if (r) setRenders((m) => ({ ...m, [p.angle]: r }));
    }
    setBusy(null);
  }

  const frontRender = renders[front.angle];
  const isStub = Object.values(renders).some((r) => r.status === "stub");

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
          src={frontRender ? frontRender.url : front.url}
          alt={frontRender ? "Illustrative render of the cut on your photo" : "Your front photo"}
          className="max-h-[52vh] w-full object-contain"
        />
        {frontRender ? (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
            Illustration — not a guarantee
          </span>
        ) : (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-center text-xs text-white">
            Your photo — tap below to preview the cut on it
          </span>
        )}
      </div>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={previewFront}
          disabled={busy !== null}
          className={cn(btn.base, btn.primary)}
        >
          {busy === "front" ? "Rendering…" : frontRender ? "Re-preview" : "Preview on my photo"}
        </button>
        {sides.length > 0 ? (
          <button
            type="button"
            onClick={previewAll}
            disabled={busy !== null}
            className={cn(btn.base, btn.secondary)}
          >
            {busy === "all" ? "Rendering all…" : "Preview all angles"}
          </button>
        ) : null}
      </div>

      {/* Rendered side angles */}
      {sides.some((p) => renders[p.angle]) ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[front, ...sides].map((p) => {
            const r = renders[p.angle];
            return (
              <div key={p.id} className="relative overflow-hidden rounded-lg border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={(r ?? { url: p.url }).url} alt={ANGLE_LABELS[p.angle as Angle]} className="aspect-[3/4] w-full object-cover" />
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
          ? "Preview stub: a real generative render is wired behind the render flag. Renders are cached so re-viewing never re-generates."
          : "Renders are cached — re-viewing the same look never re-generates."}
      </p>
    </div>
  );
}
