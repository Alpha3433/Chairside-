/**
 * SpecSheet — THE core artifact. A scannable card a barber reads in five
 * seconds and trusts. Every number on it is a structured parameter (see
 * lib/spec.ts); the optional illustration is fenced off and clearly labelled.
 */

import type { Spec, HairType, Density } from "@/lib/spec";
import { LABELS, guardLabel } from "@/lib/spec";
import { fadeDescriptor, generateExpectation } from "@/lib/specSummary";
import { HeadDiagram } from "./HeadDiagram";

export interface SpecSheetProps {
  spec: Spec;
  /** Plain-language summary; derived if omitted is not allowed — pass it in. */
  summary: string;
  title?: string;
  subtitle?: string;
  hairContext?: { hairType: HairType; density: Density } | null;
  /** Illustrative render URL (NEVER the source of any number). */
  renderUrl?: string | null;
  /** When true, show the labelled "illustration off" placeholder. */
  showIllustrationSlot?: boolean;
  className?: string;
}

export function SpecSheet({
  spec,
  summary,
  title,
  subtitle,
  hairContext,
  renderUrl,
  showIllustrationSlot,
  className = "",
}: SpecSheetProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold leading-tight text-ink">
            {title ?? "Cut spec"}
          </h3>
          {subtitle ? (
            <p className="text-xs text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
          Authored spec
        </span>
      </div>

      {/* Summary line */}
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="text-sm font-medium text-ink">{summary}</p>
      </div>

      {/* Structured fields */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4">
        <Field
          label="Sides & back"
          value={
            spec.fadeType === "none"
              ? `${guardLabel(spec.sidesGuard)} all over · no fade`
              : `${guardLabel(spec.sidesGuard)} · ${fadeDescriptor(spec)}`
          }
        />
        <Field label="Top" value={topValue(spec)} />
        <Field label="Neckline" value={LABELS.neckline[spec.neckline]} />
        <Field label="Part" value={LABELS.part[spec.part]} />
        <Field label="Texture / finish" value={LABELS.texture[spec.texture]} />
        <Field
          label="Beard"
          value={
            spec.beard && spec.beard.style !== "none"
              ? `${LABELS.beardStyle[spec.beard.style]}${
                  spec.beard.lengthMm != null ? ` · ~${spec.beard.lengthMm}mm` : ""
                }`
              : "None / clean"
          }
        />
      </dl>

      {/* Hair-type + density note (sets expectations explicitly) */}
      {hairContext ? (
        <div className="mx-4 mb-4 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            On {LABELS.hairType[hairContext.hairType].toLowerCase()},{" "}
            {LABELS.density[hairContext.density].toLowerCase()} density
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-900">
            {generateExpectation(spec, hairContext.hairType, hairContext.density)}
          </p>
        </div>
      ) : null}

      {/* Diagram */}
      <div className="border-t border-neutral-100 px-4 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          Labelled diagram
        </p>
        <HeadDiagram spec={spec} />
      </div>

      {/* Optional illustration — strictly fenced + labelled */}
      {renderUrl || showIllustrationSlot ? (
        <Illustration renderUrl={renderUrl} />
      ) : null}
    </div>
  );
}

function topValue(spec: Spec): string {
  const style = LABELS.topStyle[spec.topStyle];
  const dir =
    spec.topDirection === "none" ? "" : `, ${LABELS.topDirection[spec.topDirection].toLowerCase()}`;
  let method = "";
  if (spec.topMethod === "scissor") method = " (scissor)";
  else if (spec.topGuard && spec.topGuard !== "scissor") method = ` (${guardLabel(spec.topGuard)} clipper)`;
  return `~${spec.topLengthMm}mm${method} · ${style}${dir}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function Illustration({ renderUrl }: { renderUrl?: string | null }) {
  return (
    <div className="border-t border-neutral-100 px-4 py-4">
      <div className="relative overflow-hidden rounded-lg bg-neutral-100">
        {renderUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={renderUrl}
            alt="Illustrative render of the cut — not a guarantee"
            className="h-44 w-full object-cover"
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-[repeating-linear-gradient(45deg,#f3f3f3,#f3f3f3_10px,#ececec_10px,#ececec_20px)]">
            <span className="px-4 text-center text-xs text-neutral-400">
              No illustration — the spec above is the source of truth
            </span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
          Illustration — not a guarantee
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
        Any image here is illustrative only. The spec above is the source of
        truth — its numbers come from structured settings, never from a picture.
      </p>
    </div>
  );
}
