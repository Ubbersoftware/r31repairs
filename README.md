# 31Repairs

iPhone repair **booking & live tracking** for a repair shop in Gaborone, Botswana. Customers browse a visual catalog (screen, battery, back glass), book repairs, drop devices at the shop, and track a live status from *received* to *ready for collection*; three co-owners run the catalog, pipeline, invoicing, and warranties from a shared admin surface. Currency is **BWP** (Pula, `P`), money is handled in **thebe** (integer minor units).

This repo is the **Phase 0** foundation: design system, theme, auth + roles, a security-rules baseline, the landing page, and a static service catalog.

- **Product spec:** [`docs/31Repairs-PRD.md`](docs/31Repairs-PRD.md)
- **Architecture & decisions:** [`docs/specs/2026-06-21-architecture-design.md`](docs/specs/2026-06-21-architecture-design.md)
- **Phase 0 plan:** [`docs/specs/2026-06-21-phase0-plan.md`](docs/specs/2026-06-21-phase0-plan.md)

## Tech stack

- **Next.js 16** (App Router, TypeScript strict) on **Vercel**
- **Firebase** (project `lmsb2b`, all data namespaced `r31_*`): Auth, Firestore, Storage
- **Styling:** the `31-repairs-design` system — `src/styles/tokens.css` + CSS Modules. **No Tailwind.** Dark-first, electric-blue accent, dual-theme.
- **Testing:** Vitest + React Testing Library; Firestore rules tested against the emulator with `@firebase/rules-unit-testing`
- **Auth model:** client-side React context for UX; the real security boundary is **Firestore rules + Auth custom claims** (role `owner`)

## Prerequisites

- **Node 20+** and npm
- **Java 17+** (JDK) — only needed to run the security-rules tests (the Firestore emulator requires it)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the Firebase web config (see below)
npm run dev                  # http://localhost:3000
```

`.env.local` holds the Firebase **web** config (public identifiers, safe in the browser) plus a server-only service-account for the owner-bootstrap script. It is gitignored — never commit it. Values come from the Firebase console → Project settings.

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=     # FCM web push (Phase 2)
FIREBASE_SERVICE_ACCOUNT=           # server-only; used by `set-owner`. Never commit.
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Unit/component tests (Vitest) |
| `npm run test:rules` | Firestore rules tests against the emulator (needs Java) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run set-owner -- <email…>` | Grant the `owner` role to existing accounts (see below) |

## Granting owners

Access to `/admin` is gated by the `owner` **custom claim** on a user's Auth token — **not** by the Firestore `role` field (that's just a mirror). To make someone an owner:

1. The person **registers in the app first** (so an Auth account + `r31_users` doc exist).
2. Download a service-account key: Firebase console → **Project settings → Service accounts → Generate new private key** (keep it out of git).
3. Run, passing the key via env:
   ```bash
   FIREBASE_SERVICE_ACCOUNT="$(cat /path/to/service-account.json)" npm run set-owner -- owner1@example.com owner2@example.com
   ```
4. Each granted user must **sign out and back in** to refresh their token. They'll then land on `/admin` at login.

## Deploy model

Two independent deploy targets:

- **App → Vercel.** Push to `main`; Vercel builds and deploys. Set the `NEXT_PUBLIC_FIREBASE_*` env vars in the Vercel project, and add the Vercel domain to **Firebase Auth → Authorized domains** so Google sign-in works in production.
- **Rules/Storage → Firebase CLI.** Security rules are not deployed by Vercel:
  ```bash
  npx firebase-tools deploy --only firestore:rules,storage --project lmsb2b
  ```

## Project structure

```
src/
  app/                 App Router routes
    (marketing)/       public pages (landing, services, faq) — Nav/Footer/CTA
    (auth)/            login + register — minimal layout
    (customer)/        signed-in customer area (account)
    admin/             owner-only admin shell
  components/          ui/, layout/, marketing/, catalog/, auth/
  lib/                 money, catalog (seed + pricing), firebase, auth, content
  styles/              tokens.css (design system) + globals.css
scripts/setOwner.ts    owner-claim bootstrap (firebase-admin)
firestore.rules        deployed to lmsb2b
storage.rules          deployed to lmsb2b
tests/rules/           emulator-based rules tests
```
