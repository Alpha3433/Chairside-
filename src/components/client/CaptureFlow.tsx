"use client";

/**
 * CaptureFlow — guided multi-angle head capture (front + both sides; back
 * optional). Web-first, any phone, no install (Principle 3): standard
 * getUserMedia + canvas frame capture, client-side compression, and a
 * lightweight face/brightness check for capture *guidance* only (Principle 2 —
 * never used to drive generative frames).
 *
 * Consent is taken BEFORE the camera turns on (Principle 5) — a single, clearly
 * labelled "Agree & turn on camera" tap is the affirmative act.
 *
 * Friction design:
 *  - No camera / permission denied is NOT a dead-end: errors are differentiated
 *    (blocked vs missing vs in-use) with retry, and every angle can also be
 *    fulfilled by a native file/photo picker through the same downscale+upload
 *    path (on iOS `capture="user"` opens the system camera directly).
 *  - Uploads are OPTIMISTIC: the shot appears instantly from a local preview
 *    and uploads in the background while the user poses the next angle; the
 *    finish button waits for stragglers, and failures keep the frame for a
 *    one-tap retry (no re-posing).
 *  - Side shots use a 3-2-1 self-timer (you can't read the screen or hit the
 *    shutter accurately with your head turned); front stays instant.
 *  - The captured frame is mirrored to match the on-screen preview for the
 *    front camera, so "which side is which" never surprises anyone.
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

interface Shot {
  angle: Angle;
  /** What we display immediately — a local blob: URL (or server URL for restored shots). */
  displayUrl: string;
  serverId?: string;
  status: "uploading" | "done" | "failed";
  /** Retained so a failed upload can be retried without re-posing. */
  blob?: Blob;
  width: number;
  height: number;
  seq: number;
}

const MAX_DIM = 1080;

type Guidance = { brightnessOk: boolean; facePresent: boolean; detector: boolean };

export function CaptureFlow({
  contact,
  bookingToken,
  initial,
  onComplete,
  onSkip,
  onBack,
}: {
  // Either a contact (normal flow) OR a bookingToken (personalized-link flow,
  // where the contact never reaches the browser). Exactly one is provided.
  contact?: string;
  bookingToken?: string;
  initial?: CapturedPhoto[];
  onComplete: (photos: CapturedPhoto[]) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect: (v: HTMLVideoElement) => Promise<unknown[]> } | null>(null);
  const facingRef = useRef<"user" | "environment">("user");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [consented, setConsented] = useState(false);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [camError, setCamError] = useState<{ kind: string; message: string } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [angle, setAngle] = useState<Angle>("front");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captured, setCaptured] = useState<Record<string, Shot>>(() =>
    Object.fromEntries(
      (initial ?? []).map((p, i) => [
        p.angle,
        {
          angle: p.angle,
          displayUrl: p.url,
          serverId: p.id,
          status: "done" as const,
          width: p.width ?? 0,
          height: p.height ?? 0,
          seq: -1 - i,
        },
      ]),
    ),
  );
  const [includeBack, setIncludeBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<Guidance>({ brightnessOk: false, facePresent: false, detector: false });

  const capturedRef = useRef(captured);
  capturedRef.current = captured;

  const shots = Object.values(captured);
  const coreDone = CORE_ANGLES.every((a) => captured[a]);
  const uploading = shots.some((s) => s.status === "uploading");
  const failedShot = shots.find((s) => s.status === "failed");
  const readyToFinish = coreDone && !uploading && !failedShot;

  // Detect whether ANY camera exists before the user commits (pre-permission,
  // devices enumerate without labels but still count).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setHasCamera(false);
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((ds) => setHasCamera(ds.some((d) => d.kind === "videoinput")))
      .catch(() => setHasCamera(null));
  }, []);

  // --- Camera lifecycle -----------------------------------------------------
  const startCamera = useCallback(async (facing: "user" | "environment") => {
    setCamError(null);
    setCameraReady(false);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamError({ kind: "unsupported", message: "This browser can't access the camera." });
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
      attachStream();
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCamError({
          kind: "blocked",
          message: "Camera access is blocked. Allow it in your browser's site settings, then tap Try again.",
        });
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCamError({ kind: "none", message: "No camera found on this device." });
      } else if (name === "NotReadableError") {
        setCamError({ kind: "busy", message: "The camera is in use by another app. Close it, then tap Try again." });
      } else {
        setCamError({ kind: "unknown", message: "Couldn't start the camera." });
      }
    }
  }, []);

  // Attach the stream whenever both it and the <video> element exist — order-
  // independent, so a fast permission grant can't race the first render.
  const attachStream = useCallback(() => {
    const v = videoRef.current;
    const s = streamRef.current;
    if (v && s && v.srcObject !== s) {
      v.srcObject = s;
      v.play().catch(() => undefined);
    }
  }, []);
  useEffect(() => {
    if (consented) attachStream();
  });

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
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

  // Lightweight guidance loop (~3/sec): brightness + optional face presence +
  // camera readiness. Free, client-side, advisory only (Principle 2).
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
      if (!alive || !v || !ctx) return;
      if (v.videoWidth === 0) {
        setCameraReady(false);
        return;
      }
      setCameraReady(true);
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
    cancelCountdown();
    setAngle(a);
    const wantFacing = a === "back" ? "environment" : "user";
    if (wantFacing !== facingRef.current) startCamera(wantFacing);
  }

  // --- Upload pipeline (optimistic + background) ------------------------------
  function identityForm(form: FormData) {
    if (bookingToken) form.append("bookingToken", bookingToken);
    else if (contact) form.append("contact", contact);
  }

  async function uploadShot(shotAngle: Angle, blob: Blob, w: number, h: number, seq: number, prevServerId?: string) {
    const form = new FormData();
    form.append("photo", blob, `${shotAngle}.jpg`);
    identityForm(form);
    form.append("angle", shotAngle);
    form.append("consent", "true");
    form.append("width", String(w));
    form.append("height", String(h));

    let serverId: string | null = null;
    try {
      const res = await fetch("/api/photos", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data as { id?: string }).id) serverId = (data as { id: string }).id;
      else setError((data as { error?: string }).error ?? "Upload failed — tap the photo to retry.");
    } catch {
      setError("Upload failed — tap the photo to retry.");
    }

    const cur = capturedRef.current[shotAngle];
    if (!cur || cur.seq !== seq) {
      // Superseded by a retake while in flight — discard the orphan server photo.
      if (serverId) fetch(`/api/photos/${serverId}`, { method: "DELETE" }).catch(() => undefined);
      return;
    }
    if (serverId) {
      setCaptured((c) => ({ ...c, [shotAngle]: { ...c[shotAngle], serverId, status: "done" } }));
      // The retake succeeded — clean up the shot it replaced.
      if (prevServerId) fetch(`/api/photos/${prevServerId}`, { method: "DELETE" }).catch(() => undefined);
    } else {
      setCaptured((c) => ({ ...c, [shotAngle]: { ...c[shotAngle], status: "failed" } }));
    }
  }

  function acceptFrame(shotAngle: Angle, blob: Blob, w: number, h: number) {
    setError(null);
    const prev = capturedRef.current[shotAngle];
    if (prev?.displayUrl.startsWith("blob:")) URL.revokeObjectURL(prev.displayUrl);
    const seq = ++seqRef.current;
    const displayUrl = URL.createObjectURL(blob);
    setCaptured((c) => ({
      ...c,
      [shotAngle]: { angle: shotAngle, displayUrl, status: "uploading", blob, width: w, height: h, seq },
    }));
    // Advance immediately — the upload finishes in the background.
    const nextAngle = CORE_ANGLES.find((a) => a !== shotAngle && !capturedRef.current[a]);
    if (nextAngle) chooseAngle(nextAngle);
    void uploadShot(shotAngle, blob, w, h, seq, prev?.serverId);
  }

  function retryUpload(shotAngle: Angle) {
    const s = capturedRef.current[shotAngle];
    if (!s?.blob) return;
    setError(null);
    setCaptured((c) => ({ ...c, [shotAngle]: { ...c[shotAngle], status: "uploading" } }));
    void uploadShot(shotAngle, s.blob, s.width, s.height, s.seq, s.serverId);
  }

  // --- Capture (camera) -------------------------------------------------------
  function doCapture() {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
    const cw = Math.round(vw * scale);
    const ch = Math.round(vh * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Save what the user SAW: the front camera preview is mirrored, so mirror
    // the frame too — otherwise side shots look like the wrong side.
    if (facingRef.current === "user") {
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, cw, ch);
    canvas.toBlob(
      (blob) => {
        if (blob) acceptFrame(angle, blob, cw, ch);
      },
      "image/jpeg",
      0.72,
    );
  }

  function cancelCountdown() {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    setCountdown(null);
  }

  function onShutter() {
    if (countdown !== null) {
      cancelCountdown(); // second tap cancels the timer
      return;
    }
    if (angle === "front") {
      doCapture();
      return;
    }
    // Side/back: a 3-2-1 self-timer so the user can turn their head and pose
    // without needing to see the screen or hit the button mid-turn.
    let n = 3;
    setCountdown(n);
    countdownTimer.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        cancelCountdown();
        doCapture();
      } else {
        setCountdown(n);
      }
    }, 1000);
  }

  // --- Capture (file fallback) -------------------------------------------------
  async function onFilePicked(file: File) {
    try {
      let bitmap: ImageBitmap | HTMLImageElement;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = URL.createObjectURL(file);
        });
      }
      const bw = "width" in bitmap ? bitmap.width : 0;
      const bh = "height" in bitmap ? bitmap.height : 0;
      if (!bw || !bh) throw new Error("empty image");
      const scale = Math.min(1, MAX_DIM / Math.max(bw, bh));
      const cw = Math.round(bw * scale);
      const ch = Math.round(bh * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(bitmap, 0, 0, cw, ch);
      canvas.toBlob(
        (blob) => {
          if (blob) acceptFrame(angle, blob, cw, ch);
          else setError("Couldn't read that photo — try another.");
        },
        "image/jpeg",
        0.72,
      );
    } catch {
      setError("Couldn't read that photo — try another.");
    }
  }

  function finish() {
    const photos: CapturedPhoto[] = Object.values(capturedRef.current)
      .filter((s) => s.serverId)
      .map((s) => ({
        id: s.serverId!,
        angle: s.angle,
        url: `/api/photos/${s.serverId}`,
        width: s.width || null,
        height: s.height || null,
      }));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onComplete(photos);
  }

  // --- Render ---------------------------------------------------------------
  if (!consented) {
    return <ConsentScreen hasCamera={hasCamera} onAgree={agree} onSkip={onSkip} onBack={onBack} />;
  }

  const ready = cameraReady && guide.brightnessOk && (guide.facePresent || !guide.detector);
  const angleList: Angle[] = includeBack ? [...CORE_ANGLES, "back"] : CORE_ANGLES;
  const capturedCount = CORE_ANGLES.filter((a) => captured[a]).length;

  return (
    <div className="pb-2">
      <div className="mb-3">
        <h1 className="text-xl font-bold text-ink">See it on your own head</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Capture {ANGLE_LABELS[angle].toLowerCase()}. We use these only to show the cut on you and
          send them to your barber — never publicly.
        </p>
      </div>

      {camError ? (
        <div className="rounded-xl bg-amber-50 px-4 py-4 ring-1 ring-amber-200">
          <p className="text-sm font-semibold text-amber-900">{camError.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {camError.kind !== "none" && camError.kind !== "unsupported" ? (
              <button
                type="button"
                onClick={() => startCamera(facingRef.current)}
                className={cn(btn.base, btn.secondary)}
              >
                Try again
              </button>
            ) : null}
            <button type="button" onClick={() => fileInputRef.current?.click()} className={cn(btn.base, btn.primary)}>
              Upload a photo instead
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-700">
            You can add each angle from your photo library — or skip photos entirely below.
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={cn("h-[56vh] w-full object-cover", angle !== "back" && "-scale-x-100")}
          />
          <SilhouetteOverlay angle={angle} />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <Badge tone="neutral">{ANGLE_LABELS[angle]}</Badge>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[11px] font-semibold",
                coreDone
                  ? "bg-emerald-500/90 text-white"
                  : !cameraReady
                    ? "bg-black/60 text-neutral-200"
                    : ready
                      ? "bg-emerald-500/90 text-white"
                      : "bg-black/60 text-amber-200",
              )}
            >
              {coreDone
                ? "All 3 captured ✓"
                : !cameraReady
                  ? "Starting camera…"
                  : !guide.brightnessOk
                    ? "More light, please"
                    : ready
                      ? "Looks good — hold still"
                      : "Center your face"}
            </span>
          </div>
          {countdown !== null ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-8xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{countdown}</span>
            </div>
          ) : null}
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-8 text-center text-xs text-white">
            {countdown !== null ? "Hold the pose — capturing…" : ANGLE_GUIDANCE[angle]}
          </p>
        </div>
      )}

      {error ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-rose-100">
          <p className="text-sm text-rose-700">{error}</p>
          {failedShot ? (
            <button
              type="button"
              onClick={() => retryUpload(failedShot.angle)}
              className="shrink-0 text-sm font-semibold text-rose-700 underline"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!camError ? (
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onShutter}
            disabled={!cameraReady}
            className={cn(btn.base, btn.primary, "px-8")}
          >
            {!cameraReady
              ? "Starting camera…"
              : countdown !== null
                ? "Cancel"
                : captured[angle]
                  ? `Retake ${ANGLE_LABELS[angle].toLowerCase()}`
                  : angle === "front"
                    ? "Capture"
                    : "Capture (3s timer)"}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-medium text-neutral-400 underline hover:text-neutral-700"
          >
            or upload a photo for this angle
          </button>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFilePicked(f);
          e.target.value = "";
        }}
      />

      {/* Captured angles strip */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {angleList.map((a) => {
          const s = captured[a];
          const active = a === angle;
          return (
            <button
              key={a}
              type="button"
              onClick={() => (s?.status === "failed" ? retryUpload(a) : chooseAngle(a))}
              className={cn(
                "relative aspect-[3/4] overflow-hidden rounded-lg border text-left",
                active ? "border-neutral-900 ring-2 ring-neutral-900" : "border-neutral-200",
              )}
            >
              {s ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.displayUrl} alt={ANGLE_LABELS[a]} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-[11px] text-neutral-400">
                  {ANGLE_LABELS[a]}
                </div>
              )}
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[10px] font-medium text-white",
                  s?.status === "failed" ? "bg-rose-600/90" : "bg-black/55",
                )}
              >
                {s?.status === "uploading" ? "Saving…" : s?.status === "failed" ? "Tap to retry" : ANGLE_LABELS[a] + (s ? " ✓" : "")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {!includeBack ? (
          <button
            type="button"
            onClick={() => {
              setIncludeBack(true);
              chooseAngle("back");
            }}
            className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800"
          >
            + Add back of head (optional)
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            onSkip();
          }}
          className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800"
        >
          Skip photos — send a text brief
        </button>
      </div>

      {/* Sticky finish bar — same pattern as the rest of the flow, so the CTA is
          never stranded below the fold after the third capture. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3">
          <button type="button" onClick={onBack} className={cn(btn.base, btn.secondary, "flex-1")}>
            Back
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!readyToFinish}
            className={cn(btn.base, btn.primary, "flex-[2]")}
          >
            {uploading
              ? "Finishing upload…"
              : failedShot
                ? "Retry the failed photo"
                : coreDone
                  ? "Use these photos →"
                  : `Capture front + both sides (${capturedCount}/3)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsentScreen({
  hasCamera,
  onAgree,
  onSkip,
  onBack,
}: {
  hasCamera: boolean | null;
  onAgree: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">Try the cut on your own head</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Optional. Take a few quick photos (front + both sides) so you can preview the look on you and
        send them to your barber with the spec.
      </p>

      {hasCamera === false ? (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          No camera detected on this device — you can still add photos from your library on the next
          screen, or skip photos entirely.
        </div>
      ) : null}

      <div className="mt-4 space-y-2 rounded-xl border border-neutral-200 p-4 text-sm text-neutral-700">
        <p className="font-semibold text-ink">How your photos are handled</p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-600">
          <li>Used only to show the cut on you and to send to your chosen barber.</li>
          <li>Stored privately and tied to your contact — never made public, never put in a link.</li>
          <li>You can delete them any time.</li>
          <li>The cut&apos;s numbers always come from the spec — never read off a photo.</li>
        </ul>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {/* One clearly-labelled tap IS the explicit consent act — no separate
            checkbox to hunt for (the greyed-out-button stall was real friction). */}
        <button type="button" onClick={onAgree} className={cn(btn.base, btn.primary)}>
          I agree — turn on the camera
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
      className={cn(
        "pointer-events-none absolute inset-0 mx-auto h-full opacity-70",
        // The preview is mirrored; flip the profile outline for the LEFT turn so
        // the nose on the outline points the way the user's on-screen nose does.
        angle === "left" && "-scale-x-100",
      )}
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
