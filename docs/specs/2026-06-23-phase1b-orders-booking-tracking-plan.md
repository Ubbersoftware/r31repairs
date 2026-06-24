# Phase 1b — Orders (booking, tracking, admin pipeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer book multi-device/multi-service repairs from the live catalog, watch a color-coded status timeline, while the shop moves each job through an owner-only status pipeline with an append-only audit log.

**Architecture:** Orders live in `r31_orders` (+ append-only `events` subcollection). All writes are server-authoritative server actions (Admin SDK), mirroring the Phase 1a catalog actions (`verifyOwner`/`ActionResult`/`revalidatePath`). Customers read their own orders client-side via the Firebase SDK gated by rules; admin reads server-side via the Admin SDK. Prices are recomputed server-side from the live matrix at booking — client prices are never trusted.

**Tech Stack:** Next.js 16 (App Router) · Firebase Admin SDK (server actions/reads) + Firebase client SDK (customer reads) · Firestore · Zod · Vitest + Testing Library · `@firebase/rules-unit-testing` (emulator).

**Branch:** `phase-1b-orders` (NOT `main` — `main` auto-deploys to Vercel; merge 1b only when complete).

**Spec:** `docs/specs/2026-06-23-phase1b-orders-booking-tracking-design.md`

## Global Constraints

- **Money in thebe (integer minor units)**; display/parse Pula via `src/lib/money.ts`. Never store floats. Prices recomputed server-side from the matrix at booking — never trusted from the client.
- **Collections are `r31_`-prefixed** (D9): `r31_orders`, `r31_orders/{id}/events`, `r31_counters`. Storage under `r31/` (not used in 1b).
- **Owner = Firebase Auth custom claim `role === 'owner'`**, verified server-side via `verifyOwner` (Admin SDK). New `verifyUser` verifies any authenticated caller and returns the decoded token; `customerId` is always the verified `uid`, never client-supplied.
- **AGENTS.md:** this Next.js differs from training data — read the relevant file under `node_modules/next/dist/docs/` before using framework APIs. Do **not** use `unstable_cache`/`cacheTag`/`'use cache'`/`cacheComponents`. Revalidate with `revalidatePath` from `next/cache`.
- **`ActionResult`** and the `fail()` helper are imported from `src/lib/catalog/actionResult.ts` (created in 1a). Action files are `'use server'` and export only async functions.
- **Pipeline ends at *Ready for Collection*.** No *Completed*/e-sign/payment/invoicing/warranty (Phase 2); no notifications/push (1c); no kanban board or `/admin` overview dashboard (fast-follow); no admin-created orders, no customer approve/decline, no customer-cancel (out of 1b).
- **`OrderStatus`** values (exact strings): `'placed' | 'received' | 'diagnosing' | 'awaiting_approval' | 'in_repair' | 'awaiting_parts' | 'ready' | 'cancelled'`.
- **Mobile-first**, responsive, 44px min touch targets, dual-theme (light/dark) — follow the 31-repairs-design system; status pills verified WCAG AA on both themes.

---

## File Structure

**Create:**
- `src/lib/types/order.ts` — `Order`, `OrderDevice`, `OrderItem`, `OrderEvent`, `OrderStatus`, `statusMeta`.
- `src/lib/orders/orderNumber.ts` — `nextOrderNumber(db)` (atomic counter) + `formatOrderNumber(seq)`.
- `src/lib/orders/validation.ts` (+ `.test.ts`) — Zod schemas: booking input, status-change, line-edit, note.
- `src/lib/orders/mappers.ts` (+ `.test.ts`) — Firestore doc ↔ `Order`/`OrderEvent`.
- `src/lib/orders/queries.ts` (+ `.test.ts`) — server (Admin SDK) reads: `getOrder`, `getOrdersForAdmin`, `getOrderEvents`.
- `src/app/(customer)/book/page.tsx` + `BookingBuilder.tsx` (+ `.module.css`, `.test.tsx`) — booking surface.
- `src/app/(customer)/account/page.tsx` (+ `.module.css`) — order list (client reads).
- `src/app/(customer)/orders/[id]/page.tsx` (+ `.module.css`) — order detail/timeline (client reads).
- `src/app/(customer)/orders/actions.ts` (+ `.test.ts`) — `createOrderAction`.
- `src/app/admin/orders/actions.ts` (+ `.test.ts`) — `changeOrderStatusAction`, `cancelOrderAction`, `editLineAction`, `addOrderNoteAction`.
- `src/app/admin/orders/page.tsx` + `OrderQueue.tsx` (+ `.module.css`, `.test.tsx`) — admin list.
- `src/app/admin/orders/[id]/page.tsx` + `OrderManager.tsx` (+ `.module.css`, `.test.tsx`) — admin manage.
- `src/components/orders/StatusPill.tsx` (+ `.module.css`, `.test.tsx`), `StatusTimeline.tsx` (+ `.module.css`).

**Modify:**
- `src/lib/firebase/admin.ts` — add `verifyUser(idToken)`.
- `src/app/globals.css` (or the tokens file) — add `--status-blue`, `--status-purple`.
- `firestore.rules` (+ `tests/rules/firestore.rules.test.ts`) — `r31_orders` (+ `events`) rules.
- Customer + marketing nav — link to `/book` and `/account` (wire where the existing nav lives).

---

## Task 1: Order types, status enum, status meta + tokens

**Files:**
- Create: `src/lib/types/order.ts`, `src/lib/types/order.test.ts`
- Modify: `src/app/globals.css` (add two CSS custom properties)

**Interfaces:**
- Produces: `OrderStatus` (union of the 8 exact strings), `Order`, `OrderDevice`, `OrderItem`, `OrderEvent`, and `statusMeta: Record<OrderStatus, { label: string; token: string; hold: boolean }>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/types/order.test.ts
import { describe, it, expect } from 'vitest'
import { statusMeta, ORDER_STATUSES } from './order'

describe('statusMeta', () => {
  it('covers every status with a label + token', () => {
    for (const s of ORDER_STATUSES) {
      expect(statusMeta[s].label.length).toBeGreaterThan(0)
      expect(statusMeta[s].token).toMatch(/^--/)
    }
  })
  it('marks the two holds', () => {
    expect(statusMeta.awaiting_approval.hold).toBe(true)
    expect(statusMeta.awaiting_parts.hold).toBe(true)
    expect(statusMeta.in_repair.hold).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/types/order.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the types + meta**

```ts
// src/lib/types/order.ts
export const ORDER_STATUSES = [
  'placed', 'received', 'diagnosing', 'awaiting_approval',
  'in_repair', 'awaiting_parts', 'ready', 'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const statusMeta: Record<OrderStatus, { label: string; token: string; hold: boolean }> = {
  placed:            { label: 'Order Placed',          token: '--muted',         hold: false },
  received:          { label: 'Device Received',       token: '--status-blue',   hold: false },
  diagnosing:        { label: 'Diagnosing',            token: '--warning',       hold: false },
  awaiting_approval: { label: 'Awaiting Approval',     token: '--warning',       hold: true  },
  in_repair:         { label: 'In Repair',             token: '--accent',        hold: false },
  awaiting_parts:    { label: 'Awaiting Parts',        token: '--status-purple', hold: true  },
  ready:             { label: 'Ready for Collection',  token: '--success',       hold: false },
  cancelled:         { label: 'Cancelled',             token: '--danger',        hold: false },
}

export interface OrderDevice { deviceId: string; phoneModelId: string; modelName: string; label?: string; notes?: string }
export interface OrderItem {
  itemId: string; deviceId: string; serviceId: string; serviceName: string
  variant: string | null; quotedAmount: number; finalAmount?: number
  lineStatus: OrderStatus; completedAt?: number | null
}
export interface Order {
  id: string; orderNumber: string; customerId: string; customerName: string; customerPhone: string
  status: OrderStatus; paymentStatus: 'unpaid'; devices: OrderDevice[]; items: OrderItem[]
  estimatedTotal: number; finalTotal?: number; createdAt: number; updatedAt: number
}
export type OrderEventType = 'created' | 'status_change' | 'line_edit' | 'note'
export interface OrderEvent {
  id: string; type: OrderEventType; fromStatus?: OrderStatus; toStatus?: OrderStatus
  note?: string; visibility: 'customer' | 'internal'; byUserId: string; byRole: string; at: number
}
```

- [ ] **Step 4: Add the two status-only CSS tokens (and confirm the reused token names)**

First confirm the existing token names referenced by `statusMeta` actually exist in the project's `globals.css`/tokens — `--accent`, `--success`, `--warning`, `--danger`, `--muted`. If any differ (e.g. the design system names the neutral `--text-muted` rather than `--muted`), update the `token` values in `statusMeta` to the real names so `var(--token)` resolves. Then, inside the `:root` block (and the light-theme override block if hues need adjusting for contrast), add the two new ones:

```css
  --status-blue: #2A8AF0;
  --status-purple: #7E57C2;
```

- [ ] **Step 5: Run test + typecheck**

Run: `npm test -- src/lib/types/order.test.ts && npm run typecheck`
Expected: PASS, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/order.ts src/lib/types/order.test.ts src/app/globals.css
git commit -m "feat: order types, status enum + status meta/color tokens"
```

---

## Task 2: Order-number minting (atomic counter)

**Files:**
- Create: `src/lib/orders/orderNumber.ts`, `src/lib/orders/orderNumber.test.ts`

**Interfaces:**
- Consumes: `getAdminDb` (1a, `@/lib/firebase/admin`).
- Produces: `formatOrderNumber(seq: number): string` (`R31-0001`), `nextOrderNumber(db: Firestore): Promise<string>` (transactional increment of `r31_counters/orders.seq`).

- [ ] **Step 1: Write the failing unit test (pure formatter)**

```ts
// src/lib/orders/orderNumber.test.ts
import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { formatOrderNumber } from './orderNumber'

describe('formatOrderNumber', () => {
  it('zero-pads to 4 digits with the R31- prefix', () => {
    expect(formatOrderNumber(1)).toBe('R31-0001')
    expect(formatOrderNumber(42)).toBe('R31-0042')
    expect(formatOrderNumber(12345)).toBe('R31-12345')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/orders/orderNumber.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/orders/orderNumber.ts
import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'

export function formatOrderNumber(seq: number): string {
  return `R31-${String(seq).padStart(4, '0')}`
}

export async function nextOrderNumber(db: Firestore): Promise<string> {
  const ref = db.collection('r31_counters').doc('orders')
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const next = ((snap.exists ? (snap.data()!.seq as number) : 0) ?? 0) + 1
    tx.set(ref, { seq: next }, { merge: true })
    return next
  })
  return formatOrderNumber(seq)
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npm test -- src/lib/orders/orderNumber.test.ts && npm run typecheck`
Expected: PASS, 0 type errors. (Transactional `nextOrderNumber` is covered end-to-end by the emulator test in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/orderNumber.ts src/lib/orders/orderNumber.test.ts
git commit -m "feat: deterministic order-number minting via atomic counter"
```

---

## Task 3: `verifyUser` helper + order validation schemas

**Files:**
- Modify: `src/lib/firebase/admin.ts`
- Create: `src/lib/orders/validation.ts`, `src/lib/orders/validation.test.ts`

**Interfaces:**
- Produces: `verifyUser(idToken: string): Promise<DecodedIdToken>` (throws `Error('UNAUTHENTICATED')` on a missing/invalid token; does NOT require owner). Zod: `bookingSchema` (→ `BookingInput`), `statusChangeSchema`, `lineEditSchema`, `noteSchema`.

- [ ] **Step 1: Write the failing validation test**

```ts
// src/lib/orders/validation.test.ts
import { describe, it, expect } from 'vitest'
import { bookingSchema, statusChangeSchema } from './validation'

describe('bookingSchema', () => {
  const ok = { devices: [{ deviceId: 'd1', phoneModelId: 'iphone-13', items: [{ itemId: 'i1', serviceId: 'screen', variant: 'OLED' }] }] }
  it('accepts a valid booking', () => { expect(bookingSchema.safeParse(ok).success).toBe(true) })
  it('rejects a booking with no devices', () => { expect(bookingSchema.safeParse({ devices: [] }).success).toBe(false) })
  it('rejects a device with no items', () => {
    expect(bookingSchema.safeParse({ devices: [{ deviceId: 'd1', phoneModelId: 'iphone-13', items: [] }] }).success).toBe(false)
  })
})

describe('statusChangeSchema', () => {
  it('accepts a known status, rejects an unknown one', () => {
    expect(statusChangeSchema.safeParse({ toStatus: 'in_repair', note: 'x' }).success).toBe(true)
    expect(statusChangeSchema.safeParse({ toStatus: 'teleported' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/orders/validation.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the schemas**

```ts
// src/lib/orders/validation.ts
import { z } from 'zod'
import { ORDER_STATUSES } from '@/lib/types/order'

export const bookingItemSchema = z.object({
  itemId: z.string().min(1),
  serviceId: z.string().min(1),
  variant: z.string().min(1).nullable().default(null),
})
export const bookingDeviceSchema = z.object({
  deviceId: z.string().min(1),
  phoneModelId: z.string().min(1),
  label: z.string().max(80).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(bookingItemSchema).min(1),
})
export const bookingSchema = z.object({ devices: z.array(bookingDeviceSchema).min(1) })
export type BookingInput = z.infer<typeof bookingSchema>

const statusEnum = z.enum(ORDER_STATUSES as unknown as [string, ...string[]])
export const statusChangeSchema = z.object({ toStatus: statusEnum, note: z.string().max(1000).optional() })
export const lineEditSchema = z.object({
  itemId: z.string().min(1),
  finalAmount: z.number().int().nonnegative(),
  note: z.string().max(1000).optional(),
})
export const noteSchema = z.object({ note: z.string().min(1).max(1000) })
```

- [ ] **Step 4: Run validation test to verify it passes**

Run: `npm test -- src/lib/orders/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `verifyUser` to `admin.ts`**

In `src/lib/firebase/admin.ts`, add below `verifyOwner`:

```ts
export async function verifyUser(idToken: string): Promise<DecodedIdToken> {
  if (!idToken) throw new Error('UNAUTHENTICATED')
  try {
    return await getAdminAuth().verifyIdToken(idToken)
  } catch {
    throw new Error('UNAUTHENTICATED')
  }
}
```

- [ ] **Step 6: Run the admin test + typecheck**

Run: `npm test -- src/lib/firebase/admin.test.ts && npm run typecheck`
Expected: PASS (existing admin tests unaffected), 0 type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase/admin.ts src/lib/orders/validation.ts src/lib/orders/validation.test.ts
git commit -m "feat: verifyUser helper + order validation schemas"
```

---

## Task 4: Order mappers + server query layer

**Files:**
- Create: `src/lib/orders/mappers.ts`, `src/lib/orders/mappers.test.ts`, `src/lib/orders/queries.ts`, `src/lib/orders/queries.test.ts`

**Interfaces:**
- Consumes: `getAdminDb` (1a); `Order`, `OrderEvent`, `OrderStatus` (Task 1).
- Produces (mappers): `toOrder(id, data): Order`, `toOrderEvent(id, data): OrderEvent`. Produces (queries, server-only): `getOrder(id): Promise<Order|null>`, `getOrdersForAdmin(opts?: { status?: OrderStatus }): Promise<Order[]>` (newest first), `getOrderEvents(orderId): Promise<OrderEvent[]>` (chronological).

- [ ] **Step 1: Write the failing mapper test**

```ts
// src/lib/orders/mappers.test.ts
import { describe, it, expect } from 'vitest'
import { toOrder, toOrderEvent } from './mappers'

describe('order mappers', () => {
  it('toOrder fills arrays + defaults', () => {
    const o = toOrder('o1', { orderNumber: 'R31-0001', customerId: 'u1', customerName: 'T', customerPhone: '7', status: 'placed', estimatedTotal: 2100, createdAt: 1, updatedAt: 1 })
    expect(o).toMatchObject({ id: 'o1', status: 'placed', paymentStatus: 'unpaid' })
    expect(o.devices).toEqual([]); expect(o.items).toEqual([])
  })
  it('toOrderEvent defaults visibility to internal', () => {
    expect(toOrderEvent('e1', { type: 'note', note: 'x', byUserId: 'o1', byRole: 'owner', at: 1 }).visibility).toBe('internal')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/orders/mappers.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the mappers**

```ts
// src/lib/orders/mappers.ts
import type { Order, OrderEvent } from '@/lib/types/order'
type D = Record<string, any>

export function toOrder(id: string, d: D): Order {
  return {
    id, orderNumber: d.orderNumber, customerId: d.customerId,
    customerName: d.customerName ?? '', customerPhone: d.customerPhone ?? '',
    status: d.status, paymentStatus: 'unpaid',
    devices: d.devices ?? [], items: d.items ?? [],
    estimatedTotal: d.estimatedTotal ?? 0, finalTotal: d.finalTotal,
    createdAt: d.createdAt ?? 0, updatedAt: d.updatedAt ?? 0,
  }
}
export function toOrderEvent(id: string, d: D): OrderEvent {
  return {
    id, type: d.type, fromStatus: d.fromStatus, toStatus: d.toStatus, note: d.note,
    visibility: d.visibility === 'customer' ? 'customer' : 'internal',
    byUserId: d.byUserId, byRole: d.byRole, at: d.at ?? 0,
  }
}
```

- [ ] **Step 4: Run mapper test to verify it passes**

Run: `npm test -- src/lib/orders/mappers.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing queries test (emulator)**

```ts
// src/lib/orders/queries.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let app: App, db: Firestore
beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'demo-r31' })
  app = initializeApp({ projectId: 'demo-r31' }, 'orders-q-test'); db = getFirestore(app)
})
afterAll(async () => { await deleteApp(app) })
beforeEach(async () => {
  const snap = await db.collection('r31_orders').get()
  await Promise.all(snap.docs.map((d) => d.ref.delete()))
  await db.collection('r31_orders').doc('o1').set({ orderNumber: 'R31-0001', customerId: 'u1', status: 'placed', createdAt: 100, updatedAt: 100 })
  await db.collection('r31_orders').doc('o2').set({ orderNumber: 'R31-0002', customerId: 'u2', status: 'in_repair', createdAt: 200, updatedAt: 200 })
}, 30000)

describe('order queries', () => {
  it('getOrdersForAdmin returns newest first', async () => {
    const { getOrdersForAdmin } = await import('./queries')
    expect((await getOrdersForAdmin()).map((o) => o.id)).toEqual(['o2', 'o1'])
  }, 20000)
  it('getOrdersForAdmin filters by status', async () => {
    const { getOrdersForAdmin } = await import('./queries')
    expect((await getOrdersForAdmin({ status: 'placed' })).map((o) => o.id)).toEqual(['o1'])
  }, 20000)
  it('getOrder returns one or null', async () => {
    const { getOrder } = await import('./queries')
    expect((await getOrder('o1'))?.orderNumber).toBe('R31-0001')
    expect(await getOrder('nope')).toBeNull()
  }, 20000)
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx firebase-tools emulators:exec --only firestore --project demo-r31 "npx vitest run src/lib/orders/queries.test.ts"`
Expected: FAIL — `./queries` missing.

- [ ] **Step 7: Implement the queries**

```ts
// src/lib/orders/queries.ts
import 'server-only'
import { getAdminDb } from '@/lib/firebase/admin'
import { toOrder, toOrderEvent } from './mappers'
import type { Order, OrderEvent, OrderStatus } from '@/lib/types/order'

export async function getOrder(id: string): Promise<Order | null> {
  const doc = await getAdminDb().collection('r31_orders').doc(id).get()
  return doc.exists ? toOrder(doc.id, doc.data() as Record<string, unknown>) : null
}
export async function getOrdersForAdmin(opts: { status?: OrderStatus } = {}): Promise<Order[]> {
  let q = getAdminDb().collection('r31_orders') as FirebaseFirestore.Query
  if (opts.status) q = q.where('status', '==', opts.status)
  const snap = await q.get()
  return snap.docs.map((d) => toOrder(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)
}
export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const snap = await getAdminDb().collection('r31_orders').doc(orderId).collection('events').get()
  return snap.docs.map((d) => toOrderEvent(d.id, d.data())).sort((a, b) => a.at - b.at)
}
```

> Sorting is done in JS (not Firestore `orderBy`) to avoid composite-index requirements, matching the 1a query layer.

- [ ] **Step 8: Run to verify it passes**

Run: `npx firebase-tools emulators:exec --only firestore --project demo-r31 "npx vitest run src/lib/orders/queries.test.ts"`
Expected: PASS (3 tests). Also run `npm run typecheck` → 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/orders/mappers.ts src/lib/orders/mappers.test.ts src/lib/orders/queries.ts src/lib/orders/queries.test.ts
git commit -m "feat: order mappers + Admin SDK order query layer"
```

---

## Task 5: `createOrderAction` (booking — server price recompute + mint + created event)

**Files:**
- Create: `src/app/(customer)/orders/actions.ts`, `src/app/(customer)/orders/actions.test.ts`

**Interfaces:**
- Consumes: `verifyUser` (Task 3), `getAdminDb` (1a), `nextOrderNumber` (Task 2), `bookingSchema`/`BookingInput` (Task 3), `getPriceMatrix`/`priceFor` (1a), `getActiveServices`/`getActiveModels` (1a), `ActionResult`/`fail` (1a `actionResult.ts`), `priceId` (1a).
- Produces: `createOrderAction(idToken: string, input: BookingInput): Promise<ActionResult & { orderId?: string }>`.

- [ ] **Step 1: Write the failing actions test**

```tsx
// src/app/(customer)/orders/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const writes: Record<string, unknown>[] = []
const revalidated: string[] = []
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyUser: async (t: string) => { if (t !== 'cust') throw new Error('UNAUTHENTICATED'); return { uid: 'u1', name: 'Thabo' } },
  getAdminDb: () => ({
    collection: () => ({ doc: (id?: string) => ({ id: id ?? 'o-gen', set: async (d: Record<string, unknown>) => { writes.push(d) }, collection: () => ({ doc: () => ({ set: async (d: Record<string, unknown>) => { writes.push(d) } }) }) }) }),
  }),
}))
vi.mock('@/lib/orders/orderNumber', () => ({ nextOrderNumber: async () => 'R31-0007' }))
vi.mock('@/lib/catalog/queries', () => ({
  getPriceMatrix: async () => [{ serviceId: 'screen', modelId: 'iphone-13', variant: 'OLED', amount: 150000, available: true }],
  getActiveServices: async () => [{ id: 'screen', name: 'Screen Replacement', slug: 'screen', hasVariants: true, variants: ['Basic', 'OLED'], active: true }],
  getActiveModels: async () => [{ id: 'iphone-13', name: 'iPhone 13', active: true }],
}))
beforeEach(() => { writes.length = 0; revalidated.length = 0 })

const input = { devices: [{ deviceId: 'd1', phoneModelId: 'iphone-13', items: [{ itemId: 'i1', serviceId: 'screen', variant: 'OLED' }] }] }

describe('createOrderAction', () => {
  it('rejects an unauthenticated caller', async () => {
    const { createOrderAction } = await import('./actions')
    expect(await createOrderAction('nope', input)).toMatchObject({ ok: false, error: 'UNAUTHENTICATED' })
  })
  it('recomputes price from the matrix (ignores any client price) and writes the order', async () => {
    const { createOrderAction } = await import('./actions')
    const r = await createOrderAction('cust', input as never)
    expect(r.ok).toBe(true)
    const order = writes.find((w) => (w as { orderNumber?: string }).orderNumber === 'R31-0007') as { items: { quotedAmount: number }[]; estimatedTotal: number; customerId: string }
    expect(order.items[0].quotedAmount).toBe(150000) // from matrix, in thebe
    expect(order.estimatedTotal).toBe(150000)
    expect(order.customerId).toBe('u1') // from verified token, not client
    expect(revalidated).toContain('/account')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- "src/app/(customer)/orders/actions.test.ts"`
Expected: FAIL — `./actions` missing.

- [ ] **Step 3: Implement `createOrderAction`**

```ts
// src/app/(customer)/orders/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyUser, getAdminDb } from '@/lib/firebase/admin'
import { nextOrderNumber } from '@/lib/orders/orderNumber'
import { bookingSchema, type BookingInput } from '@/lib/orders/validation'
import { getPriceMatrix, getActiveServices, getActiveModels } from '@/lib/catalog/queries'
import { priceFor } from '@/lib/catalog/pricing'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'

export async function createOrderAction(idToken: string, input: BookingInput): Promise<ActionResult & { orderId?: string }> {
  let user
  try { user = await verifyUser(idToken) } catch (e) { return fail(e) }
  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID', message: 'bad booking' }

  const [matrix, services, models] = await Promise.all([getPriceMatrix(), getActiveServices(), getActiveModels()])
  const svc = new Map(services.map((s) => [s.id, s]))
  const mdl = new Map(models.map((m) => [m.id, m]))

  const db = getAdminDb()
  const orderRef = db.collection('r31_orders').doc()
  const devices: Record<string, unknown>[] = []
  const items: Record<string, unknown>[] = []
  let estimatedTotal = 0
  for (const d of parsed.data.devices) {
    const model = mdl.get(d.phoneModelId)
    if (!model) return { ok: false, error: 'INVALID', message: `unknown model ${d.phoneModelId}` }
    devices.push({ deviceId: d.deviceId, phoneModelId: d.phoneModelId, modelName: model.name, label: d.label ?? null, notes: d.notes ?? null })
    for (const it of d.items) {
      const service = svc.get(it.serviceId)
      if (!service) return { ok: false, error: 'INVALID', message: `unknown service ${it.serviceId}` }
      const amount = priceFor(matrix, it.serviceId, d.phoneModelId, it.variant) // thebe, from live matrix
      if (amount == null) return { ok: false, error: 'INVALID', message: 'price unavailable' }
      estimatedTotal += amount
      items.push({ itemId: it.itemId, deviceId: d.deviceId, serviceId: it.serviceId, serviceName: service.name, variant: it.variant ?? null, quotedAmount: amount, lineStatus: 'placed' })
    }
  }

  const orderNumber = await nextOrderNumber(db)
  const now = Date.now()
  await orderRef.set({
    orderNumber, customerId: user.uid, customerName: (user as { name?: string }).name ?? '', customerPhone: (user as { phone_number?: string }).phone_number ?? '',
    status: 'placed', paymentStatus: 'unpaid', devices, items, estimatedTotal, createdAt: now, updatedAt: now,
  })
  await orderRef.collection('events').doc().set({ type: 'created', toStatus: 'placed', visibility: 'customer', byUserId: user.uid, byRole: 'customer', at: now })
  revalidatePath('/account')
  return { ok: true, orderId: orderRef.id }
}
```

> Confirm `priceFor`'s exact signature/return (null when unavailable) in `src/lib/catalog/pricing.ts` before wiring. Customer name/phone come from the verified token where available; the order also stores `customerId` so the admin read can backfill from `r31_users` if a field is blank (acceptable — booking still records a faithful snapshot).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- "src/app/(customer)/orders/actions.test.ts" && npm run typecheck`
Expected: PASS (2 tests, incl. the pricing-integrity assertion), 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(customer)/orders/actions.ts" "src/app/(customer)/orders/actions.test.ts"
git commit -m "feat: createOrderAction with server-side price recompute + order mint"
```

---

## Task 6: Owner status actions (`changeOrderStatusAction`, `cancelOrderAction`)

**Files:**
- Create: `src/app/admin/orders/actions.ts`, `src/app/admin/orders/actions.test.ts`

**Interfaces:**
- Consumes: `verifyOwner`/`getAdminDb` (1a), `statusChangeSchema` (Task 3), `ActionResult`/`fail` (1a).
- Produces: `changeOrderStatusAction(idToken, orderId, toStatus, note?): Promise<ActionResult>`, `cancelOrderAction(idToken, orderId, note?): Promise<ActionResult>`. Both atomically update `r31_orders/{id}.status` and append a `status_change` event.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/admin/orders/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const order = { status: 'placed' as string }
const events: Record<string, unknown>[] = []
const revalidated: string[] = []
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error(t === 'cust' ? 'FORBIDDEN' : 'UNAUTHENTICATED'); return { uid: 'o1' } },
  getAdminDb: () => ({
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async () => ({ exists: true, data: () => order }),
      update: (_ref: unknown, d: Record<string, unknown>) => { order.status = d.status as string },
      set: (_ref: unknown, d: Record<string, unknown>) => { events.push(d) },
    }),
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({}) }) }) }),
  }),
}))
beforeEach(() => { order.status = 'placed'; events.length = 0; revalidated.length = 0 })

describe('changeOrderStatusAction', () => {
  it('rejects a non-owner', async () => {
    const { changeOrderStatusAction } = await import('./actions')
    expect(await changeOrderStatusAction('cust', 'o1', 'received')).toEqual({ ok: false, error: 'FORBIDDEN' })
  })
  it('updates status + appends a status_change event', async () => {
    const { changeOrderStatusAction } = await import('./actions')
    const r = await changeOrderStatusAction('owner', 'o1', 'received', 'took it in')
    expect(r).toEqual({ ok: true })
    expect(order.status).toBe('received')
    expect(events[0]).toMatchObject({ type: 'status_change', fromStatus: 'placed', toStatus: 'received', byRole: 'owner', visibility: 'customer' })
    expect(revalidated).toContain('/admin/orders')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/app/admin/orders/actions.test.ts`
Expected: FAIL — `./actions` missing.

- [ ] **Step 3: Implement**

```ts
// src/app/admin/orders/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { statusChangeSchema } from '@/lib/orders/validation'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'
import type { OrderStatus } from '@/lib/types/order'

function revalidateOrder(orderId: string) {
  revalidatePath('/admin/orders'); revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`); revalidatePath('/account')
}

async function applyStatus(uid: string, orderId: string, toStatus: OrderStatus, note: string | undefined): Promise<ActionResult> {
  const db = getAdminDb()
  const ref = db.collection('r31_orders').doc(orderId)
  const eventRef = ref.collection('events').doc()
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new Error('INVALID')
    const from = (snap.data()!.status as OrderStatus)
    const now = Date.now()
    tx.update(ref, { status: toStatus, updatedAt: now })
    tx.set(eventRef, { type: 'status_change', fromStatus: from, toStatus, note: note ?? null, visibility: 'customer', byUserId: uid, byRole: 'owner', at: now })
  })
  revalidateOrder(orderId)
  return { ok: true }
}

export async function changeOrderStatusAction(idToken: string, orderId: string, toStatus: string, note?: string): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = statusChangeSchema.safeParse({ toStatus, note })
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  try { return await applyStatus(uid, orderId, parsed.data.toStatus as OrderStatus, parsed.data.note) } catch (e) { return fail(e) }
}

export async function cancelOrderAction(idToken: string, orderId: string, note?: string): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  try { return await applyStatus(uid, orderId, 'cancelled', note) } catch (e) { return fail(e) }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/app/admin/orders/actions.test.ts && npm run typecheck`
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/orders/actions.ts src/app/admin/orders/actions.test.ts
git commit -m "feat: owner status-change + cancel actions (atomic status + event log)"
```

---

## Task 7: Owner line-edit + note actions

**Files:**
- Modify: `src/app/admin/orders/actions.ts`, `src/app/admin/orders/actions.test.ts`

**Interfaces:**
- Consumes: `verifyOwner`/`getAdminDb` (1a), `lineEditSchema`/`noteSchema` (Task 3), `ActionResult`/`fail`.
- Produces: `editLineAction(idToken, orderId, edit): Promise<ActionResult>` (sets one item's `finalAmount`, recomputes `finalTotal`, appends a customer-visible `line_edit` event), `addOrderNoteAction(idToken, orderId, note, visibility): Promise<ActionResult>`.

- [ ] **Step 1: Add failing tests** (append to `actions.test.ts`)

```ts
describe('editLineAction', () => {
  it('rejects a non-owner', async () => {
    const { editLineAction } = await import('./actions')
    expect(await editLineAction('cust', 'o1', { itemId: 'i1', finalAmount: 90000 })).toEqual({ ok: false, error: 'FORBIDDEN' })
  })
})
describe('addOrderNoteAction', () => {
  it('appends an internal note when visibility=internal', async () => {
    const { addOrderNoteAction } = await import('./actions')
    expect(await addOrderNoteAction('owner', 'o1', 'check camera', 'internal')).toEqual({ ok: true })
  })
})
```

> These reuse the Task 6 mocks. To exercise the happy path of `editLineAction`, extend the `runTransaction` mock's `get()` to return an `items` array (e.g. `{ items: [{ itemId: 'i1', quotedAmount: 80000 }], status: 'diagnosing' }`) so the recompute path runs; assert the recomputed `finalTotal` and the `line_edit` event. Keep the existing status tests intact.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npm test -- src/app/admin/orders/actions.test.ts`
Expected: FAIL — `editLineAction`/`addOrderNoteAction` not exported.

- [ ] **Step 3: Implement (append to `actions.ts`)**

```ts
import { lineEditSchema, noteSchema } from '@/lib/orders/validation'

export async function editLineAction(idToken: string, orderId: string, edit: { itemId: string; finalAmount: number; note?: string }): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = lineEditSchema.safeParse(edit)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const ref = db.collection('r31_orders').doc(orderId)
  const eventRef = ref.collection('events').doc()
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const items = (snap.data()!.items as { itemId: string; quotedAmount: number; finalAmount?: number }[]) ?? []
      const next = items.map((it) => it.itemId === parsed.data.itemId ? { ...it, finalAmount: parsed.data.finalAmount } : it)
      const finalTotal = next.reduce((sum, it) => sum + (it.finalAmount ?? it.quotedAmount), 0)
      const now = Date.now()
      tx.update(ref, { items: next, finalTotal, updatedAt: now })
      tx.set(eventRef, { type: 'line_edit', note: parsed.data.note ?? `Price updated for ${parsed.data.itemId}`, visibility: 'customer', byUserId: uid, byRole: 'owner', at: now })
    })
  } catch (e) { return fail(e) }
  revalidateOrder(orderId)
  return { ok: true }
}

export async function addOrderNoteAction(idToken: string, orderId: string, note: string, visibility: 'customer' | 'internal'): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = noteSchema.safeParse({ note })
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const ref = getAdminDb().collection('r31_orders').doc(orderId)
  await ref.collection('events').doc().set({ type: 'note', note: parsed.data.note, visibility: visibility === 'customer' ? 'customer' : 'internal', byUserId: uid, byRole: 'owner', at: Date.now() })
  revalidateOrder(orderId)
  return { ok: true }
}
```

- [ ] **Step 4: Run to verify pass + typecheck**

Run: `npm test -- src/app/admin/orders/actions.test.ts && npm run typecheck`
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/orders/actions.ts src/app/admin/orders/actions.test.ts
git commit -m "feat: owner line-edit + note actions with finalTotal recompute"
```

---

## Task 8: Firestore security rules for orders + events

**Files:**
- Modify: `firestore.rules`, `tests/rules/firestore.rules.test.ts`

**Interfaces:**
- Produces: deployed rules where a customer reads only their own `r31_orders`; owners read all; client writes are denied (writes are Admin-SDK actions); `events` internal-visibility docs are owner-only, customer-visible docs readable by the order's owner; events never client-writable/deletable.

- [ ] **Step 1: Read the existing rules + test harness**

Read `firestore.rules` (reuse the existing `isOwner()` helper) and `tests/rules/firestore.rules.test.ts` (harness uses `@firebase/rules-unit-testing`, project `demo-r31`).

- [ ] **Step 2: Add failing rules tests**

```ts
// add to tests/rules/firestore.rules.test.ts
it('orders: customer reads only their own; owner reads all; client cannot write', async () => {
  const ctx = testEnv // existing helper var; match the file's naming
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    await admin.firestore().collection('r31_orders').doc('o1').set({ customerId: 'c1', status: 'placed' })
    await admin.firestore().collection('r31_orders').doc('o1').collection('events').doc('e1').set({ visibility: 'customer', type: 'created' })
    await admin.firestore().collection('r31_orders').doc('o1').collection('events').doc('e2').set({ visibility: 'internal', type: 'note' })
  })
  const c1 = testEnv.authenticatedContext('c1', { role: 'customer' }).firestore()
  const c2 = testEnv.authenticatedContext('c2', { role: 'customer' }).firestore()
  const owner = testEnv.authenticatedContext('o1', { role: 'owner' }).firestore()
  await assertSucceeds(c1.collection('r31_orders').doc('o1').get())
  await assertFails(c2.collection('r31_orders').doc('o1').get())
  await assertSucceeds(owner.collection('r31_orders').doc('o1').get())
  await assertFails(c1.collection('r31_orders').doc('o1').set({ status: 'ready' })) // client write denied
  await assertSucceeds(c1.collection('r31_orders').doc('o1').collection('events').doc('e1').get()) // customer-visible
  await assertFails(c1.collection('r31_orders').doc('o1').collection('events').doc('e2').get()) // internal owner-only
})
```

> Match the existing test file's variable names (`testEnv`, the `assertSucceeds`/`assertFails` imports). If the file initializes `testEnv` once in a `beforeAll`, reuse it.

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — default-deny on `r31_orders`.

- [ ] **Step 4: Add the rules**

In `firestore.rules`, inside `match /databases/{database}/documents`, add (reusing `isOwner()`):

```
match /r31_orders/{orderId} {
  allow read: if isOwner() || (request.auth != null && request.auth.uid == resource.data.customerId);
  allow write: if false; // all writes via Admin SDK server actions
  match /events/{eventId} {
    allow read: if isOwner()
      || (resource.data.visibility == 'customer'
          && request.auth != null
          && get(/databases/$(database)/documents/r31_orders/$(orderId)).data.customerId == request.auth.uid);
    allow write: if false;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:rules`
Expected: PASS (existing rules tests + the new order cases).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/firestore.rules.test.ts
git commit -m "feat: security rules for orders + events (own-read, owner-all, internal owner-only)"
```

---

## Task 9: `StatusPill` + `StatusTimeline` components

**Files:**
- Create: `src/components/orders/StatusPill.tsx` (+ `.module.css`, `.test.tsx`), `src/components/orders/StatusTimeline.tsx` (+ `.module.css`)

**Interfaces:**
- Consumes: `statusMeta`, `OrderStatus`, `OrderEvent` (Task 1).
- Produces: `<StatusPill status={OrderStatus} />`, `<StatusTimeline events={OrderEvent[]} />` (renders customer-visible events chronologically with labels + timestamps).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/orders/StatusPill.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPill } from './StatusPill'

describe('StatusPill', () => {
  it('renders the human label for a status', () => {
    render(<StatusPill status="ready" />)
    expect(screen.getByText('Ready for Collection')).toBeInTheDocument()
  })
  it('marks hold statuses as paused for assistive tech', () => {
    render(<StatusPill status="awaiting_parts" />)
    expect(screen.getByText('Awaiting Parts').closest('[data-hold="true"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/components/orders/StatusPill.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `StatusPill`**

```tsx
// src/components/orders/StatusPill.tsx
import type { OrderStatus } from '@/lib/types/order'
import { statusMeta } from '@/lib/types/order'
import styles from './StatusPill.module.css'

export function StatusPill({ status }: { status: OrderStatus }) {
  const meta = statusMeta[status]
  return (
    <span
      className={`${styles.pill} ${meta.hold ? styles.hold : ''}`}
      data-hold={meta.hold}
      style={{ '--pill': `var(${meta.token})` } as React.CSSProperties}
    >
      {meta.hold && <span aria-hidden="true" className={styles.pause}>⏸</span>}
      {meta.label}
    </span>
  )
}
```

```css
/* src/components/orders/StatusPill.module.css */
.pill { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 4px 12px;
  border-radius: 999px; font-size: 13px; font-weight: 600; line-height: 1;
  color: var(--pill); background: color-mix(in srgb, var(--pill) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--pill) 40%, transparent); }
.hold { border-style: dashed; }
.pause { font-size: 10px; }
```

> Verify `color-mix` is acceptable for the project's browser targets; if not, fall back to predefined `*-soft` background tokens per status. Check both light/dark themes render legibly (WCAG AA).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/components/orders/StatusPill.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement `StatusTimeline`** (no new test logic beyond render — verified via the order-detail page in Task 11)

```tsx
// src/components/orders/StatusTimeline.tsx
import type { OrderEvent } from '@/lib/types/order'
import { statusMeta } from '@/lib/types/order'
import styles from './StatusTimeline.module.css'

export function StatusTimeline({ events }: { events: OrderEvent[] }) {
  const visible = events.filter((e) => e.visibility === 'customer')
  if (!visible.length) return null
  return (
    <ol className={styles.timeline}>
      {visible.map((e) => (
        <li key={e.id} className={styles.entry}>
          <span className={styles.dot} aria-hidden="true" />
          <div>
            <p className={styles.label}>{e.toStatus ? statusMeta[e.toStatus].label : 'Update'}</p>
            {e.note && <p className={styles.note}>{e.note}</p>}
            <time className={styles.time}>{new Date(e.at).toLocaleString()}</time>
          </div>
        </li>
      ))}
    </ol>
  )
}
```

Add a `StatusTimeline.module.css` with a vertical connected-dots layout (dots joined by a left border line; ≥44px tappable rows where interactive). Use design-system tokens; no hardcoded colors.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/orders/
git commit -m "feat: StatusPill + StatusTimeline components"
```

---

## Task 10: Booking surface (`/book` + `BookingBuilder`)

**Files:**
- Create: `src/app/(customer)/book/page.tsx`, `src/app/(customer)/book/BookingBuilder.tsx` (+ `.module.css`, `.test.tsx`)

**Interfaces:**
- Consumes: `getActiveServices`/`getActiveModels`/`getPriceMatrix` + `priceFor`/`fromPrice` (1a), `createOrderAction` (Task 5), client `auth` (`@/lib/firebase/client`), `money` helpers.
- Produces: `<BookingBuilder services models matrix />` — a `'use client'` builder; the server `page.tsx` reads the catalog and passes serializable props.

- [ ] **Step 1: Write the failing component test**

```tsx
// src/app/(customer)/book/BookingBuilder.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const createSpy = vi.fn(async () => ({ ok: true as const, orderId: 'o1' }))
vi.mock('@/app/(customer)/orders/actions', () => ({ createOrderAction: (...a: Parameters<typeof createSpy>) => createSpy(...a) }))
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: { getIdToken: async () => 'cust' } } }))
const next = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: next, refresh: vi.fn() }) }))
import { BookingBuilder } from './BookingBuilder'

const services = [{ id: 'battery', name: 'Battery', slug: 'battery', hasVariants: false, variants: [], active: true, sortOrder: 1, imageURL: null, category: 'power', description: '' }]
const models = [{ id: 'iphone-13', name: 'iPhone 13', brand: 'Apple', active: true, sortOrder: 1 }]
const matrix = [{ serviceId: 'battery', modelId: 'iphone-13', variant: null, amount: 60000, available: true }]
beforeEach(() => createSpy.mockClear())

describe('BookingBuilder', () => {
  it('adds a device + service, shows the live total, and submits a booking', async () => {
    render(<BookingBuilder services={services} models={models} matrix={matrix} />)
    fireEvent.click(screen.getByRole('button', { name: /add device/i }))
    // select model + add the battery service (selectors match the component's labels/roles)
    fireEvent.click(screen.getByRole('button', { name: /add service/i }))
    expect(screen.getByText(/P600/)).toBeInTheDocument() // 60000 thebe → P600 live total
    fireEvent.click(screen.getByRole('button', { name: /review|submit|book/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm|submit/i }))
    await screen.findByText(/booked|success/i)
    expect(createSpy).toHaveBeenCalledWith('cust', expect.objectContaining({ devices: expect.any(Array) }))
  })
})
```

> Adjust the exact selectors to the labels/roles you implement; keep the assertions (live total in Pula, `createOrderAction` called with a `devices` array). The builder owns local state for devices/items; on submit it gets the idToken from `auth.currentUser` and calls `createOrderAction`, then routes to `/orders/[id]` (or `/account`) on success.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- "src/app/(customer)/book/BookingBuilder.test.tsx"`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `BookingBuilder` (client) + `page.tsx` (server)**

Build the single-page builder per the spec: device cards (model select + label/notes), per-device service rows (service select + variant select when `hasVariants`, showing the live per-line Pula price via `priceFor` + `fromPrice`), a sticky running estimated total, and a Review → Confirm submit that calls `createOrderAction(idToken, { devices: [...] })`. Generate stable local `deviceId`/`itemId` keys (a `useRef` counter, like the 1a `FaqEditor` temp-key pattern). On `{ ok: true, orderId }` route to `/orders/${orderId}`; on error show a `role="alert"` message. Honor 44px touch targets + dual-theme tokens.

```tsx
// src/app/(customer)/book/page.tsx
import { getActiveServices, getActiveModels, getPriceMatrix } from '@/lib/catalog/queries'
import { BookingBuilder } from './BookingBuilder'

export default async function BookPage() {
  const [services, models, matrix] = await Promise.all([getActiveServices(), getActiveModels(), getPriceMatrix()])
  return (
    <>
      <p className="overline">Book a repair</p>
      <h1>What needs fixing?</h1>
      <BookingBuilder services={services} models={models} matrix={matrix} />
    </>
  )
}
```

> Route group: place under the existing `(customer)` auth-gated group so the Phase 0 signed-in guard applies. Confirm the group/layout path before creating files.

- [ ] **Step 4: Run to verify it passes + typecheck**

Run: `npm test -- "src/app/(customer)/book/BookingBuilder.test.tsx" && npm run typecheck`
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(customer)/book"
git commit -m "feat: customer booking builder (/book) with live pricing"
```

---

## Task 11: Customer tracking (`/account` list + `/orders/[id]` detail)

**Files:**
- Create: `src/app/(customer)/account/page.tsx` (+ `.module.css`), `src/app/(customer)/orders/[id]/page.tsx` (+ `.module.css`)

**Interfaces:**
- Consumes: client `db`/`auth` (`@/lib/firebase/client`), `StatusPill`/`StatusTimeline` (Task 9), `Order`/`OrderEvent` (Task 1), `money` helpers.
- Produces: `/account` (the customer's orders, newest first) and `/orders/[id]` (status timeline + line items). Both are `'use client'` and read via the Firebase client SDK gated by rules (Task 8).

- [ ] **Step 1: Read the framework + client-read reference**

Confirm the `(customer)` group layout/guard and how Phase 0 client components read Firestore (`@/lib/firebase/client` `db`, `query`, `where`, `onSnapshot`/`getDocs`). Read `node_modules/next/dist/docs/` if needed for client-component data patterns. These pages are `'use client'` (live updates via `onSnapshot` are a nice-to-have; `getDocs` on mount is acceptable for 1b).

- [ ] **Step 2: Implement `/account`** (client) — query `r31_orders` where `customerId == auth.currentUser.uid`, newest first; render rows: order #, date, device summary, `<StatusPill>`, estimated total (`fromPrice`/Pula). Empty state → "No repairs yet · Book a repair" linking `/book`. If signed out, the `(customer)` guard handles redirect.

- [ ] **Step 3: Implement `/orders/[id]`** (client) — load the order doc (guard: only the owner's own, enforced by rules) + its customer-visible `events`; render the big `<StatusPill>`, `<StatusTimeline events={events} />`, and line items grouped by device showing `quotedAmount` and, where present, `finalAmount` + the adjustment note. Reserve placeholder slots for pay/invoice/e-sign (Phase 2). Read-only.

- [ ] **Step 4: Manual + type verification**

Run: `npm run typecheck`
Expected: 0 errors. (UI verified against the emulator/live project during the Final Integration pass; client-read rule behavior is covered by Task 8's rules tests.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(customer)/account" "src/app/(customer)/orders"
git commit -m "feat: customer order list + order detail/timeline (client reads)"
```

---

## Task 12: Admin order queue (`/admin/orders`)

**Files:**
- Create: `src/app/admin/orders/page.tsx`, `src/app/admin/orders/OrderQueue.tsx` (+ `.module.css`, `.test.tsx`)

**Interfaces:**
- Consumes: `getOrdersForAdmin` (Task 4), `StatusPill` (Task 9), `OrderStatus`/`statusMeta` (Task 1).
- Produces: server `page.tsx` reads orders (optionally by `?status=`) and renders `<OrderQueue orders />` — a `'use client'` filter/search list.

- [ ] **Step 1: Write the failing component test**

```tsx
// src/app/admin/orders/OrderQueue.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderQueue } from './OrderQueue'
const orders = [
  { id: 'o1', orderNumber: 'R31-0001', customerName: 'Thabo', status: 'placed', items: [{ serviceName: 'Screen' }], devices: [{ modelName: 'iPhone 13' }], createdAt: 100, estimatedTotal: 150000 },
  { id: 'o2', orderNumber: 'R31-0002', customerName: 'Lesedi', status: 'in_repair', items: [{ serviceName: 'Battery' }], devices: [{ modelName: 'iPhone 12' }], createdAt: 200, estimatedTotal: 60000 },
] as never[]

describe('OrderQueue', () => {
  it('filters by status and searches by name/number', () => {
    render(<OrderQueue orders={orders} />)
    expect(screen.getByText('R31-0001')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /in repair/i }))
    expect(screen.queryByText('R31-0001')).toBeNull()
    expect(screen.getByText('R31-0002')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/app/admin/orders/OrderQueue.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `OrderQueue` (client) + `page.tsx` (server, owner-gated by the admin layout)**

`OrderQueue` holds filter (status chips from `statusMeta`) + search (order # / customer name) state and renders matching rows: order #, customer, device+service summary, `<StatusPill>`, age (days from `createdAt`), link to `/admin/orders/[id]`. Mobile = cards, desktop = denser rows (responsive CSS). The server `page.tsx` calls `getOrdersForAdmin()` and passes `orders`.

```tsx
// src/app/admin/orders/page.tsx
import { getOrdersForAdmin } from '@/lib/orders/queries'
import { OrderQueue } from './OrderQueue'

export default async function AdminOrdersPage() {
  const orders = await getOrdersForAdmin()
  return (<><p className="overline">Admin</p><h1>Orders</h1><OrderQueue orders={orders} /></>)
}
```

- [ ] **Step 4: Run to verify pass + typecheck**

Run: `npm test -- src/app/admin/orders/OrderQueue.test.tsx && npm run typecheck`
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/orders/page.tsx src/app/admin/orders/OrderQueue.tsx src/app/admin/orders/OrderQueue.module.css src/app/admin/orders/OrderQueue.test.tsx
git commit -m "feat: admin order queue (filterable/searchable list)"
```

---

## Task 13: Admin order management (`/admin/orders/[id]`) + nav wiring

**Files:**
- Create: `src/app/admin/orders/[id]/page.tsx`, `src/app/admin/orders/[id]/OrderManager.tsx` (+ `.module.css`, `.test.tsx`)
- Modify: customer + marketing nav (link `/book`, `/account`); admin sidebar (link `/admin/orders`) — wire where the existing nav components live.

**Interfaces:**
- Consumes: `getOrder`/`getOrderEvents` (Task 4), all owner actions (Tasks 6–7), `StatusPill`/`StatusTimeline` (Task 9), client `auth`, `statusMeta`/`ORDER_STATUSES` (Task 1).
- Produces: server `page.tsx` (reads order + events) → `<OrderManager order events />` (`'use client'`): status control, line editing, notes, activity log.

- [ ] **Step 1: Write the failing component test**

```tsx
// src/app/admin/orders/[id]/OrderManager.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const statusSpy = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/app/admin/orders/actions', () => ({
  changeOrderStatusAction: (...a: Parameters<typeof statusSpy>) => statusSpy(...a),
  cancelOrderAction: vi.fn(async () => ({ ok: true })),
  editLineAction: vi.fn(async () => ({ ok: true })),
  addOrderNoteAction: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: { getIdToken: async () => 'owner' } } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { OrderManager } from './OrderManager'
const order = { id: 'o1', orderNumber: 'R31-0001', customerName: 'Thabo', customerPhone: '7', status: 'placed', devices: [{ deviceId: 'd1', modelName: 'iPhone 13' }], items: [{ itemId: 'i1', deviceId: 'd1', serviceName: 'Screen', quotedAmount: 150000 }], estimatedTotal: 150000 } as never
beforeEach(() => statusSpy.mockClear())

describe('OrderManager', () => {
  it('advances status via the primary action', async () => {
    render(<OrderManager order={order} events={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /device received/i }))
    await screen.findByText(/updated|saved/i)
    expect(statusSpy).toHaveBeenCalledWith('owner', 'o1', 'received', undefined)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- "src/app/admin/orders/[id]/OrderManager.test.tsx"`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `OrderManager` + `page.tsx`**

`OrderManager` renders: header (order #, customer name + phone, `<StatusPill>`); a **status control** — a primary button for the suggested next status (`placed→received→diagnosing→in_repair→ready`) plus a menu of all `ORDER_STATUSES` (+ Cancel) each calling `changeOrderStatusAction`/`cancelOrderAction` with an optional note; **line items** grouped by device with an inline price edit (`editLineAction`) and add/remove; an **internal note** field (`addOrderNoteAction`, visibility internal); and the full **activity log** (`<StatusTimeline>` shows customer-visible; an admin list shows all events incl. internal). Get the idToken from `auth.currentUser`; on success `router.refresh()`. The server `page.tsx`:

```tsx
// src/app/admin/orders/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getOrder, getOrderEvents } from '@/lib/orders/queries'
import { OrderManager } from './OrderManager'

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [order, events] = await Promise.all([getOrder(id), getOrderEvents(id)])
  if (!order) notFound()
  return <OrderManager order={order} events={events} />
}
```

> Match the Promise-based `params` signature used elsewhere in this Next version (confirm against an existing `[slug]`/`[id]` page).

- [ ] **Step 4: Wire navigation**

Add links so the surfaces are reachable: customer nav → `/book` and `/account`; admin sidebar → `/admin/orders`. Edit the existing nav components (find them under `src/components` / the route-group layouts). Keep styling consistent.

- [ ] **Step 5: Run pass + full verification**

Run: `npm test -- "src/app/admin/orders/[id]/OrderManager.test.tsx" && npm run typecheck && npx vitest run --exclude '**/queries.test.ts' --exclude '**/seedCatalog.test.ts' --exclude '**/orders/queries.test.ts'`
Expected: target test PASS; typecheck 0 errors; full non-emulator suite green.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/orders/[id]" # + the nav files you modified
git commit -m "feat: admin order management (status/line/notes) + nav wiring"
```

---

## Final Integration & Verification (run against the emulator / live project)

- [ ] **Emulator suites:** `npm run test:rules` (orders + events rules) and `npx firebase-tools emulators:exec --only firestore --project demo-r31 "npx vitest run src/lib/orders/queries.test.ts"` — all green.
- [ ] **Full local build:** `FIREBASE_SERVICE_ACCOUNT="$(cat <key.json>)" npm run build` — succeeds; new routes compile.
- [ ] **Manual E2E (dev against live or emulator):** register/sign in as a customer → `/book` a multi-device order → confirm it appears at `/account` as *Order Placed* and an order doc exists. Sign in as owner (`admin@email.com`) → `/admin/orders` shows it → advance through Device Received → Diagnosing (adjust a line price) → In Repair → Ready for Collection → confirm the customer `/orders/[id]` timeline + revised price update, and a customer can't see internal notes. Cancel a test order. Check mobile widths (booking builder + queue).
- [ ] **Merge:** open a PR `phase-1b-orders → main` (or merge) once green; the Vercel deploy then ships 1b.

---

## Deferred to later (do NOT build here)
Phase 2: payment, invoicing, e-signature, *Completed*, warranty. Phase 1c: in-app notifications + FCM push (the `events` log is the hook). Fast-follow: desktop kanban board, `/admin` overview dashboard. Out of 1b: admin-created orders, customer approve/decline, customer-cancel, per-line status UI.
