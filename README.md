# Chairside

**Structured pre-visit haircut communication.** A barbershop client builds a precise
"desired cut" on their phone — no install, no account — and the barber gets a
**structured, barber-readable spec sheet**: guard sizes, top length, fade type/height,
neckline, plus a labelled head diagram. The deliverable is a brief a barber can read in
five seconds and **trust**.

The whole app exists to validate one claim: *structured pre-visit communication reduces
client churn.* It's built so a pilot with real shops can produce that number.

---

## The five rules this build is organised around

1. **The barber side is the product; the client side is frictionless web.** Clients arrive
   via a link/QR — name + phone/email only. Barbers log into a web dashboard.
2. **The deliverable is the SPEC, not the render.** Barbers work from guard numbers and
   lengths, not vibes.
3. **Specs are AUTHORED, never inferred from pixels.** This is the most important rule.
   Spec numbers come from structured parameters and a curated, barber-validated library —
   *never* reverse-engineered from an image. Any render is illustrative only and labelled
   as such. See [The image fence](#the-image-fence-principle-3) below — it's enforced
   structurally.
4. **The client profile is portable and client-owned.** Keyed to the *person*
   (phone/email), not the shop. History travels across shops. This is the moat.
5. **Retention is instrumented from day one.** A shop dashboard compares the rebooking
   rate of briefed vs. non-briefed clients. That comparison is the pilot's whole point.

---

## Quick start

```bash
cp .env.example .env   # dev defaults: SQLite, render off, barber code "letmein"
npm install            # installs deps (Prisma fetches its query engine on postinstall)
npm run setup          # prisma generate + create the SQLite DB + seed library & demo data
npm run dev            # http://localhost:3000
```

Then:

- **Client flow:** open `/s/fade-lab` (or `/s/sharp-co`) — this is what a QR/link points to.
- **Barber dashboard:** open `/barber` — default dev access code is `letmein`.
- **Portability demo:** in **Sharp & Co** (`/s/sharp-co`), enter contact
  `jordan@example.com`. Jordan's history was built at **Fade Lab**, but it's keyed to the
  person, so it loads here — across shops, live.
- **Shareable spec:** finish a client flow and you get a link + QR + "Save image" for the
  spec at `/b/<id>` (image at `/b/<id>/image.svg`).

> **Restricted-network note.** Prisma downloads its engine binaries from
> `binaries.prisma.sh` on postinstall, and some egress proxies reset large downloads
> (`ECONNRESET`/`aborted`). JS packages still install fine. If `npm install` fails on the
> Prisma engine, install JS only and fetch the engines with a resumable download:
>
> ```bash
> npm install --ignore-scripts
> HASH=$(node -p "require('@prisma/engines-version').enginesVersion")
> TARGET=debian-openssl-3.0.x   # match your platform (see `npx prisma -v`)
> BASE="https://binaries.prisma.sh/all_commits/$HASH/$TARGET"
> ENG=node_modules/@prisma/engines
> curl -L --retry 20 --retry-all-errors -C - -o /tmp/qe.gz  "$BASE/libquery_engine.so.node.gz"
> curl -L --retry 20 --retry-all-errors -C - -o /tmp/se.gz  "$BASE/schema-engine.gz"
> gzip -dc /tmp/qe.gz > "$ENG/libquery_engine-$TARGET.so.node"
> gzip -dc /tmp/se.gz > "$ENG/schema-engine-$TARGET" && chmod +x "$ENG/schema-engine-$TARGET"
> npm run setup
> ```
>
> `-C -` resumes the partial file across resets. On a normal network you won't need this.

### Config (`.env`)

Copy `.env.example` to `.env`. The defaults work out of the box for local dev.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite for dev; swap to a Postgres URL to deploy. |
| `APP_URL` | _(empty)_ | Public base URL for QR/share links. Empty = derive from the request host. |
| `RETENTION_WINDOW_DAYS` | `42` | A return counts if it lands within this many days (6 weeks). |
| `RENDER_ENABLED` | `false` | Turn the optional illustrative render on. Off → labelled placeholder. |
| `RENDER_API_KEY` | — | Image API key, only read when `RENDER_ENABLED=true`. |
| `BARBER_ACCESS_CODE` | `letmein` | Shared code gating the barber dashboard (MVP-level). |

---

## The spec sheet (core artifact)

A scannable card (`src/components/SpecSheet.tsx`) containing:

- **Sides & back** — guard + fade type + fade height (e.g. `#1 · Low skin fade`)
- **Top** — length in mm (+ guard, or scissor) + style/direction
- **Neckline** — blocked / rounded / tapered / natural
- **Part**, **Texture/finish**, **Beard**
- **Hair-type + density note** — sets expectations against the client's *real* hair
- **A labelled head diagram** (`src/components/HeadDiagram.tsx`) — front / side / back,
  zones colour-coded to guard lengths, generated **deterministically** from the structured
  params (no AI)
- **A plain-language summary line** derived from the structured fields

Everything on the sheet is a function of the structured `Spec` (`src/lib/spec.ts`).

### Shareable — as a link AND as an image

- **Link:** every brief has a public, read-only page at `/b/<id>` (works with any booking
  system, or none — platform-agnostic by design).
- **Image:** `/b/<id>/image.svg` is a self-contained SVG spec card built by
  `src/lib/specCard.ts`, **deterministically from the structured spec**. The client flow
  and the public page offer copy-link, native share, a QR, and "Save image" (PNG, falling
  back to SVG). Generating the image is itself a one-way `Spec → image` step — see below.

### The image fence (Principle 3)

The optional AI render lives behind a hard architectural fence in `src/lib/render.ts`. Data
flows **one way only**: `Spec → image`. There is intentionally no function anywhere that
turns an image into a spec field, and the `/api/render` response contains a URL and nothing
else. The only way a `Spec` is ever constructed from a request is `parseSpec`
(`src/lib/specSerialize.ts`), which validates every field against the controlled
vocabulary. The exportable spec-card image (`src/lib/specCard.ts`) is likewise generated
*from* the structured spec. This makes "a guard size read off a picture" structurally
impossible, not just discouraged.

---

## How the build answers the three known risks

- **Risk 1 — barbers may not want this.** Briefs are tagged with a *use case*
  (`new_barber`, `big_change`, `specific_complex_style`, `walk_in_to_regular`) so the tool
  wedges into the narrow high-value moments, not "the usual". Specs come from the validated
  library so they're achievable. The barber can **counter-propose** a "closest achievable
  on your hair" spec with a note, and **mark complete capturing what was actually done** —
  value for the barber, not just demands. The hair-type/density note keeps expectations
  honest.
- **Risk 2 — this is a feature, not a company.** The portable, client-owned profile +
  cross-shop history (keyed to `contact`, unique at the schema level) is the defensibility
  play. Leaving costs the client their history.
- **Risk 3 — the churn claim is unproven.** Rebooking is instrumented from visit one. The
  **Retention** tab compares briefed vs. non-briefed return rates over a configurable
  window, and lets a shop log non-briefed walk-ins to build the baseline.

---

## Data model (`prisma/schema.prisma`)

- **Client** *(portable)* — `contact` is unique and shop-agnostic; the recognition key.
- **BaseStyle** *(curated library)* — `defaultSpecJson` is the authored structured spec;
  `barberValidated` is `false` until a real barber signs off.
- **StyleSpec** — discrete structured columns (queryable, unambiguously not a pixel blob);
  `summaryText` is derived, `renderUrl` is illustrative only.
- **Brief** — `requestedSpec` / `barberSpec` (counter) / `actualSpec` (what was done),
  `status`, `useCaseTag`.
- **Shop**, **Barber**.
- **Visit** — the unit of retention analysis; briefed visits link to a `Brief`, non-briefed
  ones are logged manually.

> ⚠️ **The seeded specs are developer placeholders.** Guard numbers, fade heights and top
> lengths in `prisma/seed.ts` are plausible scaffolding, **not** barber-validated ground
> truth (every entry is flagged `barberValidated: false`). A real barber must review and
> correct them before any pilot — the product depends on these numbers being credible.

---

## Tech & scope

Next.js 14 (App Router) · TypeScript · React · Tailwind · Prisma (SQLite dev → Postgres
deploy) · `qrcode` for QR SVGs. Deployable to Vercel; swap the datasource `provider` to
`postgresql`, point `DATABASE_URL` at Postgres, and set `APP_URL`.

**Non-goals (held):** no payments, no booking/calendar engine, no native apps, no real-time
3D hair rendering, no Fresha/Square/Booksy integration (platform-agnostic by link/QR; a
clean seam is left), no production-grade multi-tenant auth.

### Project layout

```
prisma/            schema + seed (the curated library + demo data)
src/lib/           spec vocab & types, parse/serialize, summary, diagram math,
                   retention, portable history, render fence, auth, contact key,
                   specCard (exportable SVG), qr, urls
src/components/    SpecSheet, HeadDiagram, SpecControls, ShareSpec, client/ and barber/ UIs
src/app/           landing, /s/[slug] client flow, /b/[id] shareable spec, /barber
                   dashboard, /api routes
```

### Useful scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run setup` | generate + db push + seed |
| `npm run db:seed` | Re-seed |
| `npm run db:reset` | Drop, recreate, and re-seed the dev DB |
