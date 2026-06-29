import { cn } from "@/lib/cn";
import { LogoutButton } from "./LogoutButton";

const TABS = [
  { key: "queue", label: "Queue", path: "" },
  { key: "clients", label: "Clients", path: "/clients" },
  { key: "retention", label: "Retention", path: "/retention" },
] as const;

export function BarberShell({
  shopName,
  shopSlug,
  active,
  children,
}: {
  shopName: string;
  shopSlug: string;
  active: "queue" | "clients" | "retention";
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Chairside · Barber
            </p>
            <h1 className="text-lg font-bold text-ink">{shopName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="/barber" className="text-xs font-medium text-neutral-400 hover:text-neutral-700">
              Switch shop
            </a>
            <LogoutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 px-3">
          {TABS.map((t) => (
            <a
              key={t.key}
              href={`/barber/${shopSlug}${t.path}`}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium",
                active === t.key
                  ? "border-neutral-900 text-ink"
                  : "border-transparent text-neutral-400 hover:text-neutral-700",
              )}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-6">{children}</main>
    </div>
  );
}
