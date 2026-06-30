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
- **Try-on (visualization layer):** on a phone, the client flow's capture step uses the camera
  to take front + both sides, then renders the chosen look onto those photos (tap-to-preview);
  the photos + previews land in the barber's brief view. See below.

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
| `RENDER_ENABLED` | `false` | Turn the optional illustrative render on (spec-card render AND the photo try-on). Off → labelled placeholder / stub. |
| `RENDER_API_KEY` | — | Image API key, only read when `RENDER_ENABLED=true`. |
| `RENDER_PROVIDER_URL` | — | Endpoint for the pluggable image-to-image / hair-inpainting provider used by the try-on. |
| `VISUALIZATION_ENABLED` | `true` | Offer the selfie + multi-angle try-on step in the client flow. |
| `STORAGE_DIR` | `.uploads` | Where captured photos + renders are stored in dev (filesystem stub, never public). |
| `INTEGRATIONS_ENABLED` | `true` | Master switch for booking integration + QR onboarding. |
| `BOOKING_TOKEN_TTL_DAYS` | `14` | Personalized-link token lifetime. |
| `SQUARE_ENABLED` / `SQUARE_*` | `false` / — | Tier 1 Square OAuth + webhook (stub mode when off). |
| `ZAPIER_WEBHOOK_SECRET` | — | Tier 2 shared secret for the inbound Zapier webhook (`X-Chairside-Secret`). |
| `MESSAGING_ENABLED` / `MESSAGING_*` | `false` / — | Functional-only customer messaging (stub when off). |
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

## Visualization layer (selfie + multi-angle try-on)

An extension of the client flow's "pick & customise" step — **not a separate app**. It reuses the
spec engine, the base-style library, the portable profile, the data model, and the barber
dashboard. Web-first, any phone, no install: capture uses the standard `getUserMedia` camera API.

**The flow:** `identity → hair → capture → pick → customise (try-on) → details → review → done`.

- **Guided capture** (`src/components/client/CaptureFlow.tsx`) — consent first (Principle 5), then
  a silhouette to align to, an angle prompt, and a lightweight brightness/face check for *guidance
  only* (native `FaceDetector` when available, with a graceful brightness fallback so iOS isn't
  blocked). Front + both sides are the core set; **back is optional and honestly flagged** (a selfie
  can't capture it). Per-angle retake; images are compressed client-side before upload.
- **Try-on** (`src/components/client/TryOn.tsx`, `src/lib/photoRender.ts`) — tap renders the look
  onto the client's **front** photo; "Preview all angles" renders the sides on demand. Every render
  is **cached by `(photo, specHash)`** so re-viewing never re-bills (Principle 4). The provider is
  **pluggable behind `RENDER_ENABLED` + `RENDER_PROVIDER_URL`**; with no key it returns a clearly
  labelled **stub composite** (the photo + the spec), so it's demoable and honest.
- **Sent to the barber** — on submit, captured photos + cached previews attach to the brief and the
  portable profile; the brief view shows them next to the spec (`src/components/barber/BriefMedia.tsx`).

**Render vs. spec stays strict (Principle 1):** the render paints the *look*; the guard sizes,
lengths, fade and neckline always come from the structured spec via `parseSpec`. There is no
image → spec path. Renders are always labelled *"Illustration — not a guarantee."*

**Privacy (Principle 5):** consent is recorded (`Client.photoConsentAt`) before the camera turns
on; photo/render bytes live in the storage stub (`src/lib/storage.ts`) **outside `/public`**, are
served only through the gated `/api/photos/<id>` and `/api/renders/<id>` routes (unguessable id,
`private, no-store`), are **never** put on the public share link, and are **deletable** (per-photo,
or all of a client's via `DELETE /api/photos`). Production hardening seam: swap unguessable-id
gating for signed URLs / ownership checks, and wire real hair-region masking into the provider call.

**Try it live:** open `/s/fade-lab` on a phone (or a desktop with a webcam), reach the capture step,
allow the camera, take the three angles, pick a style, and tap **Preview on my photo**. With
`RENDER_ENABLED=false` (default) you'll see the labelled stub composite.

---

## Booking integration + frictionless QR onboarding

When a client books at a participating shop, they get a **personalized link** that already knows who
they are — straight to scan + style, **zero contact entry**. Coverage is **tiered and honest** (a
common `BookingAdapter` interface; every tier funnels into ONE pipeline, `src/lib/onboard.ts`):

| Tier | Platform | How | Attach back? |
| --- | --- | --- | --- |
| 1 · deep | **Square Appointments** | OAuth + `booking.*` webhook → match/create profile → link; **attach** the brief to the appointment + customer via Custom Attributes | ✅ |
| 2 · trigger | **Gettimely & others via Zapier** | shop's Zap → our signed inbound webhook → same pipeline → deliver the link to the customer | ✗ (no API) |
| 3 · universal | **Fresha / closed / walk-ins** | static **desk QR** → "find your booking / I'm a walk-in" | n/a |

**The token is the vehicle (no PII in URLs, ever).** A static printed QR can't carry identity, so
identity-bearing onboarding uses a **per-booking token**: opaque, random (256-bit), short-TTL, mapped
**server-side** to `{shop, client, booking}` (`BookingToken`). The link is just `/go/<token>`. Opening
it reveals only a **first name + appointment time**; a **light confirmation** (last 3 digits of phone,
or an appointment tap) gates everything else — and the contact **never reaches the browser** (the flow
submits with the token; the server resolves identity). Renders the same token as a QR or a tap button.

**Honesty (held):** Square is deep; the others are trigger/fallback — we don't fabricate APIs for
closed platforms, don't inject into platforms' own emails, and don't encode identity into a shared
static QR. A few Square steps genuinely can't be automated (making a team member "bookable", verifying
exact custom-attribute scopes) — surfaced in the **Integrations** tab.

**Safe to demo without credentials:** `SQUARE_ENABLED=false` runs the whole pipeline in **stub mode**
— the webhook still matches/creates the profile and mints a link; attach/SMS become logged no-ops.
Set a `ZAPIER_WEBHOOK_SECRET` and POST to `/api/webhooks/zapier` to see Tier 2 end-to-end; open
`/find/<slug>` for the Tier 3 desk-QR flow; connect Square from `/barber/<slug>/integrations` for Tier 1.

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
- **Photo** *(visualization)* — a captured angle (front/left/right/back) on the portable
  `Client`, linked to a `Brief` on submit; `storageKey` is opaque (never a public path).
- **Render** — an illustration of a chosen spec on a `Photo`, unique on `(photoId, specHash)`
  so it's billed at most once; the look only, never the numbers.
- **ShopIntegration** *(booking)* — a shop's connection to a platform (Square OAuth tokens /
  Zapier secret), one per `(shop, platform)`.
- **BookingToken** — the personalized-link vehicle: opaque + random + short-TTL, mapped
  server-side to `{shop, client, booking}`; the only thing in a `/go/<token>` URL.

> ⚠️ **The seeded specs are developer placeholders.** Guard numbers, fade heights and top
> lengths in `prisma/seed.ts` are plausible scaffolding, **not** barber-validated ground
> truth (every entry is flagged `barberValidated: false`). A real barber must review and
> correct them before any pilot — the product depends on these numbers being credible.

---

## Tech & scope

Next.js 14 (App Router) · TypeScript · React · Tailwind · Prisma (SQLite dev → Postgres
deploy) · `qrcode` for QR SVGs · browser `getUserMedia` + canvas capture and the native
`FaceDetector` (with a brightness fallback) for the visualization layer — no native/3D deps.
Deployable to Vercel; swap the datasource `provider` to `postgresql`, point `DATABASE_URL` at
Postgres, set `APP_URL`, and move `STORAGE_DIR` to object storage (see `src/lib/storage.ts`).

**Non-goals (held):** no payments, no booking/calendar engine (booking integration is
**read + attach only** — we never create bookings; tiered Square / Zapier / QR-fallback,
platform-agnostic), no native apps, no real-time 3D hair rendering, no production-grade
multi-tenant auth.

### Project layout

```
prisma/            schema (incl. Photo + Render) + seed (curated library + demo data)
src/lib/           spec vocab & types, parse/serialize, summary, diagram math,
                   retention, portable history, render fence, auth, contact key,
                   specCard (exportable SVG), qr, urls, rateLimit,
                   storage (stub), specHash (render cache key), angles, photoRender,
                   tokens, onboard (shared pipeline), messaging, booking/ (adapters)
src/components/    SpecSheet, HeadDiagram, SpecControls, ShareSpec,
                   client/ (flow, CaptureFlow, TryOn, GoOnboarding, FindBooking) and
                   barber/ (incl. BriefMedia) UIs
src/app/           landing, /s/[slug] flow, /b/[id] shareable spec, /go/[token] (booked),
                   /find/[slug] (desk QR), /barber dashboard (+ integrations), /api routes
                   (briefs, clients, photos, renders, qr, tokens, fallback, webhooks,
                   integrations)
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
