# Phase 1a — Catalog → Firestore + Admin CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the catalog and FAQ from static TypeScript seed into Firestore, give owners admin editing (prices, availability, descriptions, images, FAQ CRUD), and serve the public pages from live Firestore data that refreshes on save.

**Architecture:** Public pages are React Server Components that read Firestore via the Firebase **Admin SDK** and are statically prerendered; owner edits go through **server actions** that verify the owner's ID token, write via the Admin SDK, and call **`revalidatePath`** to refresh the affected public routes. Admin editing screens read with the **client SDK** for an instant, live feel. Firestore/Storage security rules enforce owner-only writes as defense-in-depth.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, `firebase` (client SDK) + `firebase-admin` (server), Zod, react-hook-form, Vitest + `@firebase/rules-unit-testing` emulator harness.

## Global Constraints

- **Money is stored in thebe (integer minor units)**; display/parse as Pula `P{amount}` via `src/lib/money.ts`. Never store floats.
- **AGENTS.md:** this Next.js differs from training data — before writing any code touching framework APIs, read the relevant file under `node_modules/next/dist/docs/`. Heed deprecation notices (do **not** use `unstable_cache`; do **not** enable `cacheComponents` in this phase).
- **Revalidation API:** use `revalidatePath` from `next/cache` in server actions (stable). Do not use `cacheTag`/`updateTag`/`'use cache'`.
- **Owner role lives in the Firebase Auth custom claim** `role === 'owner'` (the token claim, not the Firestore field). Server actions must verify it via the Admin SDK.
- **Service-account credentials** are provided to server code through the `FIREBASE_SERVICE_ACCOUNT` env var (full JSON), matching `scripts/setOwner.ts`. Never commit the JSON.
- **`serviceId` = service slug** (`screen`, `battery`, `back-glass`); **`modelId` = model slug** (e.g. `iphone-13-pro`); **price doc ID** = `{serviceId}__{modelId}__{variant|none}`.
- **Mobile-first:** every admin screen must be responsive (table → cards on mobile), 44px minimum touch targets.
- **Test commands:** `npm run typecheck`, `npm test` (Vitest unit/component), `npm run test:rules` (emulator rules). The emulator-backed data tests run under the same `firebase emulators:exec` wrapper as the rules tests.

---

## File Structure

**Create:**
- `src/lib/firebase/admin.ts` — Admin SDK singleton + `verifyOwner(idToken)` helper (server-only).
- `src/lib/catalog/ids.ts` — `priceId()` / `parsePriceId()` deterministic ID helpers.
- `src/lib/catalog/mappers.ts` — Firestore doc ↔ typed-model converters.
- `src/lib/catalog/queries.ts` — server read functions (Admin SDK).
- `src/lib/catalog/validation.ts` — Zod schemas shared by server actions.
- `src/scripts/seedCatalog.ts` — idempotent migration script.
- `src/app/admin/catalog/actions.ts` — catalog server actions.
- `src/app/admin/catalog/page.tsx` + `catalog.module.css` — catalog admin page.
- `src/components/admin/PriceMatrixEditor.tsx` (+ `.module.css`) — pricing grid editor.
- `src/components/admin/ServiceEditorCard.tsx` (+ `.module.css`) — per-service editor.
- `src/components/admin/ImageUploader.tsx` — Storage upload control.
- `src/app/admin/faq/actions.ts` — FAQ server actions.
- `src/app/admin/faq/page.tsx` + `faq.module.css` — FAQ admin page.
- `src/components/admin/FaqEditor.tsx` (+ `.module.css`) — FAQ list editor.
- Test files alongside each unit under test (`*.test.ts(x)`), plus `src/lib/catalog/queries.rules-emulator.test.ts` style emulator tests beside the existing rules tests.

**Modify:**
- `src/lib/types/catalog.ts` — add `Faq`, extend `PriceCell`/add `PriceDoc`.
- `src/lib/content/faq.ts` — rename `q/a` → `question/answer`, export enriched seed.
- `src/lib/catalog/pricing.ts` — repurpose `priceFor`/`fromPrice` to operate on a passed-in matrix (pure), not the seed import.
- `src/app/(marketing)/services/page.tsx`, `src/app/(marketing)/services/[slug]/page.tsx`, `src/app/(marketing)/faq/page.tsx` — read from `queries.ts`.
- `firestore.rules`, `storage.rules` — public read on catalog/faq, owner write; `service-images/` rules.
- `package.json` — add `"seed:catalog"` script.
- `.env.example` — document `FIREBASE_SERVICE_ACCOUNT`.

---

## Task 1: Firebase Admin SDK singleton + owner verification

**Files:**
- Create: `src/lib/firebase/admin.ts`
- Test: `src/lib/firebase/admin.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `getAdminApp(): App`, `getAdminDb(): Firestore`, `getAdminAuth(): Auth`, and `verifyOwner(idToken: string): Promise<DecodedIdToken>` (throws `Error('UNAUTHENTICATED')` if no/invalid token, `Error('FORBIDDEN')` if claim `role !== 'owner'`).

- [ ] **Step 1: Read the framework reference**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md` is NOT needed; instead confirm there are no Next specifics here — this is plain `firebase-admin`. Re-read `scripts/setOwner.ts` for the exact init pattern (`cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))`).

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/firebase/admin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Avoid real network: mock firebase-admin modules.
vi.mock('firebase-admin/app', () => {
  const apps: unknown[] = []
  return {
    getApps: () => apps,
    getApp: () => apps[0],
    initializeApp: (opts: unknown) => { const a = { opts }; apps.push(a); return a },
    cert: (sa: unknown) => ({ sa }),
  }
})
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ kind: 'db' }) }))
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: async (t: string) =>
      t === 'owner-token' ? { uid: 'u1', role: 'owner' }
      : t === 'customer-token' ? { uid: 'u2', role: 'customer' }
      : Promise.reject(new Error('bad token')),
  }),
}))

beforeEach(() => { process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'demo-r31' }) })

describe('admin', () => {
  it('verifyOwner resolves for an owner token', async () => {
    const { verifyOwner } = await import('./admin')
    await expect(verifyOwner('owner-token')).resolves.toMatchObject({ role: 'owner' })
  })
  it('verifyOwner rejects a customer token with FORBIDDEN', async () => {
    const { verifyOwner } = await import('./admin')
    await expect(verifyOwner('customer-token')).rejects.toThrow('FORBIDDEN')
  })
  it('verifyOwner rejects a missing token with UNAUTHENTICATED', async () => {
    const { verifyOwner } = await import('./admin')
    await expect(verifyOwner('')).rejects.toThrow('UNAUTHENTICATED')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/firebase/admin.test.ts`
Expected: FAIL — `Cannot find module './admin'`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/firebase/admin.ts
import 'server-only'
import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth'

export function getAdminApp(): App {
  if (getApps().length) return getApp()
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')
  if (!sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing or invalid')
  return initializeApp({ credential: cert(sa) })
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp())
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp())
}

export async function verifyOwner(idToken: string): Promise<DecodedIdToken> {
  if (!idToken) throw new Error('UNAUTHENTICATED')
  let decoded: DecodedIdToken
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken)
  } catch {
    throw new Error('UNAUTHENTICATED')
  }
  if (decoded.role !== 'owner') throw new Error('FORBIDDEN')
  return decoded
}
```

> If Vitest cannot resolve `server-only` in the unit environment, add `vi.mock('server-only', () => ({}))` at the top of the test (the package throws when imported in a client bundle, not under Node test).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/firebase/admin.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Document the env var**

Append to `.env.example`:

```
# Server-only Firebase Admin credentials (full service-account JSON on one line).
# Firebase console -> Project settings -> Service accounts -> Generate new private key.
# Set in Vercel project env and in local .env.local. NEVER commit the JSON.
FIREBASE_SERVICE_ACCOUNT=
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase/admin.ts src/lib/firebase/admin.test.ts .env.example
git commit -m "feat: firebase admin SDK singleton + verifyOwner helper"
```

---

## Task 2: Deterministic catalog IDs + types

**Files:**
- Create: `src/lib/catalog/ids.ts`, `src/lib/catalog/ids.test.ts`
- Modify: `src/lib/types/catalog.ts`

**Interfaces:**
- Produces: `priceId(serviceId: string, modelId: string, variant: string | null): string`; `parsePriceId(id): { serviceId; modelId; variant: string | null }`.
- Produces (types): `Faq { id; question; answer; category; active; sortOrder }`; `PriceDoc { serviceId; modelId; variant: string | null; amount: number; available: boolean; updatedAt?: number; updatedBy?: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/catalog/ids.test.ts
import { describe, it, expect } from 'vitest'
import { priceId, parsePriceId } from './ids'

describe('priceId', () => {
  it('builds a composite id, encoding null variant as "none"', () => {
    expect(priceId('battery', 'iphone-13', null)).toBe('battery__iphone-13__none')
    expect(priceId('screen', 'iphone-13', 'OLED')).toBe('screen__iphone-13__oled')
  })
  it('round-trips through parsePriceId', () => {
    expect(parsePriceId('screen__iphone-13__oled')).toEqual({
      serviceId: 'screen', modelId: 'iphone-13', variant: 'oled',
    })
    expect(parsePriceId('battery__iphone-13__none')).toEqual({
      serviceId: 'battery', modelId: 'iphone-13', variant: null,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/catalog/ids.test.ts`
Expected: FAIL — `Cannot find module './ids'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/catalog/ids.ts
export function priceId(serviceId: string, modelId: string, variant: string | null): string {
  const v = variant ? variant.toLowerCase() : 'none'
  return `${serviceId}__${modelId}__${v}`
}

export function parsePriceId(id: string): { serviceId: string; modelId: string; variant: string | null } {
  const [serviceId, modelId, v] = id.split('__')
  return { serviceId, modelId, variant: v === 'none' ? null : v }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/catalog/ids.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend the types**

Append to `src/lib/types/catalog.ts`:

```ts
export interface Faq {
  id: string
  question: string
  answer: string
  category: string
  active: boolean
  sortOrder: number
}

// Firestore document shape for prices (composite-ID keyed). serviceId = slug.
export interface PriceDoc {
  serviceId: string
  modelId: string
  variant: string | null
  amount: number // thebe
  available: boolean
  updatedAt?: number // epoch ms
  updatedBy?: string // uid
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/catalog/ids.ts src/lib/catalog/ids.test.ts src/lib/types/catalog.ts
git commit -m "feat: deterministic price IDs + Faq/PriceDoc types"
```

---

## Task 3: Make pricing helpers pure (decouple from seed)

**Files:**
- Modify: `src/lib/catalog/pricing.ts`, `src/lib/catalog/pricing.test.ts`

**Interfaces:**
- Produces: `priceFor(matrix: PriceDoc[], serviceId, modelId, variant): number | null`; `fromPrice(matrix: PriceDoc[], serviceId): number | null`. (Both now take the matrix as the first argument — no seed import.)

- [ ] **Step 1: Rewrite the test to pass a matrix in**

```ts
// src/lib/catalog/pricing.test.ts
import { describe, it, expect } from 'vitest'
import { priceFor, fromPrice } from './pricing'
import type { PriceDoc } from '@/lib/types/catalog'

const M: PriceDoc[] = [
  { serviceId: 'screen', modelId: 'iphone-13', variant: 'Basic', amount: 100000, available: true },
  { serviceId: 'screen', modelId: 'iphone-13', variant: 'OLED', amount: 200000, available: true },
  { serviceId: 'screen', modelId: 'iphone-12', variant: 'Basic', amount: 90000, available: false },
  { serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 80000, available: true },
]

describe('priceFor', () => {
  it('returns the amount for an available cell', () => {
    expect(priceFor(M, 'screen', 'iphone-13', 'OLED')).toBe(200000)
  })
  it('returns null for an unavailable cell', () => {
    expect(priceFor(M, 'screen', 'iphone-12', 'Basic')).toBeNull()
  })
})

describe('fromPrice', () => {
  it('returns the minimum available amount for a service', () => {
    expect(fromPrice(M, 'screen')).toBe(100000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/catalog/pricing.test.ts`
Expected: FAIL — current signatures take no matrix.

- [ ] **Step 3: Rewrite the implementation as pure functions**

```ts
// src/lib/catalog/pricing.ts
import type { PriceDoc } from '@/lib/types/catalog'

export function priceFor(
  matrix: PriceDoc[], serviceId: string, modelId: string, variant: string | null = null,
): number | null {
  const cell = matrix.find(
    (p) => p.serviceId === serviceId && p.modelId === modelId &&
      (p.variant ?? null) === (variant ?? null) && p.available,
  )
  return cell ? cell.amount : null
}

export function fromPrice(matrix: PriceDoc[], serviceId: string): number | null {
  const cells = matrix.filter((p) => p.serviceId === serviceId && p.available)
  return cells.length ? Math.min(...cells.map((c) => c.amount)) : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/catalog/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck (find seed callers)**

Run: `npm run typecheck`
Expected: errors only in files still calling the old signature (the public pages — fixed in Task 9). If any non-page caller breaks, update it to pass the matrix. Do not touch the marketing pages yet.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalog/pricing.ts src/lib/catalog/pricing.test.ts
git commit -m "refactor: make priceFor/fromPrice pure over a passed-in matrix"
```

---

## Task 4: FAQ seed shape + idempotent migration script

**Files:**
- Modify: `src/lib/content/faq.ts`, `package.json`
- Create: `src/scripts/seedCatalog.ts`, `src/scripts/seedCatalog.test.ts`

**Interfaces:**
- Consumes: `SEED_SERVICES`, `SEED_MODELS`, `SEED_PRICES` (from `src/lib/catalog/seed.ts`), `FAQ_SEED` (from `faq.ts`), `priceId` (Task 2), `getAdminDb` (Task 1).
- Produces: `seedCatalog(db: Firestore, opts?: { force?: boolean }): Promise<{ created: number; skipped: number }>` and a CLI entry.

- [ ] **Step 1: Rename FAQ fields + enrich seed**

Replace `src/lib/content/faq.ts` contents:

```ts
import type { Faq } from '@/lib/types/catalog'

const RAW: { question: string; answer: string }[] = [
  { question: 'Are the prices final?', answer: 'The prices shown are seed estimates from our current rates. We confirm the exact quote once we have seen your device, since the final cost can depend on the model and the extent of the damage.' },
  { question: 'How long does a repair take?', answer: 'Most common repairs — screens and batteries — are completed the same day. You can follow your repair live in the app as it moves from received to ready for collection, and we notify you the moment it is done.' },
  { question: 'What does the warranty cover?', answer: 'Every completed repair comes with a 3-month warranty that starts on the date we finish the job. You can view your warranty and raise a claim any time from your account.' },
  { question: "What's the difference between a Basic and an OLED screen?", answer: 'Both screens are tested and fully functional. OLED is the premium option — it delivers the most accurate colour and brightness, just like the original Apple display. Basic is a quality, more affordable alternative.' },
  { question: 'How do I pay?', answer: 'Payment is made at collection by cash or bank transfer. If you pay by transfer, you upload a screenshot as proof of payment in the app and we verify it. You can also choose to pay in advance once an invoice has been raised.' },
  { question: 'Where are you located?', answer: 'We are at Plot 594 Sekgoma, Gaborone. Drop your device with us, and track the repair from your phone until it is ready to collect.' },
]

export const FAQ_SEED: Faq[] = RAW.map((r, i) => ({
  id: `faq-${i + 1}`,
  question: r.question,
  answer: r.answer,
  category: 'general',
  active: true,
  sortOrder: i + 1,
}))
```

> Any component importing the old `FAQ_ITEMS`/`{q,a}` will be re-pointed at the query layer in Task 9; do not change the marketing FAQ page here.

- [ ] **Step 2: Write the failing idempotency test (emulator)**

```ts
// src/scripts/seedCatalog.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { seedCatalog } from './seedCatalog'

let app: App
let db: Firestore

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  app = initializeApp({ projectId: 'demo-r31' }, 'seed-test')
  db = getFirestore(app)
})
afterAll(async () => { await deleteApp(app) })
beforeEach(async () => {
  for (const c of ['services', 'phoneModels', 'prices', 'faqs']) {
    const snap = await db.collection(c).get()
    await Promise.all(snap.docs.map((d) => d.ref.delete()))
  }
})

describe('seedCatalog', () => {
  it('creates 3 services, 18 models, 72 prices, 6 faqs on first run', async () => {
    const r = await seedCatalog(db)
    expect((await db.collection('services').get()).size).toBe(3)
    expect((await db.collection('phoneModels').get()).size).toBe(18)
    expect((await db.collection('prices').get()).size).toBe(72)
    expect((await db.collection('faqs').get()).size).toBe(6)
    expect(r.created).toBe(99)
  })

  it('is idempotent and never overwrites an edited price', async () => {
    await seedCatalog(db)
    const id = 'battery__iphone-13__none'
    await db.collection('prices').doc(id).update({ amount: 1 }) // owner edit
    const r2 = await seedCatalog(db)
    expect(r2.created).toBe(0)
    expect((await db.collection('prices').get()).size).toBe(72) // no dupes
    expect((await db.collection('prices').doc(id).get()).data()?.amount).toBe(1) // preserved
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:rules -- src/scripts/seedCatalog.test.ts` (runs inside the emulator wrapper)
Expected: FAIL — `Cannot find module './seedCatalog'`.

> If the existing `test:rules` config does not pick up `src/scripts`, run the file through the same emulator wrapper used for rules tests: `firebase emulators:exec --only firestore --project demo-r31 "vitest run src/scripts/seedCatalog.test.ts"`.

- [ ] **Step 4: Write the migration script**

```ts
// src/scripts/seedCatalog.ts
import type { Firestore } from 'firebase-admin/firestore'
import { SEED_SERVICES, SEED_MODELS, SEED_PRICES } from '@/lib/catalog/seed'
import { FAQ_SEED } from '@/lib/content/faq'
import { priceId } from '@/lib/catalog/ids'

type Row = { col: string; id: string; data: Record<string, unknown> }

function rows(): Row[] {
  const out: Row[] = []
  for (const s of SEED_SERVICES) out.push({ col: 'services', id: s.id, data: { ...s, imageURL: null } })
  for (const m of SEED_MODELS) out.push({ col: 'phoneModels', id: m.id, data: { ...m } })
  for (const p of SEED_PRICES) {
    const id = priceId(p.serviceSlug, p.modelId, p.variant)
    out.push({
      col: 'prices', id,
      data: { serviceId: p.serviceSlug, modelId: p.modelId, variant: p.variant, amount: p.amount, available: p.available },
    })
  }
  for (const f of FAQ_SEED) out.push({ col: 'faqs', id: f.id, data: { ...f } })
  return out
}

export async function seedCatalog(
  db: Firestore, opts: { force?: boolean } = {},
): Promise<{ created: number; skipped: number }> {
  let created = 0, skipped = 0
  for (const r of rows()) {
    const ref = db.collection(r.col).doc(r.id)
    if (!opts.force) {
      const existing = await ref.get()
      if (existing.exists) { skipped++; continue }
    }
    await ref.set(r.data)
    created++
  }
  return { created, skipped }
}

// CLI entry: `npm run seed:catalog` (add `-- --force` to overwrite).
if (process.argv[1] && process.argv[1].endsWith('seedCatalog.ts')) {
  const run = async () => {
    const { getAdminDb } = await import('@/lib/firebase/admin')
    const force = process.argv.includes('--force')
    const r = await seedCatalog(getAdminDb(), { force })
    console.log(`Seed complete: created ${r.created}, skipped ${r.skipped}${force ? ' (force)' : ''}`)
  }
  run().catch((e) => { console.error(e); process.exit(1) })
}
```

- [ ] **Step 5: Add the npm script**

In `package.json` `"scripts"`, add:

```json
"seed:catalog": "tsx src/scripts/seedCatalog.ts",
```

> `tsx` must resolve the `@/` alias. If it does not, add `tsconfig-paths`/`tsx`'s `--tsconfig` handling is automatic via `tsconfig.json` `paths`; if the CLI entry fails to resolve `@/`, change the three `@/...` imports in the CLI block to relative paths.

- [ ] **Step 6: Run test to verify it passes**

Run: `firebase emulators:exec --only firestore --project demo-r31 "vitest run src/scripts/seedCatalog.test.ts"`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/content/faq.ts src/scripts/seedCatalog.ts src/scripts/seedCatalog.test.ts package.json
git commit -m "feat: idempotent catalog/faq seed migration script"
```

---

## Task 5: Server query layer (Admin SDK reads + mappers)

**Files:**
- Create: `src/lib/catalog/mappers.ts`, `src/lib/catalog/mappers.test.ts`
- Create: `src/lib/catalog/queries.ts`, `src/lib/catalog/queries.test.ts`

**Interfaces:**
- Produces (mappers): `toService(id, data): Service`, `toPhoneModel(id, data): PhoneModel`, `toPriceDoc(data): PriceDoc`, `toFaq(id, data): Faq`.
- Produces (queries): `getActiveServices(): Promise<Service[]>`, `getServiceBySlug(slug): Promise<Service | null>`, `getPriceMatrix(): Promise<PriceDoc[]>`, `getActiveFaqs(): Promise<Faq[]>`. All read via `getAdminDb()` and sort by `sortOrder`. Active-only for public lists.

- [ ] **Step 1: Write the failing mapper test**

```ts
// src/lib/catalog/mappers.test.ts
import { describe, it, expect } from 'vitest'
import { toService, toFaq, toPriceDoc } from './mappers'

describe('mappers', () => {
  it('toService fills defaults for missing optional fields', () => {
    const s = toService('screen', { name: 'Screen Replacement', slug: 'screen', category: 'display', description: 'd', hasVariants: true, variants: ['Basic', 'OLED'], active: true, sortOrder: 1 })
    expect(s).toMatchObject({ id: 'screen', imageURL: null, hasVariants: true })
  })
  it('toPriceDoc coerces variant undefined to null', () => {
    expect(toPriceDoc({ serviceId: 'battery', modelId: 'iphone-13', amount: 80000, available: true }).variant).toBeNull()
  })
  it('toFaq maps fields', () => {
    expect(toFaq('faq-1', { question: 'q', answer: 'a', category: 'general', active: true, sortOrder: 1 }).question).toBe('q')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/catalog/mappers.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement mappers**

```ts
// src/lib/catalog/mappers.ts
import type { Service, PhoneModel, PriceDoc, Faq } from '@/lib/types/catalog'

type D = Record<string, any>

export function toService(id: string, d: D): Service {
  return {
    id, name: d.name, slug: d.slug ?? id, category: d.category ?? '',
    description: d.description ?? '', hasVariants: !!d.hasVariants,
    variants: d.variants ?? [], active: !!d.active, sortOrder: d.sortOrder ?? 0,
    // imageURL is on the doc but not in the Service type; expose via a widened return:
    ...(d.imageURL !== undefined ? { imageURL: d.imageURL } : { imageURL: null }),
  } as Service & { imageURL: string | null }
}

export function toPhoneModel(id: string, d: D): PhoneModel {
  return { id, name: d.name, brand: d.brand ?? 'Apple', active: !!d.active, sortOrder: d.sortOrder ?? 0 }
}

export function toPriceDoc(d: D): PriceDoc {
  return {
    serviceId: d.serviceId, modelId: d.modelId, variant: d.variant ?? null,
    amount: d.amount, available: !!d.available, updatedAt: d.updatedAt, updatedBy: d.updatedBy,
  }
}

export function toFaq(id: string, d: D): Faq {
  return { id, question: d.question, answer: d.answer, category: d.category ?? 'general', active: !!d.active, sortOrder: d.sortOrder ?? 0 }
}
```

> Add `imageURL: string | null` to the `Service` interface in `src/lib/types/catalog.ts` so `toService`'s return is typed cleanly (update the interface, drop the `as` cast). Re-run `npm run typecheck`.

- [ ] **Step 4: Run mapper test to verify it passes**

Run: `npm test -- src/lib/catalog/mappers.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing queries test (emulator)**

```ts
// src/lib/catalog/queries.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { seedCatalog } from '@/scripts/seedCatalog'

let app: App, db: Firestore
beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'demo-r31' })
  app = initializeApp({ projectId: 'demo-r31' }, 'queries-test')
  db = getFirestore(app)
})
afterAll(async () => { await deleteApp(app) })
beforeEach(async () => {
  for (const c of ['services', 'phoneModels', 'prices', 'faqs']) {
    const snap = await db.collection(c).get(); await Promise.all(snap.docs.map((d) => d.ref.delete()))
  }
  await seedCatalog(db)
})

describe('queries', () => {
  it('getActiveServices returns active services in sortOrder', async () => {
    const { getActiveServices } = await import('./queries')
    const s = await getActiveServices()
    expect(s.map((x) => x.id)).toEqual(['screen', 'battery', 'back-glass'])
  })
  it('getServiceBySlug returns one or null', async () => {
    const { getServiceBySlug } = await import('./queries')
    expect((await getServiceBySlug('battery'))?.name).toBe('Battery Replacement')
    expect(await getServiceBySlug('nope')).toBeNull()
  })
  it('getPriceMatrix returns 72 cells', async () => {
    const { getPriceMatrix } = await import('./queries')
    expect((await getPriceMatrix()).length).toBe(72)
  })
})
```

> The query module reads via `getAdminDb()`. In the emulator test the Admin SDK auto-connects to `FIRESTORE_EMULATOR_HOST`. Ensure `getActiveServices` etc. call `getAdminDb()` lazily (inside the function), so the emulator env is read at call time.

- [ ] **Step 6: Run test to verify it fails**

Run: `firebase emulators:exec --only firestore --project demo-r31 "vitest run src/lib/catalog/queries.test.ts"`
Expected: FAIL — `./queries` missing.

- [ ] **Step 7: Implement queries**

```ts
// src/lib/catalog/queries.ts
import 'server-only'
import { getAdminDb } from '@/lib/firebase/admin'
import { toService, toPhoneModel, toPriceDoc, toFaq } from './mappers'
import type { Service, PhoneModel, PriceDoc, Faq } from '@/lib/types/catalog'

export async function getActiveServices(): Promise<Service[]> {
  const snap = await getAdminDb().collection('services').where('active', '==', true).get()
  return snap.docs.map((d) => toService(d.id, d.data())).sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const doc = await getAdminDb().collection('services').doc(slug).get()
  if (!doc.exists) return null
  const s = toService(doc.id, doc.data() as Record<string, unknown>)
  return s.active ? s : null
}

export async function getActiveModels(): Promise<PhoneModel[]> {
  const snap = await getAdminDb().collection('phoneModels').where('active', '==', true).get()
  return snap.docs.map((d) => toPhoneModel(d.id, d.data())).sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getPriceMatrix(): Promise<PriceDoc[]> {
  const snap = await getAdminDb().collection('prices').get()
  return snap.docs.map((d) => toPriceDoc(d.data()))
}

export async function getActiveFaqs(): Promise<Faq[]> {
  const snap = await getAdminDb().collection('faqs').where('active', '==', true).get()
  return snap.docs.map((d) => toFaq(d.id, d.data())).sort((a, b) => a.sortOrder - b.sortOrder)
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `firebase emulators:exec --only firestore --project demo-r31 "vitest run src/lib/catalog/queries.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/catalog/mappers.ts src/lib/catalog/mappers.test.ts src/lib/catalog/queries.ts src/lib/catalog/queries.test.ts src/lib/types/catalog.ts
git commit -m "feat: catalog mappers + Admin SDK server query layer"
```

---

## Task 6: Security rules — public read catalog/FAQ, owner write

**Files:**
- Modify: `firestore.rules`, `storage.rules`
- Create/Modify: rules test beside existing ones (follow the file the Phase 0 6 tests live in; add cases there or a new `catalog.rules.test.ts`).

**Interfaces:**
- Produces: deployed rules where `services`, `phoneModels`, `prices`, `faqs` are publicly readable and writable only when `request.auth.token.role == 'owner'`; Storage `service-images/**` publicly readable, writable only by owners.

- [ ] **Step 1: Read the existing rules + test harness**

Read `firestore.rules`, `storage.rules`, and the existing rules test file to match style (the harness uses `@firebase/rules-unit-testing` with project `demo-r31`).

- [ ] **Step 2: Write failing rules tests**

Add to the rules test suite:

```ts
// catalog rules (add to the existing rules test file)
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'

it('anyone can read services, nobody-but-owner can write', async () => {
  const anon = testEnv.unauthenticatedContext().firestore()
  await assertSucceeds(anon.collection('services').doc('screen').get())
  await assertFails(anon.collection('services').doc('screen').set({ name: 'x' }))

  const customer = testEnv.authenticatedContext('c1', { role: 'customer' }).firestore()
  await assertFails(customer.collection('prices').doc('battery__iphone-13__none').set({ amount: 1 }))

  const owner = testEnv.authenticatedContext('o1', { role: 'owner' }).firestore()
  await assertSucceeds(owner.collection('prices').doc('battery__iphone-13__none').set({ amount: 1, serviceId: 'battery', modelId: 'iphone-13', variant: null, available: true }))
})

it('faqs are public-read, owner-write', async () => {
  const anon = testEnv.unauthenticatedContext().firestore()
  await assertSucceeds(anon.collection('faqs').doc('faq-1').get())
  await assertFails(anon.collection('faqs').doc('faq-1').set({ question: 'x' }))
  const owner = testEnv.authenticatedContext('o1', { role: 'owner' }).firestore()
  await assertSucceeds(owner.collection('faqs').doc('faq-1').set({ question: 'q', answer: 'a', category: 'general', active: true, sortOrder: 1 }))
})
```

- [ ] **Step 3: Run rules tests to verify they fail**

Run: `npm run test:rules`
Expected: FAIL — current rules don't grant these (catalog collections likely default-deny).

- [ ] **Step 4: Add the Firestore rules**

In `firestore.rules`, inside `match /databases/{database}/documents`, add:

```
function isOwner() {
  return request.auth != null && request.auth.token.role == 'owner';
}
match /services/{id}     { allow read: if true; allow write: if isOwner(); }
match /phoneModels/{id}  { allow read: if true; allow write: if isOwner(); }
match /prices/{id}       { allow read: if true; allow write: if isOwner(); }
match /faqs/{id}         { allow read: if true; allow write: if isOwner(); }
```

> If an `isOwner()` helper already exists in the file, reuse it instead of redefining.

- [ ] **Step 5: Add the Storage rules**

In `storage.rules`:

```
match /service-images/{file=**} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.role == 'owner';
}
```

- [ ] **Step 6: Run rules tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS (existing 6 + new cases).

- [ ] **Step 7: Commit**

```bash
git add firestore.rules storage.rules <rules-test-file>
git commit -m "feat: security rules for catalog/faq public read + owner write"
```

---

## Task 7: Catalog server actions (validate, owner-verify, write, revalidate)

**Files:**
- Create: `src/lib/catalog/validation.ts`, `src/lib/catalog/validation.test.ts`
- Create: `src/app/admin/catalog/actions.ts`, `src/app/admin/catalog/actions.test.ts`

**Interfaces:**
- Consumes: `verifyOwner`, `getAdminDb` (Task 1); `priceId` (Task 2); `revalidatePath` (`next/cache`).
- Produces:
  - `savePricesAction(idToken: string, edits: PriceEdit[]): Promise<ActionResult>` where `PriceEdit = { serviceId; modelId; variant: string | null; amount: number; available: boolean }`.
  - `saveServiceAction(idToken: string, input: { id: string; description: string; active: boolean }): Promise<ActionResult>`.
  - `setServiceImageAction(idToken: string, input: { id: string; imageURL: string }): Promise<ActionResult>`.
  - `ActionResult = { ok: true } | { ok: false; error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID'; message?: string }`.

- [ ] **Step 1: Write the failing validation test**

```ts
// src/lib/catalog/validation.test.ts
import { describe, it, expect } from 'vitest'
import { priceEditSchema, serviceInputSchema } from './validation'

describe('priceEditSchema', () => {
  it('accepts a valid edit', () => {
    expect(priceEditSchema.safeParse({ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 80000, available: true }).success).toBe(true)
  })
  it('rejects negative or non-integer thebe amounts', () => {
    expect(priceEditSchema.safeParse({ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: -1, available: true }).success).toBe(false)
    expect(priceEditSchema.safeParse({ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 1.5, available: true }).success).toBe(false)
  })
})

describe('serviceInputSchema', () => {
  it('rejects an empty description', () => {
    expect(serviceInputSchema.safeParse({ id: 'screen', description: '', active: true }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/catalog/validation.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement Zod schemas**

```ts
// src/lib/catalog/validation.ts
import { z } from 'zod'

export const priceEditSchema = z.object({
  serviceId: z.string().min(1),
  modelId: z.string().min(1),
  variant: z.string().min(1).nullable(),
  amount: z.number().int().nonnegative(),
  available: z.boolean(),
})
export type PriceEdit = z.infer<typeof priceEditSchema>

export const serviceInputSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(2000),
  active: z.boolean(),
})
export type ServiceInput = z.infer<typeof serviceInputSchema>

export const serviceImageSchema = z.object({
  id: z.string().min(1),
  imageURL: z.string().url(),
})
```

- [ ] **Step 4: Run validation test to verify it passes**

Run: `npm test -- src/lib/catalog/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing actions test**

```ts
// src/app/admin/catalog/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const writes: Record<string, unknown>[] = []
const revalidated: string[] = []

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { revalidated.push(p) } }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error(t === 'cust' ? 'FORBIDDEN' : 'UNAUTHENTICATED'); return { uid: 'o1' } },
  getAdminDb: () => ({
    batch: () => ({
      set: (_ref: unknown, data: Record<string, unknown>) => { writes.push(data) },
      commit: async () => {},
    }),
    collection: () => ({ doc: () => ({ id: 'x' }) }),
  }),
}))

beforeEach(() => { writes.length = 0; revalidated.length = 0 })

describe('savePricesAction', () => {
  it('rejects a non-owner', async () => {
    const { savePricesAction } = await import('./actions')
    expect(await savePricesAction('cust', [])).toEqual({ ok: false, error: 'FORBIDDEN' })
  })
  it('rejects invalid input', async () => {
    const { savePricesAction } = await import('./actions')
    const r = await savePricesAction('owner', [{ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: -5, available: true }])
    expect(r).toMatchObject({ ok: false, error: 'INVALID' })
  })
  it('writes valid edits and revalidates the public catalog', async () => {
    const { savePricesAction } = await import('./actions')
    const r = await savePricesAction('owner', [{ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 80000, available: true }])
    expect(r).toEqual({ ok: true })
    expect(writes.length).toBe(1)
    expect(revalidated).toContain('/services')
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/app/admin/catalog/actions.test.ts`
Expected: FAIL — `./actions` missing.

- [ ] **Step 7: Implement the catalog actions**

```ts
// src/app/admin/catalog/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { priceId } from '@/lib/catalog/ids'
import { priceEditSchema, serviceInputSchema, serviceImageSchema, type PriceEdit } from '@/lib/catalog/validation'
import { z } from 'zod'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID'; message?: string }

function fail(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : 'INVALID'
  if (msg === 'UNAUTHENTICATED' || msg === 'FORBIDDEN') return { ok: false, error: msg }
  return { ok: false, error: 'INVALID', message: msg }
}

function revalidateCatalog() {
  revalidatePath('/services')
  revalidatePath('/services/[slug]', 'page')
}

export async function savePricesAction(idToken: string, edits: PriceEdit[]): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = z.array(priceEditSchema).safeParse(edits)
  if (!parsed.success) return { ok: false, error: 'INVALID', message: 'bad price edits' }
  const db = getAdminDb()
  const batch = db.batch()
  for (const e of parsed.data) {
    const ref = db.collection('prices').doc(priceId(e.serviceId, e.modelId, e.variant))
    batch.set(ref, { ...e, updatedAt: Date.now(), updatedBy: uid }, { merge: true })
  }
  await batch.commit()
  revalidateCatalog()
  return { ok: true }
}

export async function saveServiceAction(
  idToken: string, input: { id: string; description: string; active: boolean },
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = serviceInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  await getAdminDb().collection('services').doc(parsed.data.id).set(
    { description: parsed.data.description, active: parsed.data.active, updatedAt: Date.now(), updatedBy: uid },
    { merge: true },
  )
  revalidateCatalog()
  return { ok: true }
}

export async function setServiceImageAction(
  idToken: string, input: { id: string; imageURL: string },
): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  const parsed = serviceImageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  await getAdminDb().collection('services').doc(parsed.data.id).set({ imageURL: parsed.data.imageURL }, { merge: true })
  revalidateCatalog()
  return { ok: true }
}
```

> Note: the test mock's `batch().set` ignores the merge arg — fine. Confirm `revalidatePath('/services/[slug]', 'page')` is the correct dynamic-route form by re-reading `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` before implementing; adjust the path argument if the doc differs.

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/app/admin/catalog/actions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/catalog/validation.ts src/lib/catalog/validation.test.ts src/app/admin/catalog/actions.ts src/app/admin/catalog/actions.test.ts
git commit -m "feat: catalog server actions (prices, service, image) with owner verify + revalidate"
```

---

## Task 8: FAQ server actions

**Files:**
- Create: `src/app/admin/faq/actions.ts`, `src/app/admin/faq/actions.test.ts`
- Modify: `src/lib/catalog/validation.ts` (add `faqInputSchema`)

**Interfaces:**
- Produces: `saveFaqAction(idToken, input: { id?: string; question; answer; category; active; sortOrder })`, `deleteFaqAction(idToken, id)`, `reorderFaqAction(idToken, orderedIds: string[])` — each `Promise<ActionResult>` (reuse the `ActionResult` type from Task 7; import it). All revalidate `/faq`.

- [ ] **Step 1: Add FAQ schema (failing test first)**

```ts
// append to src/lib/catalog/validation.test.ts
import { faqInputSchema } from './validation'
it('faqInputSchema requires question and answer', () => {
  expect(faqInputSchema.safeParse({ question: '', answer: 'a', category: 'general', active: true, sortOrder: 1 }).success).toBe(false)
  expect(faqInputSchema.safeParse({ question: 'q', answer: 'a', category: 'general', active: true, sortOrder: 1 }).success).toBe(true)
})
```

Run: `npm test -- src/lib/catalog/validation.test.ts` → FAIL.

Add to `src/lib/catalog/validation.ts`:

```ts
export const faqInputSchema = z.object({
  id: z.string().min(1).optional(),
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(4000),
  category: z.string().min(1).default('general'),
  active: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
})
export type FaqInput = z.infer<typeof faqInputSchema>
```

Run again → PASS.

- [ ] **Step 2: Write the failing actions test**

```ts
// src/app/admin/faq/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const revalidated: string[] = []
const sets: Record<string, unknown>[] = []
let lastDeletedId = ''

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error('FORBIDDEN'); return { uid: 'o1' } },
  getAdminDb: () => ({
    collection: () => ({
      doc: (id?: string) => ({ id: id ?? 'gen-id', set: async (d: Record<string, unknown>) => { sets.push(d) }, delete: async () => { lastDeletedId = id ?? '' } }),
    }),
    batch: () => ({ update: () => {}, commit: async () => {} }),
  }),
}))
beforeEach(() => { revalidated.length = 0; sets.length = 0; lastDeletedId = '' })

describe('faq actions', () => {
  it('saveFaqAction writes and revalidates /faq', async () => {
    const { saveFaqAction } = await import('./actions')
    const r = await saveFaqAction('owner', { question: 'q', answer: 'a', category: 'general', active: true, sortOrder: 1 })
    expect(r).toEqual({ ok: true })
    expect(sets.length).toBe(1)
    expect(revalidated).toContain('/faq')
  })
  it('rejects a non-owner', async () => {
    const { saveFaqAction } = await import('./actions')
    expect(await saveFaqAction('nope', { question: 'q', answer: 'a', category: 'general', active: true, sortOrder: 1 })).toEqual({ ok: false, error: 'FORBIDDEN' })
  })
  it('deleteFaqAction deletes by id', async () => {
    const { deleteFaqAction } = await import('./actions')
    expect(await deleteFaqAction('owner', 'faq-3')).toEqual({ ok: true })
    expect(lastDeletedId).toBe('faq-3')
  })
})
```

Run: `npm test -- src/app/admin/faq/actions.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement FAQ actions**

```ts
// src/app/admin/faq/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { faqInputSchema, type FaqInput } from '@/lib/catalog/validation'
import type { ActionResult } from '@/app/admin/catalog/actions'

function fail(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : 'INVALID'
  if (msg === 'UNAUTHENTICATED' || msg === 'FORBIDDEN') return { ok: false, error: msg }
  return { ok: false, error: 'INVALID', message: msg }
}

export async function saveFaqAction(idToken: string, input: FaqInput): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  const parsed = faqInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const { id, ...data } = parsed.data
  const ref = id ? db.collection('faqs').doc(id) : db.collection('faqs').doc()
  await ref.set({ ...data, category: data.category ?? 'general' })
  revalidatePath('/faq')
  return { ok: true }
}

export async function deleteFaqAction(idToken: string, id: string): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  if (!id) return { ok: false, error: 'INVALID' }
  await getAdminDb().collection('faqs').doc(id).delete()
  revalidatePath('/faq')
  return { ok: true }
}

export async function reorderFaqAction(idToken: string, orderedIds: string[]): Promise<ActionResult> {
  try { await verifyOwner(idToken) } catch (e) { return fail(e) }
  const db = getAdminDb()
  const batch = db.batch()
  orderedIds.forEach((id, i) => batch.update(db.collection('faqs').doc(id), { sortOrder: i + 1 }))
  await batch.commit()
  revalidatePath('/faq')
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/admin/faq/actions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/validation.ts src/lib/catalog/validation.test.ts src/app/admin/faq/actions.ts src/app/admin/faq/actions.test.ts
git commit -m "feat: FAQ server actions (save, delete, reorder)"
```

---

## Task 9: Wire public pages to live Firestore reads

**Files:**
- Modify: `src/app/(marketing)/services/page.tsx`, `src/app/(marketing)/services/[slug]/page.tsx`, `src/app/(marketing)/faq/page.tsx`
- Check: `src/components/catalog/PriceMatrix.tsx`, `src/components/catalog/ServiceDetail.tsx`, `src/components/ui/ServiceCard.tsx`, `src/components/ui/Faq.tsx` (prop shapes only)

**Interfaces:**
- Consumes: `getActiveServices`, `getServiceBySlug`, `getActiveModels`, `getPriceMatrix`, `getActiveFaqs` (Task 5); `priceFor`, `fromPrice` (Task 3, now matrix-first).

- [ ] **Step 1: Read the current pages and the framework reference**

Read the three pages plus `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` (route segment `revalidate`) to confirm the static + on-demand model. Note each component's existing props so the data shape passed in is unchanged.

- [ ] **Step 2: Update `/services` (list)**

Replace seed imports with queries; add a revalidate backstop. Example shape:

```tsx
// src/app/(marketing)/services/page.tsx
import { getActiveServices, getPriceMatrix } from '@/lib/catalog/queries'
import { fromPrice } from '@/lib/catalog/pricing'
// ...existing presentational imports (ServiceCard etc.)

export const revalidate = 3600 // time backstop; owner saves trigger revalidatePath immediately

export default async function ServicesPage() {
  const [services, matrix] = await Promise.all([getActiveServices(), getPriceMatrix()])
  return (
    /* render existing ServiceCard list; for each service pass fromPrice(matrix, service.id) */
  )
}
```

> Keep the existing JSX/markup; only swap the data source. Where the old code called `fromPrice(slug)`, call `fromPrice(matrix, slug)`.

- [ ] **Step 3: Update `/services/[slug]` (detail)**

```tsx
// src/app/(marketing)/services/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { getActiveServices, getServiceBySlug, getActiveModels, getPriceMatrix } from '@/lib/catalog/queries'

export const revalidate = 3600

export async function generateStaticParams() {
  const services = await getActiveServices()
  return services.map((s) => ({ slug: s.slug }))
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [service, models, matrix] = await Promise.all([getServiceBySlug(slug), getActiveModels(), getPriceMatrix()])
  if (!service) notFound()
  return (
    /* existing ServiceDetail markup, fed service + models + matrix (use priceFor(matrix, service.id, model.id, variant)) */
  )
}
```

> Confirm `params` is a Promise in this Next version (the existing `[slug]` page already shows the correct signature — match it exactly).

- [ ] **Step 4: Update `/faq`**

```tsx
// src/app/(marketing)/faq/page.tsx
import { getActiveFaqs } from '@/lib/catalog/queries'
// existing Faq accordion component import

export const revalidate = 3600

export default async function FaqPage() {
  const faqs = await getActiveFaqs()
  return (/* feed faqs (question/answer) into the existing Faq component */)
}
```

> The `Faq` component currently expects `{q, a}`. Either adapt the page to map `faqs.map(f => ({ q: f.question, a: f.answer }))`, or update the component prop names. Pick the smaller diff and keep it consistent.

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck`
Expected: clean (all old seed-signature callers now fixed).

Run: `npm run build`
Expected: build succeeds; `/services`, `/services/[slug]`, `/faq` prerender. (Build needs `FIREBASE_SERVICE_ACCOUNT` + emulator or live project reachable. If building offline, temporarily run against the emulator with `FIRESTORE_EMULATOR_HOST` set and the catalog seeded.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/(marketing)/services/page.tsx" "src/app/(marketing)/services/[slug]/page.tsx" "src/app/(marketing)/faq/page.tsx" src/components/catalog src/components/ui/Faq.tsx
git commit -m "feat: serve public catalog + FAQ from live Firestore reads"
```

---

## Task 10: Admin catalog UI (page + matrix editor + service cards + image upload)

**Files:**
- Create: `src/app/admin/catalog/page.tsx`, `src/app/admin/catalog/catalog.module.css`
- Create: `src/components/admin/PriceMatrixEditor.tsx` (+ `.module.css`), `src/components/admin/PriceMatrixEditor.test.tsx`
- Create: `src/components/admin/ServiceEditorCard.tsx` (+ `.module.css`)
- Create: `src/components/admin/ImageUploader.tsx`

**Interfaces:**
- Consumes: `savePricesAction`, `saveServiceAction`, `setServiceImageAction` (Task 7); client `auth`, `storage` from `@/lib/firebase/client`; `getActiveServices`/`getActiveModels`/`getPriceMatrix` may be re-read client-side OR the server page passes initial data as props (preferred: server page reads and passes initial data, client editor manages edits).
- Produces: `PriceMatrixEditor({ services, models, matrix }: { services: Service[]; models: PhoneModel[]; matrix: PriceDoc[] })` — dirty-tracked grid with a Save button that calls `savePricesAction(idToken, edits)`.

- [ ] **Step 1: Read the framework reference**

Read `node_modules/next/dist/docs/01-app/01-getting-started/...` server/client component guidance already established in Phase 0; confirm a Server Component page can read via Admin SDK and render a `'use client'` editor child, passing serializable props (plain objects — `PriceDoc`/`Service`/`PhoneModel` are plain).

- [ ] **Step 2: Write the failing matrix-editor test**

```tsx
// src/components/admin/PriceMatrixEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const saveSpy = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/app/admin/catalog/actions', () => ({ savePricesAction: (...a: unknown[]) => saveSpy(...a) }))
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: { getIdToken: async () => 'owner' } } }))

import { PriceMatrixEditor } from './PriceMatrixEditor'

const services = [{ id: 'battery', name: 'Battery', slug: 'battery', category: 'power', description: '', hasVariants: false, variants: [], active: true, sortOrder: 1, imageURL: null }]
const models = [{ id: 'iphone-13', name: 'iPhone 13', brand: 'Apple', active: true, sortOrder: 1 }]
const matrix = [{ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 80000, available: true }]

beforeEach(() => saveSpy.mockClear())

describe('PriceMatrixEditor', () => {
  it('renders the Pula value of a cell', () => {
    render(<PriceMatrixEditor services={services} models={models} matrix={matrix} />)
    expect((screen.getByLabelText('Battery price for iPhone 13') as HTMLInputElement).value).toBe('800')
  })
  it('marks dirty and saves only changed cells in thebe', async () => {
    render(<PriceMatrixEditor services={services} models={models} matrix={matrix} />)
    fireEvent.change(screen.getByLabelText('Battery price for iPhone 13'), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await screen.findByText(/saved/i)
    expect(saveSpy).toHaveBeenCalledWith('owner', [
      { serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 90000, available: true },
    ])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/components/admin/PriceMatrixEditor.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement the matrix editor**

```tsx
// src/components/admin/PriceMatrixEditor.tsx
'use client'
import { useState } from 'react'
import { auth } from '@/lib/firebase/client'
import { savePricesAction } from '@/app/admin/catalog/actions'
import { priceId } from '@/lib/catalog/ids'
import { toThebe, fromThebe } from '@/lib/money'
import type { Service, PhoneModel, PriceDoc } from '@/lib/types/catalog'
import styles from './PriceMatrixEditor.module.css'

type Col = { serviceId: string; label: string; variant: string | null }

function columns(services: Service[]): Col[] {
  const cols: Col[] = []
  for (const s of services) {
    if (s.hasVariants && s.variants.length) {
      for (const v of s.variants) cols.push({ serviceId: s.id, label: `${s.name} ${v}`, variant: v })
    } else {
      cols.push({ serviceId: s.id, label: s.name, variant: null })
    }
  }
  return cols
}

export function PriceMatrixEditor({ services, models, matrix }: { services: Service[]; models: PhoneModel[]; matrix: PriceDoc[] }) {
  const cols = columns(services)
  const initial: Record<string, { amount: number; available: boolean }> = {}
  for (const p of matrix) initial[priceId(p.serviceId, p.modelId, p.variant)] = { amount: p.amount, available: p.available }

  const [cells, setCells] = useState(initial)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  function update(id: string, patch: Partial<{ amount: number; available: boolean }>) {
    setCells((c) => ({ ...c, [id]: { ...c[id], ...patch } }))
    setDirty((d) => new Set(d).add(id))
    setStatus('idle')
  }

  async function save() {
    setStatus('saving')
    const edits = [...dirty].map((id) => {
      const [serviceId, modelId, v] = id.split('__')
      const variant = v === 'none' ? null : cols.find((c) => c.serviceId === serviceId && (c.variant ?? '').toLowerCase() === v)?.variant ?? null
      return { serviceId, modelId, variant, amount: cells[id].amount, available: cells[id].available }
    })
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) { setStatus('error'); return }
    const res = await savePricesAction(idToken, edits)
    if (res.ok) { setDirty(new Set()); setStatus('saved') } else { setStatus('error') }
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead><tr><th>Model</th>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id}>
              <th scope="row">{m.name}</th>
              {cols.map((c) => {
                const id = priceId(c.serviceId, m.id, c.variant)
                const cell = cells[id] ?? { amount: 0, available: false }
                return (
                  <td key={id} className={dirty.has(id) ? styles.dirty : undefined}>
                    <input
                      aria-label={`${c.label} price for ${m.name}`}
                      inputMode="numeric"
                      value={String(fromThebe(cell.amount))}
                      onChange={(e) => update(id, { amount: toThebe(Number(e.target.value) || 0) })}
                    />
                    <label className={styles.avail}>
                      <input type="checkbox" checked={cell.available} aria-label={`${c.label} available for ${m.name}`}
                        onChange={(e) => update(id, { available: e.target.checked })} />
                      <span>Available</span>
                    </label>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.bar}>
        <button type="button" onClick={save} disabled={!dirty.size || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {status === 'saved' && <span role="status">Saved</span>}
        {status === 'error' && <span role="alert">Could not save — check your connection and that you are signed in as an owner.</span>}
      </div>
    </div>
  )
}
```

> Confirm `fromThebe` exists in `src/lib/money.ts`; if the helper is named differently (e.g. `toPula`), use that name. Read `src/lib/money.ts` first.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/admin/PriceMatrixEditor.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Implement ImageUploader + ServiceEditorCard (no new test logic beyond render)**

`ImageUploader` (client): file input → `uploadBytes(ref(storage, 'service-images/{id}'), file)` → `getDownloadURL` → calls `setServiceImageAction(idToken, { id, imageURL })`. Show progress/preview. `ServiceEditorCard` (client): textarea for description + active checkbox → `saveServiceAction`, plus embeds `ImageUploader`. Use existing UI-kit Button. Keep them small and responsive.

```tsx
// src/components/admin/ImageUploader.tsx
'use client'
import { useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/client'
import { setServiceImageAction } from '@/app/admin/catalog/actions'

export function ImageUploader({ serviceId, current }: { serviceId: string; current: string | null }) {
  const [url, setUrl] = useState(current)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      setErr('Use a JPEG/PNG/WebP under 5 MB'); return
    }
    setBusy(true); setErr('')
    try {
      const snap = await uploadBytes(ref(storage, `service-images/${serviceId}`), file)
      const downloadURL = await getDownloadURL(snap.ref)
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('not signed in')
      const res = await setServiceImageAction(idToken, { id: serviceId, imageURL: downloadURL })
      if (!res.ok) throw new Error('save failed')
      setUrl(downloadURL)
    } catch { setErr('Upload failed') } finally { setBusy(false) }
  }
  return (
    <div>
      {url && <img src={url} alt="" style={{ maxWidth: '100%', borderRadius: 8 }} />}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={busy} aria-label="Upload service image" />
      {busy && <span role="status">Uploading…</span>}
      {err && <span role="alert">{err}</span>}
    </div>
  )
}
```

- [ ] **Step 7: Implement the catalog page (server component)**

```tsx
// src/app/admin/catalog/page.tsx
import { getActiveServices, getActiveModels, getPriceMatrix } from '@/lib/catalog/queries'
import { PriceMatrixEditor } from '@/components/admin/PriceMatrixEditor'
import { ServiceEditorCard } from '@/components/admin/ServiceEditorCard'
import styles from './catalog.module.css'

export default async function AdminCatalogPage() {
  const [services, models, matrix] = await Promise.all([
    getActiveServices(), getActiveModels(), getPriceMatrix(),
  ])
  return (
    <>
      <p className="overline">Admin</p>
      <h1>Catalog</h1>
      <section className={styles.services}>
        {services.map((s) => <ServiceEditorCard key={s.id} service={s} />)}
      </section>
      <h2>Pricing</h2>
      <PriceMatrixEditor services={services} models={models} matrix={matrix} />
    </>
  )
}
```

> `getActiveServices()` returns only active services. For admin editing of an inactive service you'd need all services; if owners must see inactive ones, add `getAllServices()` to `queries.ts` and use it here. For 1a (3 always-active services) `getActiveServices` is acceptable — note this limitation in the PR description.

- [ ] **Step 8: Responsive CSS (matrix → cards on mobile)**

In `PriceMatrixEditor.module.css`, give `.wrap { overflow-x: auto }` for desktop tables and a `@media (max-width: 768px)` block that restyles rows/cells into stacked cards (label each cell with its column header via CSS or a visually-hidden label). Ensure inputs/checkboxes are ≥44px touch targets. (Mirror the responsive pattern used by `AdminSidebar.module.css`.)

- [ ] **Step 9: Typecheck + run component tests**

Run: `npm run typecheck && npm test -- src/components/admin/`
Expected: clean + PASS.

- [ ] **Step 10: Commit**

```bash
git add src/app/admin/catalog src/components/admin/PriceMatrixEditor.tsx src/components/admin/PriceMatrixEditor.module.css src/components/admin/PriceMatrixEditor.test.tsx src/components/admin/ServiceEditorCard.tsx src/components/admin/ServiceEditorCard.module.css src/components/admin/ImageUploader.tsx
git commit -m "feat: admin catalog UI (pricing matrix editor, service cards, image upload)"
```

---

## Task 11: Admin FAQ UI

**Files:**
- Create: `src/app/admin/faq/page.tsx`, `src/app/admin/faq/faq.module.css`
- Create: `src/components/admin/FaqEditor.tsx` (+ `.module.css`), `src/components/admin/FaqEditor.test.tsx`

**Interfaces:**
- Consumes: `saveFaqAction`, `deleteFaqAction`, `reorderFaqAction` (Task 8); `getActiveFaqs` for initial data (or a new `getAllFaqs()` to include inactive — add it to `queries.ts` since owners must manage inactive items).
- Produces: `FaqEditor({ faqs }: { faqs: Faq[] })`.

- [ ] **Step 1: Add `getAllFaqs()` to queries**

```ts
// add to src/lib/catalog/queries.ts
export async function getAllFaqs(): Promise<Faq[]> {
  const snap = await getAdminDb().collection('faqs').get()
  return snap.docs.map((d) => toFaq(d.id, d.data())).sort((a, b) => a.sortOrder - b.sortOrder)
}
```

- [ ] **Step 2: Write the failing FaqEditor test**

```tsx
// src/components/admin/FaqEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const saveSpy = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/app/admin/faq/actions', () => ({
  saveFaqAction: (...a: unknown[]) => saveSpy(...a),
  deleteFaqAction: async () => ({ ok: true }),
  reorderFaqAction: async () => ({ ok: true }),
}))
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: { getIdToken: async () => 'owner' } } }))
import { FaqEditor } from './FaqEditor'

const faqs = [{ id: 'faq-1', question: 'Q1', answer: 'A1', category: 'general', active: true, sortOrder: 1 }]
beforeEach(() => saveSpy.mockClear())

describe('FaqEditor', () => {
  it('edits and saves an item', async () => {
    render(<FaqEditor faqs={faqs} />)
    fireEvent.change(screen.getByLabelText('Question for faq-1'), { target: { value: 'Q1 edited' } })
    fireEvent.click(screen.getByRole('button', { name: /save faq-1/i }))
    await screen.findByText(/saved/i)
    expect(saveSpy).toHaveBeenCalledWith('owner', expect.objectContaining({ id: 'faq-1', question: 'Q1 edited' }))
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/components/admin/FaqEditor.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement FaqEditor**

```tsx
// src/components/admin/FaqEditor.tsx
'use client'
import { useState } from 'react'
import { auth } from '@/lib/firebase/client'
import { saveFaqAction, deleteFaqAction } from '@/app/admin/faq/actions'
import type { Faq } from '@/lib/types/catalog'
import styles from './FaqEditor.module.css'

export function FaqEditor({ faqs: initial }: { faqs: Faq[] }) {
  const [faqs, setFaqs] = useState(initial)
  const [status, setStatus] = useState<Record<string, string>>({})

  function patch(id: string, p: Partial<Faq>) {
    setFaqs((list) => list.map((f) => (f.id === id ? { ...f, ...p } : f)))
  }
  async function save(f: Faq) {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) { setStatus((s) => ({ ...s, [f.id]: 'error' })); return }
    const res = await saveFaqAction(idToken, { id: f.id, question: f.question, answer: f.answer, category: f.category, active: f.active, sortOrder: f.sortOrder })
    setStatus((s) => ({ ...s, [f.id]: res.ok ? 'saved' : 'error' }))
  }
  async function remove(id: string) {
    const idToken = await auth.currentUser?.getIdToken(); if (!idToken) return
    const res = await deleteFaqAction(idToken, id)
    if (res.ok) setFaqs((list) => list.filter((f) => f.id !== id))
  }

  return (
    <div className={styles.list}>
      {faqs.map((f) => (
        <div key={f.id} className={styles.item}>
          <input aria-label={`Question for ${f.id}`} value={f.question} onChange={(e) => patch(f.id, { question: e.target.value })} />
          <textarea aria-label={`Answer for ${f.id}`} value={f.answer} onChange={(e) => patch(f.id, { answer: e.target.value })} />
          <label><input type="checkbox" checked={f.active} onChange={(e) => patch(f.id, { active: e.target.checked })} /> Active</label>
          <button type="button" onClick={() => save(f)} aria-label={`Save ${f.id}`}>Save</button>
          <button type="button" onClick={() => remove(f.id)} aria-label={`Delete ${f.id}`}>Delete</button>
          {status[f.id] === 'saved' && <span role="status">Saved</span>}
          {status[f.id] === 'error' && <span role="alert">Could not save</span>}
        </div>
      ))}
    </div>
  )
}
```

> "Add new" creates a local row with no `id` and `sortOrder = faqs.length + 1`; saving it (action generates the doc id) then refetch or reload. Reorder buttons call `reorderFaqAction` with the new id order. Implement these once the basic edit/save/delete pass; keep each interaction a 44px target and the layout responsive.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/admin/FaqEditor.test.tsx`
Expected: PASS.

- [ ] **Step 6: Implement the FAQ admin page**

```tsx
// src/app/admin/faq/page.tsx
import { getAllFaqs } from '@/lib/catalog/queries'
import { FaqEditor } from '@/components/admin/FaqEditor'

export default async function AdminFaqPage() {
  const faqs = await getAllFaqs()
  return (
    <>
      <p className="overline">Admin</p>
      <h1>FAQ</h1>
      <FaqEditor faqs={faqs} />
    </>
  )
}
```

- [ ] **Step 7: Full verification**

Run: `npm run typecheck && npm test && npm run test:rules`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/faq src/components/admin/FaqEditor.tsx src/components/admin/FaqEditor.module.css src/components/admin/FaqEditor.test.tsx src/lib/catalog/queries.ts
git commit -m "feat: admin FAQ editor UI"
```

---

## Final integration & manual verification

- [ ] **Step 1:** Seed the live project once: `FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" npm run seed:catalog`. Expect "created 99, skipped 0".
- [ ] **Step 2:** `npm run dev`; sign in as an owner; at `/admin/catalog` change a price, toggle availability, upload a service image, edit a description; confirm `/services` and `/services/[slug]` reflect changes on reload.
- [ ] **Step 3:** At `/admin/faq` edit/add/reorder/deactivate an item; confirm `/faq` reflects it.
- [ ] **Step 4:** On a phone width, confirm the matrix renders as cards and all controls are tappable (no regression of the mobile-nav lesson).
- [ ] **Step 5:** Re-run `npm run seed:catalog` and confirm "created 0" and that an edited price is preserved.
- [ ] **Step 6:** Push `main` (or open a PR) once all tasks are committed and green.

---

## Self-review notes (author)

- **Spec coverage:** §3 data model → Tasks 2/4/5; §4 architecture → Tasks 1/5/7/9; §5 migration → Task 4; §6 admin UI → Tasks 10/11; §7 public wiring → Task 9; §8 rules → Task 6; §9 testing → embedded per task; §10 config → Tasks 1/4 + final steps. All covered.
- **Deviation from spec wording:** spec §4 named `revalidateTag('catalog')`; this plan uses `revalidatePath` (stable, non-deprecated) to satisfy the same "revalidate on save" intent without enabling `cacheComponents`. Recorded here intentionally.
- **Type consistency:** `ActionResult` defined in Task 7 and imported by Task 8; `priceId`/`parsePriceId` (Task 2) used by Tasks 4/7/10; `PriceDoc`/`Service`/`Faq` shapes consistent across mappers, queries, actions, and UI.
- **Known limitations to surface in PRs:** `getActiveServices` excludes inactive services from the admin catalog page (acceptable for 1a's 3 always-active services); `getAllFaqs` added for admin so inactive FAQs are manageable. Adding brand-new services/models is deferred per spec scope.
- **Framework-API checkpoints** flagged inline (revalidatePath dynamic-route form; `params` Promise signature; money helper names) — verify against `node_modules/next/dist/docs/` and `src/lib/money.ts` at implementation time.
