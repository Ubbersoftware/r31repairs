# Phase 1a — Catalog → Firestore + Admin CRUD (Design Spec)

**Date:** 2026-06-22
**Status:** Approved (design); pending implementation plan
**Phase:** 1a of Phase 1 (see decomposition below)
**Depends on:** Phase 0 (foundation, auth/roles, design system, security-rules baseline, static seed catalog) — complete & deployed.

---

## 1. Context & Phase 1 decomposition

Phase 0 shipped the public marketing/catalog pages reading a **static TypeScript seed**
(`src/lib/catalog/seed.ts`: `SEED_SERVICES`, `SEED_MODELS`, `SEED_PRICES`; FAQ in
`src/lib/content/faq.ts`). The Firestore collections from PRD §9 are designed but not yet
implemented — the only live Firestore usage so far is auth/user bootstrap.

PRD Phase 1 is several subsystems and is too large for one spec. It is decomposed into
dependency-ordered sub-phases:

- **Phase 1a — Catalog → Firestore + Admin CRUD** (this spec). Foundation: catalog & FAQ become
  Firestore-backed and owner-managed; public pages read live data. Unblocks everything else.
- **Phase 1b — Booking + Order pipeline + Tracking.** Customer `/book` flow, order creation,
  admin order queue + detail, status lifecycle + append-only event log, customer color-coded
  tracking timeline.
- **Phase 1c — Notifications.** In-app notification center + FCM web push on status changes
  (service worker + likely a server/Cloud-Function trigger).

Each sub-phase gets its own spec → plan → implementation cycle.

## 2. Scope of 1a

**In scope**
- Migrate the static seed (3 services, 18 models, 72 price cells, 6 FAQs) into Firestore.
- Admin **edit** of the existing catalog: prices, per-cell availability, service descriptions,
  service `active` toggle, and **service-image upload**.
- Admin **FAQ CRUD**: add / edit / reorder / activate-deactivate items.
- Switch public `/services`, `/services/[slug]`, `/faq` to read **live Firestore data**
  (server-rendered + cached, revalidated on owner save).
- Extend Firestore + Storage security rules; extend the Vitest + emulator test harness.

**Out of scope (deferred)**
- Creating/archiving **brand-new** services or phone models from scratch (later in Phase 1 or
  Phase 4 "non-iPhone expansion"). 1a edits the known catalog only.
- Booking, orders, tracking, invoicing, notifications (1b/1c and later phases).
- Shop settings doc / bank details / warranty period (Phase 3).

**Decisions locked during brainstorming**
- CRUD scope = "edit existing + images" (not full create/archive).
- FAQ admin editing is included in 1a.
- Data-flow architecture = **Approach ① Hybrid** (see §4).

## 3. Data model (Firestore)

Money in **thebe** (integer minor units), reusing `src/lib/money.ts`. Matches PRD §9.

**`services/{serviceId}`** — `serviceId` = slug (`screen`, `battery`, `back-glass`).
`name, slug, category, description, imageURL (nullable), hasVariants, variants[], active, sortOrder`

**`phoneModels/{modelId}`** — `modelId` = slug (e.g. `iphone-13-pro`).
`name, brand, active, sortOrder`

**`prices/{priceId}`** — **deterministic composite ID** `{serviceId}__{modelId}__{variant|none}`
(e.g. `screen__iphone-13-pro__oled`).
`serviceId, modelId, variant (nullable), amount (thebe int), available, updatedAt, updatedBy`

**`faqs/{faqId}`** — `question, answer, category, active, sortOrder`

Design choices:
- **Deterministic price IDs** make the seed idempotent, map cleanly to the matrix grid, and make
  an edit a single `set`/`update` by known ID.
- **`serviceId` = slug** keeps `/services/[slug]` routing with zero indirection; the existing
  `PriceCell.serviceSlug` shape barely changes.

This Firestore data supersedes the static `SEED_*` arrays as the runtime source of truth; the
seed file becomes migration input only.

## 4. Architecture & data-access (Approach ① Hybrid)

Public reads are server-rendered + cached (SEO + PRD <3s-on-3G + low Firestore cost); admin writes
go through server actions that invalidate that cache; admin reads stay on the client SDK (instant,
live, offline-tolerant for flaky shop Wi-Fi).

**a. Admin SDK singleton** — `src/lib/firebase/admin.ts`
Server-only Firebase Admin init (service-account creds from env, reused across invocations like the
existing client singleton). Used by server reads and server actions.

**b. Cached public reads (server)** — `src/lib/catalog/queries.ts`
`getActiveServices()`, `getServiceBySlug()`, `getPriceMatrix()`, `getActiveFaqs()`. Read via Admin
SDK, wrapped in Next caching and **tagged** (`catalog`, `faqs`). Public RSC pages call these.

**c. Admin mutations (server actions)** — `src/app/admin/catalog/actions.ts`, `.../faq/actions.ts`
Each action: ① re-verify caller is an owner (ID token → Admin SDK), ② validate input (Zod),
③ write via Admin SDK, ④ `revalidateTag('catalog' | 'faqs')`. Firestore rules remain as
defense-in-depth.

**Admin reads** use the **client SDK** for live editing UX + offline tolerance.

> **AGENTS.md caveat:** the exact Next 16 caching/revalidation API (`'use cache'` + `cacheTag`
> vs `unstable_cache`, and `revalidateTag`) will be verified against `node_modules/next/dist/docs/`
> at plan time. The architecture is unchanged either way.

## 5. Seed migration

One-time, **idempotent** script — `src/scripts/seedCatalog.ts`, run via `npm run seed:catalog`
(same `tsx` + Admin SDK pattern as the existing `set-owner` script).

- Writes `SEED_SERVICES` → `services`, `SEED_MODELS` → `phoneModels`, `SEED_PRICES` → `prices`
  (composite IDs; amounts already thebe), and `FAQ_ITEMS` → `faqs`.
- **FAQ enrichment:** current `{q, a}` mapped to full doc — `question, answer, category: 'general',
  active: true, sortOrder: index`. Rename `q/a` → `question/answer` to match the model.
- **Services** seed with `imageURL: null`; owners add images later.
- **Idempotent = create-if-absent per document.** Only missing docs are written → re-running never
  overwrites an owner's edited price or uploaded image. A dev-only `--force` flag wipes & reseeds.

The seed is a *baseline*, never a *reset*.

## 6. Admin UI

Two new pages under the existing admin shell (nav links `Catalog` and `FAQ` already exist).

**`/admin/catalog`**
1. **Services panel** — one card per service: edit description, upload/replace image, toggle active.
   Image flow: client uploads to Storage (`service-images/`) → URL → server action saves `imageURL`
   + revalidates.
2. **Pricing matrix** — rows = 18 models, columns = 4 service/variant combos (Battery, Screen Basic,
   Screen OLED, Back Glass). Each cell = editable **Pula price** + **availability toggle**. Edit
   inline; dirty cells highlight; single **Save changes** button persists all edits in one batched
   server action (atomic, revalidates `catalog`). Prices display/parse as Pula, stored as thebe.

**`/admin/faq`** — list of items, each editable (question, answer, category, active), with add new,
reorder (sortOrder up/down), deactivate.

**Mobile-responsive by design** — matrix renders as a table on desktop and collapses to per-model
cards on mobile (no horizontal-scroll soup); 44px touch targets throughout.

**Reuse / new components** — reuse Button, SegmentedToggle, Pill + `react-hook-form` + `zod`
(existing deps). New: `PriceMatrixEditor`, `ServiceEditorCard`, `ImageUploader`, `FaqEditor`.
Exact layout/pixels are an implementation-time frontend-design concern, not this spec.

## 7. Public wiring

- `/services` → `getActiveServices()` + matrix for "from P—" prices.
- `/services/[slug]` → `getServiceBySlug()` + live Basic/OLED prices per model.
- `/faq` → `getActiveFaqs()`.
- Existing presentational components (`ServiceCard`, `PriceMatrix`, `ServiceDetail`, `Faq`) keep
  their shapes; only their data source moves from seed arrays to the cached queries.
- `revalidateTag` on owner save → edits go live within seconds.
- The seed-array readers `priceFor`/`fromPrice` are replaced by the cached server queries; their
  unit tests move to test the mappers/queries.

## 8. Security rules

Extend Phase 0's deployed rules:
- **Firestore:** public read on `services`, `phoneModels`, `prices`, `faqs`; owner-only write
  (defense-in-depth — server actions use Admin SDK and bypass rules, but rules still block any
  direct client write).
- **Storage:** `service-images/` → public read, owner write.

## 9. Testing (Vitest + emulator)

- **Unit:** Firestore doc ↔ typed-model mappers; matrix price lookup; FAQ ordering; Pula⇄thebe
  (existing).
- **Rules (emulator):** public can read catalog/FAQ; non-owner write denied; owner write allowed —
  extends the current 6 rules tests.
- **Migration:** idempotency — run twice → no duplicates and **no overwrite** of an edited price.
- **Component:** `PriceMatrixEditor` dirty-tracking/batch-save; `FaqEditor`; `ImageUploader`
  (mocked Storage).
- **Server actions:** Zod validation + owner-check rejection paths.

## 10. Config / ops

- Firebase **Admin SDK service-account** credentials added to Vercel env + local `.env.local`,
  with emulator wiring for tests.
- `npm run seed:catalog` script added to `package.json`.
- Run `seed:catalog` once against the live project (and in emulator for tests).

## 11. Definition of done

- Catalog + FAQ live in Firestore; seed migrated idempotently.
- Owners can edit prices/availability/descriptions/images and FAQ items from `/admin/catalog` and
  `/admin/faq`; changes appear on public pages within seconds.
- Public `/services`, `/services/[slug]`, `/faq` render server-side from cached Firestore reads.
- Admin catalog/FAQ pages are mobile-responsive.
- Rules extended & tested; unit/component/rules/migration tests green; typecheck clean.

## 12. Open questions for the build phase

1. **Service-account provisioning:** generate a Firebase service account for the existing GCP
   project; confirm how creds are stored in Vercel (env var with JSON vs base64).
2. **Image constraints:** max upload size / allowed types / client-side resize before upload?
   (Default proposal: JPEG/PNG/WebP, ≤5 MB, no resize in 1a.)
3. **Matrix save granularity:** batched "Save changes" (chosen) vs per-cell autosave — confirm the
   batched approach feels right to owners in practice (revisit after first use).
