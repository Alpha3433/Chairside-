"use client";

/**
 * SpecControls — the structured editor. The ONLY way a spec is built or changed
 * anywhere in the app. Every control maps to one structured parameter; there is
 * no free-text "describe your cut" box that could bypass the vocabulary.
 * Reused by the client customise step and the barber counter/complete forms.
 */

import {
  type Spec,
  type Guard,
  GUARDS,
  FADE_TYPES,
  FADE_HEIGHTS,
  TOP_METHODS,
  TOP_STYLES,
  TOP_DIRECTIONS,
  NECKLINES,
  PARTS,
  TEXTURES,
  BEARD_STYLES,
  LABELS,
  guardLabel,
} from "@/lib/spec";
import { Labeled, Segmented, Select, SliderField, type Option } from "./controls";

function opts<T extends string>(
  values: readonly T[],
  label: (v: T) => string,
): Option<T>[] {
  return values.map((v) => ({ value: v, label: label(v) }));
}

const GUARD_OPTS = opts(GUARDS, guardLabel);
// A clipper top is defined by a guard length; "scissor" is a method, not a
// guard, so it never belongs in the top-guard picker (the method toggle covers it).
const TOP_GUARD_OPTS = GUARD_OPTS.filter((o) => o.value !== "scissor");
const FADE_TYPE_OPTS = opts(FADE_TYPES, (v) => LABELS.fadeType[v]);
const FADE_HEIGHT_OPTS = opts(FADE_HEIGHTS, (v) => LABELS.fadeHeight[v]);
const TOP_METHOD_OPTS = opts(TOP_METHODS, (v) => LABELS.topMethod[v]);
const TOP_STYLE_OPTS = opts(TOP_STYLES, (v) => LABELS.topStyle[v]);
const TOP_DIR_OPTS = opts(TOP_DIRECTIONS, (v) => LABELS.topDirection[v]);
const NECKLINE_OPTS = opts(NECKLINES, (v) => LABELS.neckline[v]);
const PART_OPTS = opts(PARTS, (v) => LABELS.part[v]);
const TEXTURE_OPTS = opts(TEXTURES, (v) => LABELS.texture[v]);
const BEARD_OPTS = opts(BEARD_STYLES, (v) => LABELS.beardStyle[v]);

export function SpecControls({
  value,
  onChange,
}: {
  value: Spec;
  onChange: (s: Spec) => void;
}) {
  const set = (patch: Partial<Spec>) => onChange({ ...value, ...patch });
  const beardOn = !!value.beard && value.beard.style !== "none";

  return (
    <div className="space-y-5">
      {/* Sides & back */}
      <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Sides &amp; back
        </legend>
        <Labeled label="Sides guard" hint="Shortest length at the bottom of the sides.">
          <Segmented options={GUARD_OPTS} value={value.sidesGuard} onChange={(v) => set({ sidesGuard: v })} />
        </Labeled>
        <Labeled label="Fade type">
          <Segmented options={FADE_TYPE_OPTS} value={value.fadeType} onChange={(v) => set({ fadeType: v })} />
        </Labeled>
        {value.fadeType !== "none" ? (
          <Labeled label="Fade height" hint="How high up the head the fade line sits.">
            <Segmented options={FADE_HEIGHT_OPTS} value={value.fadeHeight} onChange={(v) => set({ fadeHeight: v })} />
          </Labeled>
        ) : null}
      </fieldset>

      {/* Top */}
      <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Top
        </legend>
        <Labeled label="Cut with">
          <Segmented
            options={TOP_METHOD_OPTS}
            value={value.topMethod}
            onChange={(v) => set({ topMethod: v, topGuard: v === "scissor" ? null : value.topGuard })}
          />
        </Labeled>
        <Labeled label="Top length" hint="The number the barber works to.">
          <SliderField value={value.topLengthMm} min={0} max={120} onChange={(v) => set({ topLengthMm: v })} />
        </Labeled>
        {value.topMethod === "clipper" ? (
          <Labeled label="Top guard (optional)">
            <Select<Guard | "">
              options={[{ value: "", label: "—" }, ...TOP_GUARD_OPTS] as Option<Guard | "">[]}
              value={(value.topGuard ?? "") as Guard | ""}
              onChange={(v) => set({ topGuard: v === "" ? null : (v as Guard) })}
            />
          </Labeled>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Style">
            <Select options={TOP_STYLE_OPTS} value={value.topStyle} onChange={(v) => set({ topStyle: v })} />
          </Labeled>
          <Labeled label="Direction">
            <Select options={TOP_DIR_OPTS} value={value.topDirection} onChange={(v) => set({ topDirection: v })} />
          </Labeled>
        </div>
      </fieldset>

      {/* Finishing */}
      <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Finishing
        </legend>
        <Labeled label="Neckline">
          <Segmented options={NECKLINE_OPTS} value={value.neckline} onChange={(v) => set({ neckline: v })} />
        </Labeled>
        <Labeled label="Part">
          <Segmented options={PART_OPTS} value={value.part} onChange={(v) => set({ part: v })} />
        </Labeled>
        <Labeled label="Texture / finish">
          <Select options={TEXTURE_OPTS} value={value.texture} onChange={(v) => set({ texture: v })} />
        </Labeled>
      </fieldset>

      {/* Beard */}
      <fieldset className="space-y-4 rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Beard (optional)
        </legend>
        <Labeled label="Beard style">
          <Select
            options={BEARD_OPTS}
            value={value.beard?.style ?? "none"}
            onChange={(v) =>
              set({
                beard: v === "none" ? null : { style: v, lengthMm: value.beard?.lengthMm ?? 6 },
              })
            }
          />
        </Labeled>
        {beardOn ? (
          <Labeled label="Beard length">
            <SliderField
              value={value.beard?.lengthMm ?? 6}
              min={0}
              max={60}
              onChange={(v) => set({ beard: { style: value.beard!.style, lengthMm: v } })}
            />
          </Labeled>
        ) : null}
      </fieldset>
    </div>
  );
}
