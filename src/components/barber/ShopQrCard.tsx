import { Card } from "@/components/ui";

/**
 * ShopQrCard — the shop's client link as a QR to print or display at the desk.
 * This is the "arrive via shop link or QR code" half of Principle 1: a client
 * scans it, no install, and lands in the build-a-cut flow. Server-safe (the QR
 * is just an <img> pointing at the /api/qr route); collapsed by default via
 * native <details> so it stays out of the way.
 */
export function ShopQrCard({ url, slug }: { url: string; slug: string }) {
  return (
    <Card className="mb-5 p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Your client QR &amp; link</p>
            <p className="text-xs text-neutral-400">Print or display it — clients scan to build a cut.</p>
          </div>
          <span className="text-xs font-medium text-neutral-400 group-open:hidden">Show</span>
          <span className="hidden text-xs font-medium text-neutral-400 group-open:inline">Hide</span>
        </summary>
        <div className="flex flex-col items-center gap-4 border-t border-neutral-100 px-4 py-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr?text=${encodeURIComponent(url)}&size=320`}
            alt={`QR code for ${slug}`}
            width={160}
            height={160}
            className="h-40 w-40 rounded-lg border border-neutral-200 bg-white p-2"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Client link</p>
            <p className="mt-0.5 break-all text-sm font-medium text-neutral-800">{url}</p>
            <p className="mt-2 text-xs text-neutral-500">
              No app, no account — name + contact only. Their profile and history travel with them
              across shops.
            </p>
          </div>
        </div>
      </details>
    </Card>
  );
}
