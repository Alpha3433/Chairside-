/**
 * HeadDiagram — the 5-second-readable visual (front / side / back).
 *
 * 100% deterministic: drawn from the structured Spec via lib/diagram.ts. No AI,
 * no image input. Same spec → same diagram. Zones are colour-coded to guard
 * lengths and LABELLED with the actual numbers, because the number is the
 * deliverable; the colour is only a fast secondary cue.
 */

import type { Spec } from "@/lib/spec";
import {
  fadeGradientStops,
  sidesColorHex,
  topColorHex,
  topZoneLabel,
  sidesZoneLabel,
} from "@/lib/diagram";
import { LABELS } from "@/lib/spec";

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

const SKIN = "#f0d9c2";
const SKIN_DARK = "#e3c3a6";
const OUTLINE = "#3a2f28";

export function HeadDiagram({
  spec,
  className = "",
}: {
  spec: Spec;
  className?: string;
}) {
  const stops = fadeGradientStops(spec);
  // Content-derived id: identical specs share a (harmless) identical gradient;
  // different specs get distinct ids, so multiple diagrams coexist on a page.
  const gid = `fade-${hash(JSON.stringify(stops) + spec.fadeType + spec.sidesGuard + spec.topLengthMm)}`;
  const topLabel = topZoneLabel(spec);
  const sideLabel = sidesZoneLabel(spec);

  return (
    <div className={`w-full ${className}`}>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            {stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
      </svg>

      <div className="grid grid-cols-3 gap-1 text-center">
        <View label="Front">
          <FrontHead gid={gid} topLabel={topLabel} sideLabel={sideLabel} />
        </View>
        <View label="Side">
          <SideHead
            gid={gid}
            spec={spec}
            topLabel={topLabel}
            sideLabel={sideLabel}
          />
        </View>
        <View label="Back">
          <BackHead gid={gid} spec={spec} sideLabel={sideLabel} />
        </View>
      </div>

      <DiagramLegend spec={spec} />
    </div>
  );
}

function View({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 110 150"
        className="w-full max-w-[140px]"
        role="img"
        aria-label={`${label} view of the cut`}
      >
        {children}
      </svg>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
    </div>
  );
}

function FrontHead({
  gid,
  topLabel,
  sideLabel,
}: {
  gid: string;
  topLabel: string;
  sideLabel: string;
}) {
  return (
    <>
      {/* ears */}
      <ellipse cx="20" cy="84" rx="6" ry="10" fill={SKIN_DARK} stroke={OUTLINE} strokeWidth="1" />
      <ellipse cx="90" cy="84" rx="6" ry="10" fill={SKIN_DARK} stroke={OUTLINE} strokeWidth="1" />
      {/* hair cranium (gradient = fade) */}
      <ellipse cx="55" cy="66" rx="40" ry="48" fill={`url(#${gid})`} stroke={OUTLINE} strokeWidth="1.2" />
      {/* face skin, leaving hair as a frame at top + temples */}
      <ellipse cx="55" cy="82" rx="31" ry="40" fill={SKIN} />
      {/* brow + simple features for orientation */}
      <line x1="40" y1="78" x2="50" y2="78" stroke={SKIN_DARK} strokeWidth="2" strokeLinecap="round" />
      <line x1="60" y1="78" x2="70" y2="78" stroke={SKIN_DARK} strokeWidth="2" strokeLinecap="round" />
      {/* labels */}
      <ZoneTag x={55} y={30} text={topLabel} anchor="middle" />
      <ZoneTag x={14} y={68} text={sideLabel} anchor="start" />
      <ZoneTag x={96} y={68} text={sideLabel} anchor="end" />
    </>
  );
}

function SideHead({
  gid,
  spec,
  topLabel,
  sideLabel,
}: {
  gid: string;
  spec: Spec;
  topLabel: string;
  sideLabel: string;
}) {
  return (
    <>
      {/* hair cranium */}
      <ellipse cx="52" cy="64" rx="42" ry="48" fill={`url(#${gid})`} stroke={OUTLINE} strokeWidth="1.2" />
      {/* face skin shifted forward (right) — leaves hair at back + crown */}
      <path
        d="M64 30
           q26 6 26 44
           q0 30 -22 40
           q-6 3 -10 -2
           q-4 -6 -10 -6
           q-14 0 -14 -34
           q0 -38 30 -42 z"
        fill={SKIN}
      />
      {/* nose hint */}
      <path d="M90 74 q6 4 0 8" fill="none" stroke={SKIN_DARK} strokeWidth="2" strokeLinecap="round" />
      {/* ear */}
      <ellipse cx="60" cy="80" rx="6" ry="9" fill={SKIN_DARK} stroke={OUTLINE} strokeWidth="1" />
      {/* sideburn strip */}
      <rect x="66" y="86" width="5" height="14" rx="2" fill={sidesColorHex(spec)} />
      {/* nape / neckline marker at lower back */}
      <NecklineMarkerSide neckline={spec.neckline} colorSides={sidesColorHex(spec)} />
      {/* labels */}
      <ZoneTag x={48} y={26} text={topLabel} anchor="middle" />
      <ZoneTag x={12} y={92} text={sideLabel} anchor="start" />
    </>
  );
}

function BackHead({
  gid,
  spec,
  sideLabel,
}: {
  gid: string;
  spec: Spec;
  sideLabel: string;
}) {
  return (
    <>
      {/* neck */}
      <rect x="42" y="104" width="26" height="34" rx="6" fill={SKIN} stroke={OUTLINE} strokeWidth="1" />
      {/* ears */}
      <ellipse cx="16" cy="74" rx="5" ry="10" fill={SKIN_DARK} stroke={OUTLINE} strokeWidth="1" />
      <ellipse cx="94" cy="74" rx="5" ry="10" fill={SKIN_DARK} stroke={OUTLINE} strokeWidth="1" />
      {/* hair cranium */}
      <ellipse cx="55" cy="62" rx="40" ry="50" fill={`url(#${gid})`} stroke={OUTLINE} strokeWidth="1.2" />
      {/* neckline shape drawn over the bottom of the hair */}
      <NecklineBack neckline={spec.neckline} colorSides={sidesColorHex(spec)} />
      {/* labels */}
      <ZoneTag x={14} y={64} text={sideLabel} anchor="start" />
      <ZoneTag x={96} y={64} text={sideLabel} anchor="end" />
      <text
        x="55"
        y="128"
        textAnchor="middle"
        className="fill-neutral-600"
        style={{ fontSize: 8 }}
      >
        {LABELS.neckline[spec.neckline].toLowerCase()} neckline
      </text>
    </>
  );
}

/** Back-view neckline: how the hair edge meets the neck. */
function NecklineBack({
  neckline,
  colorSides,
}: {
  neckline: Spec["neckline"];
  colorSides: string;
}) {
  switch (neckline) {
    case "blocked":
      return <rect x="20" y="100" width="70" height="10" fill={colorSides} stroke={OUTLINE} strokeWidth="1" />;
    case "rounded":
      return <path d="M20 100 q35 22 70 0 z" fill={colorSides} stroke={OUTLINE} strokeWidth="1" />;
    case "tapered":
      // fades into skin: soft triangle, no hard edge
      return <path d="M24 98 q31 30 62 0 q-31 8 -62 0 z" fill={colorSides} opacity={0.7} />;
    case "natural":
    default:
      return (
        <path
          d="M22 100 q10 8 18 4 q12 10 24 2 q10 6 20 -2 q-40 12 -62 -4 z"
          fill={colorSides}
          opacity={0.85}
        />
      );
  }
}

/** Side-view nape marker. */
function NecklineMarkerSide({
  neckline,
  colorSides,
}: {
  neckline: Spec["neckline"];
  colorSides: string;
}) {
  const sharp = neckline === "blocked";
  return (
    <path
      d={sharp ? "M14 98 L34 98 L34 104 L14 104 z" : "M14 98 q12 8 22 0 q-3 8 -22 4 z"}
      fill={colorSides}
      stroke={sharp ? OUTLINE : "none"}
      strokeWidth="1"
      opacity={sharp ? 1 : 0.85}
    />
  );
}

function ZoneTag({
  x,
  y,
  text,
  anchor,
}: {
  x: number;
  y: number;
  text: string;
  anchor: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className="fill-neutral-800"
      style={{ fontSize: 9, fontWeight: 600, paintOrder: "stroke" }}
      stroke="#ffffff"
      strokeWidth="2.5"
    >
      {text}
    </text>
  );
}

/** Small legend tying the two zone colours to their guard labels. */
function DiagramLegend({ spec }: { spec: Spec }) {
  return (
    <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-neutral-600">
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 rounded-sm border border-neutral-300"
          style={{ backgroundColor: sidesColorHex(spec) }}
        />
        Sides {sidesZoneLabel(spec)}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 rounded-sm border border-neutral-300"
          style={{ backgroundColor: topColorHex(spec) }}
        />
        Top {topZoneLabel(spec)}
      </span>
    </div>
  );
}
