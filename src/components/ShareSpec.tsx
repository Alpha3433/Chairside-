"use client";

/**
 * ShareSpec — make the spec sheet shareable as a LINK and as an IMAGE
 * (the brief: "exportable/shareable as an image and as a link", platform-
 * agnostic so it works regardless of the shop's booking system).
 *
 *   - Copy link / native share  → the public /b/<id> spec page.
 *   - Save image                → fetches the deterministic SVG spec card
 *                                 (lib/specCard.ts) and downloads it as a PNG
 *                                 (falling back to the SVG itself).
 *   - QR                        → the same link, so a client can show it at the
 *                                 chair or a shop can print it.
 *
 * The image is generated FROM the structured spec (Principle 3) — there is no
 * pixel input anywhere in this flow.
 */

import { useEffect, useState } from "react";
import { btn } from "./ui";
import { cn } from "@/lib/cn";

export function ShareSpec({
  path,
  imagePath,
  title,
  absoluteUrl,
  showQr = true,
}: {
  /** Relative link to the public spec page, e.g. /b/abc123 */
  path: string;
  /** Relative link to the SVG image, e.g. /b/abc123/image.svg */
  imagePath: string;
  title: string;
  /** Absolute URL if known server-side; otherwise derived from window.origin. */
  absoluteUrl?: string;
  showQr?: boolean;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const shareUrl = absoluteUrl || (origin ? `${origin}${path}` : path);
  const qrSrc = `/api/qr?text=${encodeURIComponent(shareUrl)}&size=200`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard can be blocked; the link is shown below as a fallback.
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: `${title} — Chairside spec`, url: shareUrl });
    } catch {
      /* user dismissed */
    }
  }

  async function saveImage() {
    setSaving(true);
    try {
      const res = await fetch(imagePath);
      const svgText = await res.text();
      const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      let finished = false;
      const done = (blob: Blob, ext: string) => {
        if (finished) return; // run once (onload/onerror/timeout race)
        finished = true;
        clearTimeout(timer);
        const a = document.createElement("a");
        const href = URL.createObjectURL(blob);
        a.href = href;
        a.download = `chairside-spec.${ext}`;
        a.click();
        // Defer revocation: some browsers (Safari, older Firefox) read the blob
        // asynchronously after click(), so revoking synchronously can cancel the
        // download. Give the download a moment to start first.
        setTimeout(() => {
          URL.revokeObjectURL(href);
          URL.revokeObjectURL(url);
        }, 1000);
        setSaving(false);
      };
      // Safety net: if the SVG neither decodes nor errors (or we unmount mid-
      // decode), fall back to the SVG so the button never sticks on "Saving…".
      const timer = setTimeout(() => done(svgBlob, "svg"), 5000);
      img.onload = () => {
        try {
          const scale = 2;
          const canvas = document.createElement("canvas");
          canvas.width = (img.width || 680) * scale;
          canvas.height = (img.height || 880) * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) return done(svgBlob, "svg");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((png) => (png ? done(png, "png") : done(svgBlob, "svg")), "image/png");
        } catch {
          done(svgBlob, "svg"); // some browsers taint SVG→canvas; ship the SVG.
        }
      };
      img.onerror = () => done(svgBlob, "svg");
      img.src = url;
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-sm font-semibold text-ink">Share this spec</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        Send the link or save the image — it works with any booking system, or none.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={cn(btn.base, btn.secondary)}>
          {copied ? "Link copied ✓" : "Copy link"}
        </button>
        {canShare ? (
          <button type="button" onClick={nativeShare} className={cn(btn.base, btn.secondary)}>
            Share…
          </button>
        ) : null}
        <button type="button" onClick={saveImage} disabled={saving} className={cn(btn.base, btn.secondary)}>
          {saving ? "Saving…" : "Save image"}
        </button>
        <a href={imagePath} target="_blank" rel="noreferrer" className={cn(btn.base, btn.ghost)}>
          View image
        </a>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600"
        />
      </div>

      {showQr ? (
        <div className="mt-4 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="QR code linking to this spec"
            width={96}
            height={96}
            className="h-24 w-24 rounded-lg border border-neutral-200 bg-white p-1"
          />
          <p className="text-xs text-neutral-500">
            Scan to open this spec on another phone — or show it to your barber at the chair.
          </p>
        </div>
      ) : null}
    </div>
  );
}
