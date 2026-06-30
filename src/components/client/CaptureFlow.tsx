"use client";

/**
 * CaptureFlow — guided multi-angle head capture (front + both sides; back
 * optional). Web-first, any phone, no install (Principle 3): standard
 * getUserMedia + canvas frame capture, client-side compression, and a
 * lightweight face/brightness check for capture *guidance* only (Principle 2 —
 * never used to drive generative frames).
 *
 * Consent is taken BEFORE the camera turns on (Principle 5). Photos upload to
 * the gated storage stub and are keyed to the portable client profile.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Angle,
  CORE_ANGLES,
  ANGLE_LABELS,
  ANGLE_GUIDANCE,
} from "@/lib/angles";
import { btn, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface CapturedPhoto {
  id: string;
  angle: Angle;
  url: string;
  width: number | null;
  height: number | null;
}

const MAX_DIM = 1080;

type Guidance = { brightnessOk: boolean; facePresent: boolean; detector: boolean };

export function CaptureFlow({
  contact,
  initial,
  onComplete,
  onSkip,
  onBack,
}: {
  contact: string;
  initial?: CapturedPhoto[];
  onComplete: (photos: CapturedPhoto[]) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect: (v: HTMLVideoElement) => Promise<unknown[]> } | null>(null);
  const facingRef = useRef<"user" | "environment">("user");

  const [consented, setConsented] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [angle, setAngle] = useState<Angle>("front");
  const [captured, setCaptured] = useState<Record<string, CapturedPhoto>>(() =>
    Object.fromEntries((initial ?? []).map((p) => [p.angle, p])),
  );
  const [includeBack, setIncludeBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<Guidance>({ brightnessOk: false, facePresent: false, detector: false });

  const coreDone = CORE_ANGLES.every((a) => captured[a]);

  // --- Camera lifecycle -----------------------------------------------------
  const startCamera = useCallback(async (facing: "user" | "environment") => {
    setCamError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamError("This browser can't access the camera. You can still skip photos and send a text brief.");
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      facingRef.current = facing;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCamError(
        "Couldn't access the camera (permission denied or no camera). Allow camera access, or skip photos.",
      );
    }
  }, []);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // Set up an (optional) native face detector once.
  useEffect(() => {
    const Ctor = (globalThis as { FaceDetector?: new (o: unknown) => { detect: (v: HTMLVideoElement) => Promise<unknown[]> } }).FaceDetector;
    if (Ctor) {
      try {
        detectorRef.current = new Ctor({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        detectorRef.current = null;
      }
    }
  }, []);

  // Lightweight guidance loop (~3/sec): brightness + optional face presence.
  // This is free, client-side, and only gates the capture button (Principle 2).
  useEffect(() => {
    if (!consented || camError) return;
    let alive = true;
    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 64;
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    const detector = detectorRef.current;

    const tick = async () => {
      const v = videoRef.current;
      if (!alive || !v || v.videoWidth === 0 || !ctx) return;
      ctx.drawImage(v, 0, 0, 64, 64);
      const { data } = ctx.getImageData(0, 0, 64, 64);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const brightness = sum / (data.length / 4);
      let facePresent = false;
      if (detector) {
        try {
          const faces = await detector.detect(v);
          facePresent = faces.length > 0;
        } catch {
          facePresent = false;
        }
      }
      if (alive) setGuide({ brightnessOk: brightness > 45 && brightness < 240, facePresent, detector: !!detector });
    };

    const iv = setInterval(tick, 320);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [consented, camError]);

  async function agree() {
    setConsented(true);
    await startCamera("user");
  }

  function chooseAngle(a: Angle) {
    setAngle(a);
    const wantFacing = a === "back" ? "environment" : "user";
    if (wantFacing !== facingRef.current) startCamera(wantFacing);
  }

  // --- Capture + upload -----------------------------------------------------
  async function capture() {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) {
      setError("Camera isn't ready yet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      const scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
      const cw = Math.round(vw * scale);
      const ch = Math.round(vh * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(v, 0, 0, cw, ch);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.72));
      if (!blob) throw new Error("capture failed");

      const form = new FormData();
      form.append("photo", blob, `${angle}.jpg`);
      form.append("contact", contact);
      form.append("angle", angle);
      form.append("consent", "true");
      form.append("width", String(cw));
      form.append("height", String(ch));
      const res = await fetch("/api/photos", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }

      const prev = captured[angle];
      const next: CapturedPhoto = { id: data.id, angle, url: data.url, width: data.width, height: data.height };
      setCaptured((c) => ({ ...c, [angle]: next }));
      if (prev) fetch(`/api/photos/${prev.id}`, { method: "DELETE" }).catch(() => undefined); // drop the retaken one

      // Auto-advance to the next uncaptured core angle.
      const nextAngle = CORE_ANGLES.find((a) => a !== angle && !captured[a]);
      if (nextAngle) chooseAngle(nextAngle);
    } catch {
      setError("Couldn't capture — try again.");
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    const photos = Object.values(captured);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onComplete(photos);
  }

  // --- Render ---------------------------------------------------------------
  if (!consented) {
    return <ConsentScreen onAgree={agree} onSkip={onSkip} onBack={onBack} />;
  }

  const ready = guide.brightnessOk && (guide.facePresent || !guide.detector);
  const angleList: Angle[] = includeBack ? [...CORE_ANGLES, "back"] : CORE_ANGLES;

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl font-bold text-ink">See it on your own head</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Capture {ANGLE_LABELS[angle].toLowerCase()}. We use these only to show the cut on you and
          send them to your barber — never publicly.
        </p>
      </div>

      {camError ? (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          {camError}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={cn("h-[60vh] w-full object-cover", angle !== "back" && "-scale-x-100")}
          />
          <SilhouetteOverlay angle={angle} />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <Badge tone="neutral">{ANGLE_LABELS[angle]}</Badge>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[11px] font-semibold",
                ready ? "bg-emerald-500/90 text-white" : "bg-black/60 text-amber-200",
              )}
            >
              {!guide.brightnessOk ? "More light, please" : ready ? "Looks good — hold still" : "Center your face"}
            </span>
          </div>
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-8 text-center text-xs text-white">
            {ANGLE_GUIDANCE[angle]}
          </p>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {!camError ? (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={capture}
            disabled={busy}
            className={cn(btn.base, btn.primary, "px-8")}
          >
            {busy ? "…" : captured[angle] ? `Retake ${ANGLE_LABELS[angle].toLowerCase()}` : "Capture"}
          </button>
        </div>
      ) : null}

      {/* Captured angles strip */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {angleList.map((a) => {
          const p = captured[a];
          const active = a === angle;
          return (
            <button
              key={a}
              type="button"
              onClick={() => chooseAngle(a)}
              className={cn(
                "relative aspect-[3/4] overflow-hidden rounded-lg border text-left",
                active ? "border-neutral-900 ring-2 ring-neutral-900" : "border-neutral-200",
              )}
            >
              {p ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={ANGLE_LABELS[a]} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-[11px] text-neutral-400">
                  {ANGLE_LABELS[a]}
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] font-medium text-white">
                {ANGLE_LABELS[a]}
                {p ? " ✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {!includeBack ? (
        <button
          type="button"
          onClick={() => {
            setIncludeBack(true);
            chooseAngle("back");
          }}
          className="mt-3 text-xs font-medium text-neutral-500 underline hover:text-neutral-800"
        >
          + Add back of head (optional)
        </button>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={finish}
          disabled={!coreDone}
          className={cn(btn.base, btn.primary)}
        >
          {coreDone ? "Use these photos →" : `Capture front + both sides (${Object.keys(captured).length}/3)`}
        </button>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Back
          </button>
          <button
            type="button"
            onClick={() => {
              streamRef.current?.getTracks().forEach((t) => t.stop());
              onSkip();
            }}
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            Skip photos — send a text brief
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsentScreen({
  onAgree,
  onSkip,
  onBack,
}: {
  onAgree: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">Try the cut on your own head</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Optional. Take a few quick photos (front + both sides) so you can preview the look on you and
        send them to your barber with the spec.
      </p>

      <div className="mt-4 space-y-2 rounded-xl border border-neutral-200 p-4 text-sm text-neutral-700">
        <p className="font-semibold text-ink">How your photos are handled</p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-600">
          <li>Used only to show the cut on you and to send to your chosen barber.</li>
          <li>Stored privately and tied to your contact — never made public, never put in a link.</li>
          <li>You can delete them any time, from the next screen.</li>
          <li>The cut&apos;s numbers always come from the spec — never read off a photo.</li>
        </ul>
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>I consent to capturing and storing my photos for this purpose.</span>
      </label>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onAgree}
          disabled={!checked}
          className={cn(btn.base, btn.primary)}
        >
          Agree &amp; turn on camera
        </button>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Back
          </button>
          <button type="button" onClick={onSkip} className="text-sm text-neutral-500 hover:text-neutral-800">
            Skip photos — send a text brief
          </button>
        </div>
      </div>
    </div>
  );
}

/** A head/face silhouette to align to (front/side variants). Guidance only. */
function SilhouetteOverlay({ angle }: { angle: Angle }) {
  return (
    <svg
      viewBox="0 0 100 130"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 mx-auto h-full opacity-70"
      aria-hidden
    >
      {angle === "front" || angle === "back" ? (
        <ellipse cx="50" cy="58" rx="26" ry="34" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeDasharray="3 3" />
      ) : (
        <path
          d="M62 24 q16 6 16 34 q0 26 -16 36 q-10 6 -16 -2 q-18 -4 -18 -34 q0 -32 34 -34 z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeDasharray="3 3"
        />
      )}
    </svg>
  );
}
