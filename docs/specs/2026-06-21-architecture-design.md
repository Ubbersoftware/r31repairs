# 31Repairs — Architecture & Design Spec

**Status:** Approved for build (Phase 0)
**Date:** 2026-06-21
**Source of truth for requirements:** [`docs/31Repairs-PRD.md`](../31Repairs-PRD.md)
**Source of truth for visuals:** `31-repairs-design` skill (installed at `~/.claude/skills/31-repairs-design`)

This document is the whole-app technical design. It records the locked decisions, the
architecture, conventions, and the phasing. Each phase gets its own just-in-time
implementation plan (the first, `2026-06-21-phase0-plan.md`, is produced immediately
after this spec is approved). The PRD remains the authority on *what* we build and on
all customer-facing wording; this spec is the authority on *how*.

---

## 1. Decision log

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Planning approach | Master spec (this doc) + per-phase plans written just-in-time | Plans stay accurate as we learn; "build together" cadence |
| D2 | Web app hosting | **Vercel** | Best-in-class App Router SSR/edge, simple git deploys |
| D3 | Backend | **Firebase** project `lmsb2b` (Auth, Firestore, Storage, Cloud Functions) | Per PRD; project already provisioned, email/password + Google enabled |
| D4 | Local dev | Use the **real** Firebase project (creds supplied) | No emulator indirection needed; creds are available now |
| D5 | v1 order status UI | **Order-level** status pill + timeline | Simpler mobile UX; per-line `lineStatus` still stored for later, no migration |
| D6 | Visual system | The **`31-repairs-design` skill** governs all look/feel | User-supplied, opinionated, TradingView-aligned; **supersedes PRD §11 palette** |
| D7 | Styling implementation | Skill `tokens.css` verbatim + component recipes as **React components with CSS Modules**; **no Tailwind** | Highest fidelity to the skill, zero token drift |
| D8 | Package manager | **npm** | Most Windows-universal (revisit only if friction) |
| D9 | Firestore/Storage namespacing | **`r31_` collection prefix + `r31/` storage prefix** | `lmsb2b` is shared today (31Repairs will take it over as the other app is retired); namespacing avoids collisions and survives the transition |
| D10 | Git remote | **`github.com/Ubbersoftware/r31repairs`** | Repo created; Phase 0 inits git and pushes here |

### 1.1 Reconciliation: design skill supersedes PRD §11

The PRD §11 named a cyan accent (`#27B8E6`), near-black canvas (`#0B0B0C`), and a
`class="dark"` theme strategy. The design skill overrides all three. Effective tokens:

- **Accent:** electric blue `#2962FF` (`--accent`); hover `#1E53E5`.
- **Canvas:** `#131722` (`--bg`); surfaces `#1B2030` / `#222737` / `#2A2E39`.
- **Theme switch:** `data-theme="light"` attribute on `<html>` (dark is the default `:root`).
- **Status semantic colors:** `--success #089981`, `--danger #F23645`, `--warning #FF9800`,
  `--info #2962FF` (== accent).

PRD content (3-month warranty, BWP currency, copy, flows, data model) is unchanged.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) — scaffolded by `create-next-app@latest`; consult `node_modules/next/dist/docs/` for v16 breaking changes (async route params, etc.) |
| Styling | `tokens.css` (skill) global + CSS Modules per component; no CSS framework |
| Fonts | Inter (self-hosted via `next/font`), system fallback stack from the skill |
| Forms / validation | react-hook-form + zod |
| Client data | Firebase Web SDK (v10+ modular) |
| Server / privileged | firebase-admin (in Cloud Functions and Next.js server actions/route handlers where needed) |
| Cloud Functions | TypeScript (2nd-gen where sensible) |
| Push | Firebase Cloud Messaging (web) + service worker |
| Charts (Phase 3) | Recharts |
| Signature (Phase 2) | `signature_pad` → PNG → Storage |
| PDF (Phase 2) | Server-side in a Cloud Function (library finalized in Phase 2 plan) |
| Testing | Vitest + React Testing Library (unit/component); Playwright (e2e, later phases) |
| Hosting | Vercel (app) + Firebase (backend) |

---

## 3. Repository structure

Single repo, two deployables (the Next.js app on Vercel, `functions/` on Firebase).

```
31repairs-app/
  src/
    app/                      # App Router routes (see §6)
      (marketing)/            # public landing, services, faq
      (customer)/             # auth-gated customer area: account, orders, book
      admin/                  # role-gated admin area
      api/                    # route handlers where server logic is needed
    components/
      ui/                     # design-system primitives (Button, Card, Pill, Segmented, Accordion, BottomSheet, ...)
      layout/                 # Nav, Footer, MobileCTA, ThemeToggle, AdminSidebar, BottomNav
      catalog/ orders/ ...     # feature components (added per phase)
    lib/
      firebase/               # client app init, auth helpers, firestore helpers
      money.ts                # thebe <-> Pula helpers
      theme.ts                # theme get/set/persist
      types/                  # shared TS types mirroring the data model
    styles/
      tokens.css              # the skill's tokens.css, VERBATIM
      globals.css             # base layer that imports tokens.css
  functions/                  # Firebase Cloud Functions (TS) — added when first needed (Phase 1)
  public/
    firebase-messaging-sw.js  # FCM service worker (Phase 1)
  firestore.rules
  storage.rules
  firestore.indexes.json
  firebase.json               # functions/rules/storage config (NOT hosting — Vercel hosts the app)
  .env.local                  # Firebase web config (gitignored)
  .env.example                # documented placeholders, committed
  docs/
    31Repairs-PRD.md
    specs/                    # this spec + per-phase plans
```

**Note on Tailwind absence:** `components/ui/*` each pair a `.tsx` with a `.module.css`
that implements the corresponding recipe from the skill's `references/components.md`,
reading only skill tokens. No hex values or off-scale spacing in component CSS.

---

## 4. Configuration & secrets

All Firebase access is via environment variables so nothing is hardcoded.

**Public web config** (`NEXT_PUBLIC_*`, safe to ship to the browser) — from project `lmsb2b`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyASKGXUa_uexn5_PvpwuEiAYUrzbup6d-s
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=lmsb2b.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=lmsb2b
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=lmsb2b.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=387302091297
NEXT_PUBLIC_FIREBASE_APP_ID=1:387302091297:web:95df0ee8063bbfb8539160
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XDZLBNCE54
NEXT_PUBLIC_FIREBASE_VAPID_KEY=            # FCM web push, added in Phase 1
```

**Server-only secrets** (never `NEXT_PUBLIC`, set in Vercel + local `.env.local`, gitignored):

```
FIREBASE_SERVICE_ACCOUNT=...   # admin SDK credentials (JSON), for server actions / setting custom claims
```

`.env.local` is gitignored; `.env.example` documents every key with empty values.
The web config above is not a secret (Firebase web keys are public identifiers; access is
governed by **security rules**, not key secrecy).

> **Note:** `lmsb2b` is a **shared** Firebase project today; 31Repairs will take it over as the
> other application is retired. To avoid collisions during (and after) that transition, all
> 31Repairs data is **namespaced**: Firestore collections are prefixed `r31_` and Storage paths
> are rooted under `r31/` (see §7).

---

## 5. Design-system integration

1. `src/styles/tokens.css` = the skill's `tokens.css`, copied verbatim. Single source of truth.
2. `globals.css` imports it and adds only app-level layout helpers not already in the reset.
3. Every `components/ui` primitive implements one skill recipe (Button, Pricing/Service Card,
   Segmented toggle, Status Pill, Feature list, Quote/Booking form fields, Comparison table,
   FAQ accordion, Testimonial, Footer, Sticky mobile CTA).
4. **Theme toggle:** `theme.ts` reads OS preference on first load, lets the user override,
   persists to `localStorage` and (when signed in) to `users/{uid}` for cross-device. Sets/removes
   `data-theme="light"` on `<html>`. A small inline script in the document head applies the saved
   theme before paint to avoid a flash.
5. **Guardrails enforced in review:** one primary (filled-blue) button per view; no new brand
   colors/gradients/fonts; no pure black/white large surfaces; mobile-first, must render clean at 360px.

**Open visual detail (deferred to Phase 1):** the PRD's 9 order statuses need a color map, but the
skill ships only 4 semantic hues + accent. We will map statuses onto skill tokens (plus, if needed,
1–2 status-only neutral/purple tokens declared explicitly and used *only* for status pills). Finalized
in the Phase 1 (tracking) plan, since Phase 0 has no order statuses.

---

## 6. Information architecture (routes)

Mirrors PRD §5. Route groups separate concerns and apply layout/guards.

**Marketing / public** — `/` landing · `/services` catalog · `/services/[slug]` detail ·
`/faq` · `/login` · `/register`.

**Customer (auth-gated)** — `/book` booking flow · `/account` dashboard ·
`/orders/[id]` order detail.

**Admin (role-gated, `owner` claim)** — `/admin` overview · `/admin/orders` ·
`/admin/orders/[id]` · `/admin/catalog` · `/admin/invoices` · `/admin/warranties` ·
`/admin/faq` · `/admin/revenue` · `/admin/settings`.

Navigation: bottom nav on mobile customer; sidebar on desktop admin; sticky mobile CTA on marketing.

---

## 7. Data model (Firestore)

Per PRD §9, restated as the build contract. All collections are **namespaced with the `r31_`
prefix** (see D9). **Money is stored in thebe (integer minor units)** — `P500` ⇒ `50000`.
Timestamps are Firestore `Timestamp`. TS interfaces live in `src/lib/types`.

- **`r31_users/{uid}`** — `role` (`customer`|`owner`), `fullName`, `email`, `phone`, `photoURL`,
  `fcmTokens[]`, `themePref` (`dark`|`light`|null), `createdAt`, `updatedAt`.
- **`r31_services/{serviceId}`** — `name`, `slug`, `category`, `description`, `imageURL`,
  `hasVariants`, `variants[]`, `active`, `sortOrder`.
- **`r31_phoneModels/{modelId}`** — `name`, `brand` (default `"Apple"`), `active`, `sortOrder`.
- **`r31_prices/{priceId}`** — one per service×model×variant: `serviceId`, `modelId`,
  `variant` (nullable), `amount` (thebe), `available`, `updatedAt`, `updatedBy`.
- **`r31_orders/{orderId}`** — `orderNumber`, `customerId`, `status`, `paymentStatus`,
  `devices[]` `{deviceId, phoneModelId, label, notes}`, `items[]`
  `{itemId, deviceId, serviceId, variant, quotedAmount, finalAmount, lineStatus, completedAt}`,
  `estimatedTotal`, `finalTotal`, `invoiceId?`, `createdAt`, `updatedAt`.
- **`r31_orders/{orderId}/events/{eventId}`** — append-only: `type`, `fromStatus`, `toStatus`,
  `note`, `byUserId`, `byRole`, `at`.
- **`r31_invoices/{invoiceId}`** — `invoiceNumber`, `orderId`, `customerId`, `lineItems[]`,
  `subtotal`, `adjustments[]`, `discount`, `total`, `currency` (`"BWP"`), `status`
  (`draft`|`issued`|`payment_submitted`|`paid`|`cancelled`), `paymentMethod` (`cash`|`bank_transfer`),
  `proofOfPaymentURL?`, `verifiedBy?`, `signatureURL?`, `signedAt?`, `issuedAt`, `paidAt`.
- **`r31_warranties/{warrantyId}`** — `orderId`, `invoiceId`, `customerId`, `itemId`,
  `serviceName`, `phoneModelName`, `startDate`, `endDate`, `status` (`active`|`expired`|`claimed`), `createdAt`.
- **`r31_warranties/{warrantyId}/claims/{claimId}`** — `customerId`, `description`, `photoURLs[]`,
  `status` (`received`|`assessing`|`resolved`|`rejected`), `adminNotes`, `createdAt`, `updatedAt`.
- **`r31_faqs/{faqId}`** — `question`, `answer`, `category`, `active`, `sortOrder`.
- **`r31_notifications/{notifId}`** — `userId`, `type`, `title`, `body`, `link`, `read`, `createdAt`.
- **`r31_settings/shop`** (single doc) — `name`, `address`, `mapURL`, `phone`, `instagram`,
  `logoURL`, `bankDetails`, `warrantyMonths` (default 3).
- **`r31_counters/{counterId}`** — atomic sequence doc(s) backing `orderNumber` / `invoiceNumber`.

**Storage paths (all rooted under `r31/`):** `r31/service-images/`,
`r31/proof-of-payment/{orderId}/`, `r31/signatures/{orderId}/`, `r31/warranty-claims/{claimId}/`,
`r31/branding/`.

---

## 8. Security model

- **Roles via Firebase Auth custom claims.** A user is an owner iff their token carries
  `role: "owner"` (or `owner: true`). Set by a privileged server path (Cloud Function callable or
  admin-SDK server action), never client-writable. Default new users are `customer`.
- **Firestore rules (baseline in Phase 0, tightened per phase) — all on `r31_*` collections:**
  - `r31_users/{uid}`: a user reads/writes only their own doc; owners read all. `role` field is not
    client-writable (enforced by rule + claims).
  - `r31_services`, `r31_phoneModels`, `r31_prices`, `r31_faqs`, `r31_settings`: public read
    (active items); **owner-only** write.
  - `r31_orders` (+ `events`): customer reads/creates **their own**; owners read/write all; `events`
    append-only and never client-deletable.
  - `r31_invoices`: customer reads own; **owner-only** write (customer's only write is
    proof-of-payment URL via a constrained path/Function).
  - `r31_warranties` (+ `claims`): customer reads own + creates claims; owners manage.
  - `r31_notifications`: user reads/updates own (`read` flag).
  - `r31_counters`: no client access — server/Functions only.
- **Storage rules:** uploads scoped to owner-or-self by path; proof-of-payment and signatures
  access-controlled to the owning customer + owners.
- **Route guards:** server-side checks in admin layout/route handlers reading the verified token;
  client guards are UX-only, never the security boundary.
- **App Check** recommended (reCAPTCHA) — enable once flows are stable.

Rules are version-controlled in `firestore.rules` / `storage.rules` and deployed via the Firebase CLI.

---

## 9. Server logic (Cloud Functions)

Introduced when first needed (Phase 1+), all TypeScript:

- **Number generation:** atomic `orderNumber` / `invoiceNumber` via a counter doc in a transaction.
- **Status-change fan-out:** on order status change, write an `events` entry + a `notifications`
  doc + send FCM to the customer's `fcmTokens` (Phase 1).
- **Warranty auto-creation:** on transition to *Completed*, create `warranties` per completed item,
  `endDate = completedAt + settings.warrantyMonths` (Phase 3).
- **PDF generation:** invoices and revenue reports (Phase 2/3).
- **Set custom claims:** privileged callable to grant/revoke `owner` (used to bootstrap the 3 owners).

Triggers are server-authoritative so status/notification logic can't be spoofed from the client,
and the same layer can fan out to WhatsApp/SMS later (PRD §13) without client changes.

---

## 10. Cross-cutting conventions

- **Money:** integer thebe everywhere; `money.ts` exposes `toThebe(pula)`, `formatPula(thebe)`
  (→ `P1,200`). No floats for money. BWP only (v1).
- **Atomicity:** order/invoice writes use transactions/batched writes; `events` is append-only.
- **Auditability:** every status/invoice change attributed to `byUserId` + `byRole` + timestamp.
- **Accessibility:** WCAG AA contrast (tokens are tuned), visible focus rings, 44px tap targets,
  `prefers-reduced-motion` honored, alt text on catalog images.
- **Performance:** `next/image` for catalog/service images; mobile FMP < 3s target.
- **Offline tolerance (admin):** enable Firestore offline persistence for the admin app.

---

## 11. Testing strategy

- **TDD** per the superpowers workflow: red → green → refactor for non-trivial logic.
- **Unit:** `money.ts`, pricing lookups, status transitions, validation schemas (Vitest).
- **Component:** UI primitives and key flows render correctly in both themes (RTL).
- **Rules tests:** Firestore security rules via the rules unit-testing library (from Phase 0 baseline).
- **E2E (later phases):** booking, status progression, invoice+payment, e-sign happy paths (Playwright).

---

## 12. Phasing

Per PRD §14. Each phase ships behind a just-in-time plan; later-phase scope may refine as we learn.

- **Phase 0 — Foundation & design system.** Next.js scaffold, repo structure, `tokens.css` +
  theme system + day/night toggle, core UI components from the skill, Firebase client init,
  Auth (email/password + Google), `customer` default + owner custom-claims bootstrap, security-rules
  baseline + rules tests, route-group layouts & guards, landing page shell, **static** catalog
  rendered from PRD seed pricing. **(Detailed plan: next document.)**
- **Phase 1 — Catalog + booking + tracking (MVP).** Admin catalog CRUD (services, models, pricing
  matrix, availability, image upload); customer registration polish; multi-device/multi-service
  booking; admin order queue (kanban desktop / list mobile); status lifecycle + event log;
  color-coded tracking (finalize status→token map here); in-app notifications + FCM web push;
  FAQ read + admin CRUD.
- **Phase 2 — Invoicing, payments & e-signature.** Invoice generation + adjustment; advance payment
  + proof-of-payment upload; admin verify / close-as-paid (cash); PDF invoices; e-signature at
  collection; *Completed* transition.
- **Phase 3 — Warranty & revenue.** Auto-warranty on completion + warranty views; claims flow +
  admin queue; revenue dashboard (week/month/custom range, charts) + PDF export; settings (shop
  info, bank details, warranty period, admin list).
- **Phase 4 — Enhancements (future).** WhatsApp/SMS; appointment scheduling; reviews; finer staff
  roles; deeper analytics; non-iPhone expansion.

---

## 13. Tracked content dependencies

Not blockers; placeholders used until supplied, flagged where each is consumed:

| Item | Needed by | Placeholder until then |
|---|---|---|
| Exact brand hex / logo assets | Phase 0 (branding), Phase 3 (settings) | Skill accent `#2962FF`, wordmark text |
| Warranty / legal wording | Phase 2 (e-sign), Phase 3 (warranty) | Lorem placeholder |
| Bank transfer details | Phase 2 (advance payment) | Placeholder block in settings |
| Business hours / collection cut-off copy | Phase 0 (landing) | Placeholder copy |
| Email sender identity (domain/provider) | Phase 0/1 (verification emails) | Firebase default sender |
| 3 owner accounts to grant `owner` claim | Phase 0 (bootstrap) | Grant after first sign-ins |

---

## 14. Risks & mitigations

- **Shared Firebase project (`lmsb2b`)** — *Resolved:* collections namespaced `r31_`, storage
  rooted under `r31/` (D9). 31Repairs takes the project over as the other app is retired.
- **App Router SSR + Firebase Auth session** — cookie/session handling across server components.
  *Mitigation:* session-cookie pattern via admin SDK; settle in Phase 0.
- **Status color system vs 4 skill semantics** — *Mitigation:* documented status-only token
  extension, decided in Phase 1.
- **PDF in Cloud Functions** (fonts, BWP formatting) — *Mitigation:* lock library + template in Phase 2.

---

*End of architecture & design spec.*
