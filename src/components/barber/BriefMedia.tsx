import { Badge } from "@/components/ui";
import { type Angle, ANGLE_LABELS, ANGLE_ORDER } from "@/lib/angles";

export interface BriefMediaItem {
  angle: Angle;
  photoUrl: string;
  renderUrl: string | null;
  renderStatus: string | null;
}

/**
 * BriefMedia — the visualization layer on the barber side: the client's
 * captured angles plus the cached render of the REQUESTED spec on each photo.
 * The barber sees the look from multiple angles next to the precise numbers in
 * the spec sheet. Renders are clearly illustrative; the spec is the source of
 * truth. Image bytes come from the gated /api/photos|/api/renders routes.
 */
export function BriefMedia({ items }: { items: BriefMediaItem[] }) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => ANGLE_ORDER[a.angle] - ANGLE_ORDER[b.angle]);

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">Client photos &amp; previews</h3>
        <Badge tone="blue">{items.length} angle{items.length === 1 ? "" : "s"}</Badge>
      </div>
      <p className="mb-3 text-xs text-neutral-400">
        Captured by the client. Any render is an illustration of the requested look — work to the
        numbers in the spec, not the picture.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sorted.map((m) => (
          <div key={m.angle} className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="relative bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.renderUrl ?? m.photoUrl}
                alt={`${ANGLE_LABELS[m.angle]} ${m.renderUrl ? "render" : "photo"}`}
                className="aspect-[3/4] w-full object-cover"
              />
              {m.renderUrl ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
                  Illustration
                </span>
              ) : null}
            </div>
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-medium text-neutral-700">{ANGLE_LABELS[m.angle]}</span>
              {m.renderUrl ? (
                <a href={m.photoUrl} target="_blank" rel="noreferrer" className="text-[11px] text-neutral-400 hover:text-neutral-700">
                  photo ↗
                </a>
              ) : (
                <span className="text-[11px] text-neutral-300">photo only</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
