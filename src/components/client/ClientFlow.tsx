"use client";

/**
 * ClientFlow — the mobile-first, no-install client journey:
 *   identity → hair → [capture] → pick → customise → review
 *
 * Friction design:
 *  - Review carries the use-case tag + optional note (one screen fewer than a
 *    separate "details" step, and no duplicated spec sheets along the way).
 *  - Identity is remembered on this device (localStorage) so a returning client
 *    just taps Continue; recognition (the portability moment) runs in the
 *    background and never blocks the step change.
 *  - Try-on previews live in a spec-hash-keyed map up here, so they persist
 *    across steps and returning to a previously previewed look is instant.
 *
 * The spec is only ever built from structured controls (SpecControls); renders
 * are illustrative and fenced (Principle 1). On submit the brief carries the
 * captured photo ids (and the booking token, when the client arrived via a
 * personalized link — in that mode identity never touches the browser).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Spec,
  type HairType,
  type Density,
  type FaceShape,
  type UseCaseTag,
  HAIR_TYPES,
  DENSITIES,
  FACE_SHAPES,
  USE_CASE_TAGS,
  LABELS,
} from "@/lib/spec";
import { generateSummary } from "@/lib/specSummary";
import { isPlausibleContact } from "@/lib/contact";
import { SpecControls } from "@/components/SpecControls";
import { SpecSheet } from "@/components/SpecSheet";
import { ShareSpec } from "@/components/ShareSpec";
import { Segmented, TextInput, TextArea, Labeled } from "@/components/controls";
import { btn, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CaptureFlow, type CapturedPhoto } from "./CaptureFlow";
import { TryOn, type RenderMap } from "./TryOn";

export interface BaseStyleOption {
  id: string;
  name: string;
  description: string;
  tags: string[];
  barberValidated: boolean;
  spec: Spec;
  summary: string;
}

interface HistoryItem {
  briefId: string;
  shopName: string;
  status: string;
  useCaseTag: string;
  createdAt: string;
  summary: string;
  isActual: boolean;
}

export interface ClientFlowPrefill {
  name: string;
  hairType: string;
  density: string;
  faceShape: string;
}

type Step = "identity" | "hair" | "capture" | "pick" | "customize" | "review" | "done";

const IDENTITY_KEY = "chairside.identity";

export function ClientFlow({
  shopName,
  shopSlug,
  baseStyles,
  visualizationEnabled,
  prefill = null,
  bookingToken = null,
}: {
  shopName: string;
  shopSlug: string;
  baseStyles: BaseStyleOption[];
  visualizationEnabled: boolean;
  // When the client arrived via a personalized booking link, identity is already
  // known (resolved server-side from the token) — skip the identity step and
  // never ask for, or hold, their contact in the browser.
  prefill?: ClientFlowPrefill | null;
  bookingToken?: string | null;
}) {
  const identified = !!prefill;
  const stepOrder = (
    visualizationEnabled
      ? (["identity", "hair", "capture", "pick", "customize", "review"] as Step[])
      : (["identity", "hair", "pick", "customize", "review"] as Step[])
  ).filter((s) => !(identified && s === "identity"));

  const [step, setStep] = useState<Step>(identified ? "hair" : "identity");

  // identity
  const [name, setName] = useState(prefill?.name ?? "");
  const [contact, setContact] = useState("");
  const [remembered, setRemembered] = useState(false);
  const [recognized, setRecognized] = useState<{ name: string; history: HistoryItem[] } | null>(null);

  // hair — background recognition must never clobber values the user has touched.
  const [hairType, setHairType] = useState<HairType>((prefill?.hairType as HairType) ?? "straight");
  const [density, setDensity] = useState<Density>((prefill?.density as Density) ?? "medium");
  const [faceShape, setFaceShape] = useState<FaceShape | "">((prefill?.faceShape as FaceShape) || "");
  const hairTouched = useRef(false);

  // photos (visualization layer)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  // style
  const [baseStyleId, setBaseStyleId] = useState<string | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);

  // try-on previews — keyed by specHash so they persist across steps and
  // revisiting a previously previewed look is instant (see TryOn).
  const [renderMap, setRenderMap] = useState<RenderMap>({});

  // review
  const [useCaseTag, setUseCaseTag] = useState<UseCaseTag | null>(null);
  const [notes, setNotes] = useState("");

  // submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);

  const summary = useMemo(() => (spec ? generateSummary(spec) : ""), [spec]);
  const stepIndex = stepOrder.indexOf(step);
  const afterHair: Step = visualizationEnabled ? "capture" : "pick";

  // Remember-me: prefill identity from this device so a returning client just
  // taps Continue. Device-local only — never in a URL, consistent with the
  // portability model (the contact IS their key).
  useEffect(() => {
    if (identified) return;
    try {
      const raw = localStorage.getItem(IDENTITY_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { name?: string; contact?: string };
        if (saved.name && saved.contact) {
          setName((n) => n || saved.name!);
          setContact((c) => c || saved.contact!);
          setRemembered(true);
        }
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }, [identified]);

  function clearRemembered() {
    try {
      localStorage.removeItem(IDENTITY_KEY);
    } catch {
      /* ignore */
    }
    setName("");
    setContact("");
    setRemembered(false);
  }

  function continueFromIdentity() {
    // Advance immediately — recognition is a nicety and must not block the flow.
    setStep("hair");
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify({ name: name.trim(), contact }));
    } catch {
      /* ignore */
    }
    fetch("/api/clients/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.found) return;
        setRecognized({ name: data.client.name, history: data.history });
        if (data.client.name) setName(data.client.name);
        if (!hairTouched.current) {
          setHairType(data.client.hairType);
          setDensity(data.client.density);
          if (data.client.faceShape) setFaceShape(data.client.faceShape);
        }
      })
      .catch(() => undefined);
  }

  function pickBase(b: BaseStyleOption) {
    setBaseStyleId(b.id);
    setSpec(structuredClone(b.spec));
    setStep("customize");
  }

  async function submit() {
    if (!spec || !useCaseTag) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shopSlug,
          name,
          contact,
          hairType,
          density,
          faceShape: faceShape || undefined,
          baseStyleId,
          spec,
          useCaseTag,
          notes: notes || undefined,
          photoIds: photos.map((p) => p.id),
          bookingToken: bookingToken ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setBriefId(data.briefId);
      setStep("done");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-5">
      <Header shopName={shopName} step={step} stepIndex={stepIndex} steps={stepOrder} />

      {error ? (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      ) : null}

      {step === "identity" && (
        <Identity
          name={name}
          contact={contact}
          remembered={remembered}
          onName={setName}
          onContact={setContact}
          onClearRemembered={clearRemembered}
          onContinue={continueFromIdentity}
        />
      )}

      {step === "hair" && (
        <Hair
          recognized={recognized}
          hairType={hairType}
          density={density}
          faceShape={faceShape}
          onHairType={(v) => {
            hairTouched.current = true;
            setHairType(v);
          }}
          onDensity={(v) => {
            hairTouched.current = true;
            setDensity(v);
          }}
          onFaceShape={(v) => {
            hairTouched.current = true;
            setFaceShape(v);
          }}
          onBack={identified ? undefined : () => setStep("identity")}
          onContinue={() => setStep(afterHair)}
        />
      )}

      {step === "capture" && (
        <CaptureFlow
          contact={identified ? undefined : contact}
          bookingToken={bookingToken ?? undefined}
          initial={photos}
          onComplete={(p) => {
            setPhotos(p);
            setStep("pick");
          }}
          onSkip={() => {
            setPhotos([]);
            setStep("pick");
          }}
          onBack={() => setStep("hair")}
        />
      )}

      {step === "pick" && (
        <Pick baseStyles={baseStyles} onBack={() => setStep(afterHair)} onPick={pickBase} />
      )}

      {step === "customize" && spec && (
        <Customize
          spec={spec}
          summary={summary}
          hairType={hairType}
          density={density}
          baseName={baseStyles.find((b) => b.id === baseStyleId)?.name}
          photos={photos}
          renderMap={renderMap}
          onRenders={setRenderMap}
          onChange={setSpec}
          onBack={() => setStep("pick")}
          onContinue={() => setStep("review")}
        />
      )}

      {step === "review" && spec && (
        <Review
          spec={spec}
          summary={summary}
          hairType={hairType}
          density={density}
          baseName={baseStyles.find((b) => b.id === baseStyleId)?.name}
          photos={photos}
          renderMap={renderMap}
          onRenders={setRenderMap}
          useCaseTag={useCaseTag}
          notes={notes}
          onUseCase={setUseCaseTag}
          onNotes={setNotes}
          submitting={submitting}
          onBack={() => setStep("customize")}
          onSubmit={submit}
        />
      )}

      {step === "done" && spec && (
        <Done
          spec={spec}
          summary={summary}
          hairType={hairType}
          density={density}
          shopName={shopName}
          briefId={briefId}
          photoCount={photos.length}
        />
      )}
    </main>
  );
}

function Header({
  shopName,
  step,
  stepIndex,
  steps,
}: {
  shopName: string;
  step: Step;
  stepIndex: number;
  steps: Step[];
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Chairside · {shopName}
        </p>
        {step !== "done" ? (
          <p className="text-xs text-neutral-400">
            Step {stepIndex + 1} of {steps.length}
          </p>
        ) : null}
      </div>
      {step !== "done" ? (
        <div className="mt-2 flex gap-1">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn("h-1 flex-1 rounded-full", i <= stepIndex ? "bg-neutral-900" : "bg-neutral-200")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StepTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      {sub ? <p className="mt-1 text-sm text-neutral-500">{sub}</p> : null}
    </div>
  );
}

function FooterNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  loading,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-md gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className={cn(btn.base, btn.secondary, "flex-1")}>
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          className={cn(btn.base, btn.primary, "flex-[2]")}
        >
          {loading ? "…" : nextLabel}
        </button>
      </div>
    </div>
  );
}

// --- Steps -----------------------------------------------------------------

function Identity({
  name,
  contact,
  remembered,
  onName,
  onContact,
  onClearRemembered,
  onContinue,
}: {
  name: string;
  contact: string;
  remembered: boolean;
  onName: (v: string) => void;
  onContact: (v: string) => void;
  onClearRemembered: () => void;
  onContinue: () => void;
}) {
  const ok = name.trim().length > 0 && isPlausibleContact(contact);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onContinue();
      }}
    >
      <StepTitle
        title={remembered ? `Welcome back${name ? `, ${name.split(" ")[0]}` : ""}` : "Let's get your cut right"}
        sub={
          remembered
            ? "We remembered you on this device — just continue, or fix the details below."
            : "Just a name and a contact — no app, no account. Your contact keeps your cut history with you, even at a different shop."
        }
      />
      <div className="space-y-4">
        <Labeled label="Name">
          <TextInput value={name} onChange={onName} placeholder="Your name" name="name" autoComplete="name" enterKeyHint="next" />
        </Labeled>
        <Labeled label="Phone or email" hint="This is your portable key — it loads your history anywhere.">
          <TextInput
            value={contact}
            onChange={onContact}
            placeholder="you@example.com or 0400 000 000"
            name="contact"
            autoComplete="email"
            enterKeyHint="go"
          />
        </Labeled>
        {remembered ? (
          <button
            type="button"
            onClick={onClearRemembered}
            className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800"
          >
            Not you? Clear these details
          </button>
        ) : null}
      </div>
      {/* Hidden submit so the mobile keyboard's Go key advances the form. */}
      <button type="submit" className="hidden" aria-hidden />
      <FooterNav onNext={onContinue} nextDisabled={!ok} nextLabel="Continue" />
    </form>
  );
}

function Hair({
  recognized,
  hairType,
  density,
  faceShape,
  onHairType,
  onDensity,
  onFaceShape,
  onBack,
  onContinue,
}: {
  recognized: { name: string; history: HistoryItem[] } | null;
  hairType: HairType;
  density: Density;
  faceShape: FaceShape | "";
  onHairType: (v: HairType) => void;
  onDensity: (v: Density) => void;
  onFaceShape: (v: FaceShape | "") => void;
  onBack?: () => void;
  onContinue: () => void;
}) {
  return (
    <div>
      {recognized ? (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
          <p className="text-sm font-semibold text-emerald-800">
            Welcome back, {recognized.name.split(" ")[0]} 👋
          </p>
          {recognized.history.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Your history (travels with you)
              </p>
              {recognized.history.slice(0, 4).map((h) => (
                <div key={h.briefId} className="text-xs text-emerald-900">
                  <span className="font-medium">{h.shopName}</span> ·{" "}
                  {h.isActual ? "done" : LABELS.briefStatus[h.status as keyof typeof LABELS.briefStatus] ?? h.status} ·{" "}
                  {h.summary}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-emerald-700">No past cuts on record yet.</p>
          )}
        </div>
      ) : null}

      <StepTitle
        title="Your hair, honestly"
        sub="So the spec is grounded in what you've actually got — this is what keeps expectations real."
      />
      <div className="space-y-5">
        <Labeled label="Hair type">
          <Segmented
            options={HAIR_TYPES.map((v) => ({ value: v, label: LABELS.hairType[v] }))}
            value={hairType}
            onChange={onHairType}
          />
        </Labeled>
        <Labeled label="Density">
          <Segmented
            options={DENSITIES.map((v) => ({ value: v, label: LABELS.density[v] }))}
            value={density}
            onChange={onDensity}
          />
        </Labeled>
        <Labeled label="Face shape (optional)">
          <Segmented
            options={[
              { value: "" as const, label: "Skip" },
              ...FACE_SHAPES.map((v) => ({ value: v, label: LABELS.faceShape[v] })),
            ]}
            value={faceShape}
            onChange={onFaceShape}
          />
        </Labeled>
      </div>
      <FooterNav onBack={onBack} onNext={onContinue} />
    </div>
  );
}

function Pick({
  baseStyles,
  onBack,
  onPick,
}: {
  baseStyles: BaseStyleOption[];
  onBack: () => void;
  onPick: (b: BaseStyleOption) => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const lengths = ["all", "short", "medium", "long"];
  const filtered = baseStyles.filter((b) => filter === "all" || b.tags.includes(filter));

  return (
    <div>
      <StepTitle
        title="Pick a starting point"
        sub="You'll fine-tune the exact numbers next."
      />
      <div className="mb-4">
        <Segmented
          options={lengths.map((l) => ({ value: l, label: l === "all" ? "All" : l[0].toUpperCase() + l.slice(1) }))}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <div className="space-y-3">
        {filtered.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onPick(b)}
            className="block w-full rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-900"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">{b.name}</span>
              {/* "Not yet validated" is internal QA state — only the positive
                  signal is meaningful to a client choosing a cut. */}
              {b.barberValidated ? <Badge tone="green">Barber-validated</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-neutral-500">{b.description}</p>
            <p className="mt-2 text-xs text-neutral-400">{b.summary}</p>
          </button>
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button type="button" onClick={onBack} className={cn(btn.base, btn.secondary, "w-full")}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function Customize({
  spec,
  summary,
  hairType,
  density,
  baseName,
  photos,
  renderMap,
  onRenders,
  onChange,
  onBack,
  onContinue,
}: {
  spec: Spec;
  summary: string;
  hairType: HairType;
  density: Density;
  baseName?: string;
  photos: CapturedPhoto[];
  renderMap: RenderMap;
  onRenders: (updater: (prev: RenderMap) => RenderMap) => void;
  onChange: (s: Spec) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <StepTitle title="Dial in the details" sub="Every control updates the spec your barber reads. The numbers are the point." />
      {photos.length > 0 ? (
        <div className="mb-4">
          <TryOn photos={photos} spec={spec} renders={renderMap} onRenders={onRenders} />
        </div>
      ) : null}
      <div className="mb-5">
        <SpecSheet spec={spec} summary={summary} title={baseName ?? "Your cut"} hairContext={{ hairType, density }} />
      </div>
      <SpecControls value={spec} onChange={onChange} />
      <FooterNav onBack={onBack} onNext={onContinue} />
    </div>
  );
}

function Review({
  spec,
  summary,
  hairType,
  density,
  baseName,
  photos,
  renderMap,
  onRenders,
  useCaseTag,
  notes,
  onUseCase,
  onNotes,
  submitting,
  onBack,
  onSubmit,
}: {
  spec: Spec;
  summary: string;
  hairType: HairType;
  density: Density;
  baseName?: string;
  photos: CapturedPhoto[];
  renderMap: RenderMap;
  onRenders: (updater: (prev: RenderMap) => RenderMap) => void;
  useCaseTag: UseCaseTag | null;
  notes: string;
  onUseCase: (v: UseCaseTag) => void;
  onNotes: (v: string) => void;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <StepTitle title="Review & send to the chair" sub="One last thing — what's this visit about? It helps your barber read the room." />

      {/* Plain caption (not <label>): a label would forward caption taps to the
          first chip and leak its text into every chip's accessible name. */}
      <div>
        <span className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          What&apos;s this visit about?
        </span>
        <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="What's this visit about?">
          {USE_CASE_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onUseCase(t)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition",
                useCaseTag === t
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400",
              )}
            >
              {LABELS.useCaseTag[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <Labeled label="Anything to add for the barber? (optional)">
          <TextArea
            value={notes}
            onChange={onNotes}
            rows={2}
            placeholder="e.g. keep it longer at the front, I have a cowlick on the crown…"
          />
        </Labeled>
      </div>

      {photos.length > 0 ? (
        <div className="mt-5">
          <TryOn photos={photos} spec={spec} renders={renderMap} onRenders={onRenders} />
        </div>
      ) : null}

      <div className="mt-5">
        <SpecSheet
          spec={spec}
          summary={summary}
          title={baseName ?? "Your cut"}
          hairContext={{ hairType, density }}
        />
      </div>

      <FooterNav
        onBack={onBack}
        onNext={onSubmit}
        nextLabel={useCaseTag ? "Send to barber" : "Pick what this visit is about"}
        nextDisabled={!useCaseTag}
        loading={submitting}
      />
    </div>
  );
}

function Done({
  spec,
  summary,
  hairType,
  density,
  shopName,
  briefId,
  photoCount,
}: {
  spec: Spec;
  summary: string;
  hairType: HairType;
  density: Density;
  shopName: string;
  briefId: string | null;
  photoCount: number;
}) {
  return (
    <div>
      <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-4 text-center ring-1 ring-emerald-200">
        <p className="text-lg font-bold text-emerald-800">Sent to {shopName} ✓</p>
        <p className="mt-1 text-sm text-emerald-700">
          {photoCount > 0
            ? `Your photos, previews, and the spec are in your barber's queue.`
            : `Show this spec to your barber, or it's already waiting in their queue.`}
        </p>
        {briefId ? <p className="mt-2 text-[11px] text-emerald-600">Brief ref: {briefId.slice(0, 8)}</p> : null}
      </div>

      {briefId ? (
        <div className="mb-5">
          <ShareSpec path={`/b/${briefId}`} imagePath={`/b/${briefId}/image.svg`} title="Your cut" />
        </div>
      ) : null}

      <SpecSheet spec={spec} summary={summary} title="Your cut" hairContext={{ hairType, density }} />
      <p className="mt-6 text-center text-xs text-neutral-400">
        Your profile and this cut are saved to your contact — they&apos;ll be here next time, at this
        shop or any other.
      </p>
    </div>
  );
}
