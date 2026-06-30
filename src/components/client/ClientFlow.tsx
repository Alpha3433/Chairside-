"use client";

/**
 * ClientFlow — the mobile-first, no-install client journey:
 *   identity → hair → [capture] → pick → customise → details → review → done
 *
 * The optional CAPTURE step is the visualization layer: the client photographs
 * their head (front + sides), then the chosen look is rendered onto their own
 * photo in the customise/details steps (TryOn). Capture is skippable — skipping
 * degrades cleanly to the original text-only brief.
 *
 * Recognition (step 1) is the portability moment. The spec is only ever built
 * from structured controls (SpecControls); the renders are illustrative and
 * fenced (Principle 1). On submit the brief carries the captured photo ids.
 */

import { useMemo, useState } from "react";
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
import { TryOn } from "./TryOn";

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

type Step =
  | "identity"
  | "hair"
  | "capture"
  | "pick"
  | "customize"
  | "details"
  | "review"
  | "done";

export function ClientFlow({
  shopName,
  shopSlug,
  baseStyles,
  renderEnabled,
  visualizationEnabled,
}: {
  shopName: string;
  shopSlug: string;
  baseStyles: BaseStyleOption[];
  renderEnabled: boolean;
  visualizationEnabled: boolean;
}) {
  const stepOrder: Step[] = visualizationEnabled
    ? ["identity", "hair", "capture", "pick", "customize", "details", "review"]
    : ["identity", "hair", "pick", "customize", "details", "review"];

  const [step, setStep] = useState<Step>("identity");

  // identity
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [recognized, setRecognized] = useState<{ name: string; history: HistoryItem[] } | null>(null);
  const [looking, setLooking] = useState(false);

  // hair
  const [hairType, setHairType] = useState<HairType>("straight");
  const [density, setDensity] = useState<Density>("medium");
  const [faceShape, setFaceShape] = useState<FaceShape | "">("");

  // photos (visualization layer)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  // style
  const [baseStyleId, setBaseStyleId] = useState<string | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);

  // details
  const [useCaseTag, setUseCaseTag] = useState<UseCaseTag | null>(null);
  const [notes, setNotes] = useState("");
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  // submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);

  const summary = useMemo(() => (spec ? generateSummary(spec) : ""), [spec]);
  const stepIndex = stepOrder.indexOf(step);
  const afterHair: Step = visualizationEnabled ? "capture" : "pick";

  async function lookup() {
    setLooking(true);
    setError(null);
    try {
      const res = await fetch("/api/clients/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact }),
      });
      const data = await res.json();
      if (data.found) {
        setRecognized({ name: data.client.name, history: data.history });
        setName(data.client.name);
        setHairType(data.client.hairType);
        setDensity(data.client.density);
        if (data.client.faceShape) setFaceShape(data.client.faceShape);
      } else {
        setRecognized(null);
      }
    } catch {
      setRecognized(null);
    } finally {
      setLooking(false);
      setStep("hair");
    }
  }

  function pickBase(b: BaseStyleOption) {
    setBaseStyleId(b.id);
    setSpec(structuredClone(b.spec));
    setRenderUrl(null);
    setStep("customize");
  }

  async function doRender() {
    if (!spec) return;
    setRendering(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const data = await res.json();
      setRenderUrl(data.url ?? null);
    } catch {
      setRenderUrl(null);
    } finally {
      setRendering(false);
    }
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
          looking={looking}
          onName={setName}
          onContact={setContact}
          onContinue={lookup}
        />
      )}

      {step === "hair" && (
        <Hair
          recognized={recognized}
          hairType={hairType}
          density={density}
          faceShape={faceShape}
          onHairType={setHairType}
          onDensity={setDensity}
          onFaceShape={setFaceShape}
          onBack={() => setStep("identity")}
          onContinue={() => setStep(afterHair)}
        />
      )}

      {step === "capture" && (
        <CaptureFlow
          contact={contact}
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
          onChange={setSpec}
          onBack={() => setStep("pick")}
          onContinue={() => setStep("details")}
        />
      )}

      {step === "details" && spec && (
        <Details
          spec={spec}
          summary={summary}
          hairType={hairType}
          density={density}
          photos={photos}
          useCaseTag={useCaseTag}
          notes={notes}
          renderEnabled={renderEnabled}
          renderUrl={renderUrl}
          rendering={rendering}
          onUseCase={setUseCaseTag}
          onNotes={setNotes}
          onRender={doRender}
          onBack={() => setStep("customize")}
          onContinue={() => setStep("review")}
        />
      )}

      {step === "review" && spec && useCaseTag && (
        <Review
          spec={spec}
          summary={summary}
          hairType={hairType}
          density={density}
          baseName={baseStyles.find((b) => b.id === baseStyleId)?.name}
          useCaseTag={useCaseTag}
          renderUrl={renderUrl}
          photos={photos}
          submitting={submitting}
          onBack={() => setStep("details")}
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
          renderUrl={renderUrl}
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
  looking,
  onName,
  onContact,
  onContinue,
}: {
  name: string;
  contact: string;
  looking: boolean;
  onName: (v: string) => void;
  onContact: (v: string) => void;
  onContinue: () => void;
}) {
  const ok = name.trim().length > 0 && isPlausibleContact(contact);
  return (
    <div>
      <StepTitle
        title="Let's get your cut right"
        sub="Just a name and a contact — no app, no account. Your contact keeps your cut history with you, even at a different shop."
      />
      <div className="space-y-4">
        <Labeled label="Name">
          <TextInput value={name} onChange={onName} placeholder="Your name" />
        </Labeled>
        <Labeled label="Phone or email" hint="This is your portable key — it loads your history anywhere.">
          <TextInput value={contact} onChange={onContact} placeholder="you@example.com or 0400 000 000" />
        </Labeled>
      </div>
      <FooterNav onNext={onContinue} nextDisabled={!ok} loading={looking} nextLabel="Continue" />
    </div>
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
  onBack: () => void;
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
        sub="You'll fine-tune the exact numbers next. These are barber-validated base cuts."
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
              {b.barberValidated ? <Badge tone="green">Validated</Badge> : <Badge tone="amber">Placeholder</Badge>}
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
  onChange: (s: Spec) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <StepTitle title="Dial in the details" sub="Every control updates the spec your barber reads. The numbers are the point." />
      {photos.length > 0 ? (
        <div className="mb-4">
          <TryOn photos={photos} spec={spec} />
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

function Details({
  spec,
  summary,
  hairType,
  density,
  photos,
  useCaseTag,
  notes,
  renderEnabled,
  renderUrl,
  rendering,
  onUseCase,
  onNotes,
  onRender,
  onBack,
  onContinue,
}: {
  spec: Spec;
  summary: string;
  hairType: HairType;
  density: Density;
  photos: CapturedPhoto[];
  useCaseTag: UseCaseTag | null;
  notes: string;
  renderEnabled: boolean;
  renderUrl: string | null;
  rendering: boolean;
  onUseCase: (v: UseCaseTag) => void;
  onNotes: (v: string) => void;
  onRender: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <StepTitle
        title="A little context"
        sub="Why now? It helps your barber read the room — this tool is for the moments that matter, not 'the usual'."
      />
      <Labeled label="What's this visit about?">
        <div className="grid grid-cols-1 gap-2">
          {USE_CASE_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onUseCase(t)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left text-sm font-medium transition",
                useCaseTag === t
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400",
              )}
            >
              {LABELS.useCaseTag[t]}
            </button>
          ))}
        </div>
      </Labeled>

      <div className="mt-5">
        <Labeled label="Anything to add for the barber? (optional)">
          <TextArea
            value={notes}
            onChange={onNotes}
            placeholder="e.g. keep it longer at the front, I have a cowlick on the crown…"
          />
        </Labeled>
      </div>

      {photos.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Preview on your photos
          </p>
          <TryOn photos={photos} spec={spec} />
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Optional illustration</p>
            <Badge tone="neutral">Not a guarantee</Badge>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            A picture can help, but it never sets the numbers — the spec does.
          </p>
          {renderEnabled ? (
            <button type="button" onClick={onRender} disabled={rendering} className={cn(btn.base, btn.secondary, "mt-3 w-full")}>
              {rendering ? "Generating…" : renderUrl ? "Regenerate illustration" : "Generate illustration"}
            </button>
          ) : (
            <p className="mt-2 text-[11px] text-neutral-400">
              Rendering is off in this build, so the labelled placeholder below stands in. The spec is
              unaffected.
            </p>
          )}
        </div>
      )}

      <div className="mt-5">
        <SpecSheet
          spec={spec}
          summary={summary}
          title="Your cut"
          hairContext={{ hairType, density }}
          renderUrl={renderUrl}
          showIllustrationSlot={photos.length === 0}
        />
      </div>

      <FooterNav onBack={onBack} onNext={onContinue} nextDisabled={!useCaseTag} />
    </div>
  );
}

function Review({
  spec,
  summary,
  hairType,
  density,
  baseName,
  useCaseTag,
  renderUrl,
  photos,
  submitting,
  onBack,
  onSubmit,
}: {
  spec: Spec;
  summary: string;
  hairType: HairType;
  density: Density;
  baseName?: string;
  useCaseTag: UseCaseTag;
  renderUrl: string | null;
  photos: CapturedPhoto[];
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <StepTitle title="Review & send to the chair" sub="This is exactly what your barber will see." />
      <div className="mb-3 flex items-center gap-2">
        <Badge tone="purple">{LABELS.useCaseTag[useCaseTag]}</Badge>
        {photos.length > 0 ? <Badge tone="blue">{photos.length} photo{photos.length === 1 ? "" : "s"}</Badge> : null}
      </div>
      {photos.length > 0 ? (
        <div className="mb-4">
          <TryOn photos={photos} spec={spec} />
        </div>
      ) : null}
      <SpecSheet
        spec={spec}
        summary={summary}
        title={baseName ?? "Your cut"}
        hairContext={{ hairType, density }}
        renderUrl={renderUrl}
        showIllustrationSlot={photos.length === 0 && !!renderUrl}
      />
      <FooterNav onBack={onBack} onNext={onSubmit} nextLabel="Send to barber" loading={submitting} />
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
  renderUrl,
  photoCount,
}: {
  spec: Spec;
  summary: string;
  hairType: HairType;
  density: Density;
  shopName: string;
  briefId: string | null;
  renderUrl: string | null;
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

      <SpecSheet spec={spec} summary={summary} title="Your cut" hairContext={{ hairType, density }} renderUrl={renderUrl} />
      <p className="mt-6 text-center text-xs text-neutral-400">
        Your profile and this cut are saved to your contact — they&apos;ll be here next time, at this
        shop or any other.
      </p>
    </div>
  );
}
