# Phase 1c — In-app notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the shop changes an order's status or adjusts a line price, write an in-app notification to the order's customer, surfaced via a live bell + dropdown on the customer pages.

**Architecture:** A `r31_notifications` collection. Fan-out is written **inline, in the same transaction** as the 1b owner order actions (`changeOrderStatusAction`, `cancelOrderAction`, `editLineAction`) via a pure `buildNotification` helper — no Cloud Functions. The customer's bell reads its own notifications **client-side** via `onSnapshot` (gated by rules) and marks them read.

**Tech Stack:** Next.js 16 (App Router) · Firebase Admin SDK (server-action writes) + Firebase client SDK (`onSnapshot`/`updateDoc` reads) · Firestore · Vitest + Testing Library · `@firebase/rules-unit-testing`.

**Branch:** `phase-1c-notifications` (off `phase-1b-orders` @ `62c8e71`; 1b not yet merged to main). Merge order: 1b → main, then 1c → main.

**Spec:** `docs/specs/2026-06-24-phase1c-notifications-design.md`

## Global Constraints

- Collections are `r31_`-prefixed: `r31_notifications`.
- Notifications are written **only by Admin-SDK server actions** (rules deny client create/delete); a client may **update only the `read` field** on its **own** notifications.
- Notifications go to the **order's customer** (`userId === order.customerId`, read from the order doc in the transaction — never client-supplied). Customer-only; no owner notifications.
- Fire on **status changes** (`changeOrderStatusAction`, `cancelOrderAction`) and **price adjustments** (`editLineAction`). `addOrderNoteAction` does **NOT** notify.
- `type` is exactly `'status_change' | 'price_update'`. `link` is `/orders/{orderId}`. `createdAt` is epoch ms (`Date.now()`). `read` defaults `false`.
- Client read query is constrained to `where('userId','==',uid)`; **sort + limit client-side** (no composite index — matches the project's JS-sort convention).
- **OUT OF SCOPE (Phase 1c-ii):** FCM web push (service worker, VAPID, permission, Admin-SDK send, `fcmTokens`). No Cloud Functions.
- AGENTS.md: this Next.js differs from training data — read `node_modules/next/dist/docs/` before using framework APIs. Design-system tokens (no hardcoded colors), 44px touch targets, dual-theme. No `as any`/`@ts-ignore` (a `as Notification` cast on `doc.data()` is acceptable).

---

## File Structure

**Create:**
- `src/lib/types/notification.ts` — `Notification` interface + `NotificationType` union.
- `src/lib/notifications/buildNotification.ts` (+ `.test.ts`) — pure builders for the notification doc body.
- `src/components/notifications/NotificationBell.tsx` (+ `.module.css`, `.test.tsx`) — bell + unread badge + dropdown.

**Modify:**
- `src/app/admin/orders/actions.ts` (+ `.test.ts`) — write a notification in the status/cancel/line-edit transactions.
- `src/app/(customer)/layout.tsx` (or the customer header it renders) — mount `<NotificationBell/>`.
- `firestore.rules` (+ `tests/rules/firestore.rules.test.ts`) — `r31_notifications` rules.

---

## Task 1: Notification types + `buildNotification` helper

**Files:**
- Create: `src/lib/types/notification.ts`, `src/lib/notifications/buildNotification.ts`, `src/lib/notifications/buildNotification.test.ts`

**Interfaces:**
- Consumes: `statusMeta`, `OrderStatus` (`@/lib/types/order`, 1b).
- Produces: `Notification` interface, `NotificationType`; `buildStatusNotification(args)` and `buildPriceNotification(args)` → `Omit<Notification,'id'>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/notifications/buildNotification.test.ts
import { describe, it, expect } from 'vitest'
import { buildStatusNotification, buildPriceNotification } from './buildNotification'

describe('buildNotification', () => {
  it('builds a status_change notification from the order + new status', () => {
    const n = buildStatusNotification({ userId: 'u1', orderId: 'o1', orderNumber: 'R31-0042', toStatus: 'ready', now: 100 })
    expect(n).toEqual({
      userId: 'u1', type: 'status_change', title: 'R31-0042',
      body: 'Status: Ready for Collection', link: '/orders/o1', read: false, createdAt: 100,
    })
  })
  it('builds a price_update notification', () => {
    const n = buildPriceNotification({ userId: 'u1', orderId: 'o1', orderNumber: 'R31-0042', now: 200 })
    expect(n).toMatchObject({ type: 'price_update', body: 'Your quote was updated', link: '/orders/o1', read: false, createdAt: 200 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/notifications/buildNotification.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the types + builders**

```ts
// src/lib/types/notification.ts
export type NotificationType = 'status_change' | 'price_update'
export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  link: string
  read: boolean
  createdAt: number
}
```

```ts
// src/lib/notifications/buildNotification.ts
import type { Notification } from '@/lib/types/notification'
import { statusMeta, type OrderStatus } from '@/lib/types/order'

type Body = Omit<Notification, 'id'>

export function buildStatusNotification(args: {
  userId: string; orderId: string; orderNumber: string; toStatus: OrderStatus; now: number
}): Body {
  return {
    userId: args.userId, type: 'status_change', title: args.orderNumber,
    body: `Status: ${statusMeta[args.toStatus].label}`,
    link: `/orders/${args.orderId}`, read: false, createdAt: args.now,
  }
}

export function buildPriceNotification(args: {
  userId: string; orderId: string; orderNumber: string; now: number
}): Body {
  return {
    userId: args.userId, type: 'price_update', title: args.orderNumber,
    body: 'Your quote was updated',
    link: `/orders/${args.orderId}`, read: false, createdAt: args.now,
  }
}
```

- [ ] **Step 4: Run test to verify it passes + typecheck**

Run: `npm test -- src/lib/notifications/buildNotification.test.ts && npm run typecheck`
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/notification.ts src/lib/notifications/buildNotification.ts src/lib/notifications/buildNotification.test.ts
git commit -m "feat: notification types + buildNotification helpers"
```

---

## Task 2: Fan-out — write notifications in the owner order actions

**Files:**
- Modify: `src/app/admin/orders/actions.ts`, `src/app/admin/orders/actions.test.ts`

**Interfaces:**
- Consumes: `buildStatusNotification`/`buildPriceNotification` (Task 1); `getAdminDb`/`verifyOwner` (1b); the existing transaction in `applyStatus`/`editLineAction`.
- Produces: each owner action also writes a `r31_notifications` doc for the order's customer, in the same transaction.

> Context: in 1b, `applyStatus(uid, orderId, toStatus, note)` runs a transaction that reads the order (`snap`), updates `status`, and appends an `events` doc. The order doc carries `customerId` and `orderNumber`. `editLineAction` runs a similar transaction reading the order's `items`. Add a notification `tx.set` to each.

- [ ] **Step 1: Add the failing assertions** (extend `actions.test.ts`)

The 1b test mocks `getAdminDb().runTransaction` with a `tx` whose `set` pushes to an `events`/writes array and whose `get` returns the order. Extend the mocked order to include `customerId` + `orderNumber`, and capture notification writes. Add:

```ts
// in actions.test.ts — the runTransaction mock's get() should return e.g.
//   { status: 'placed', customerId: 'c1', orderNumber: 'R31-0042', items: [{ itemId:'i1', quotedAmount:80000 }] }
// and tx.set should record docs by collection. Then:

it('changeOrderStatusAction writes a status_change notification to the customer', async () => {
  const { changeOrderStatusAction } = await import('./actions')
  await changeOrderStatusAction('owner', 'o1', 'received', undefined)
  const notif = notifWrites[0] // capture writes to r31_notifications in the mock
  expect(notif).toMatchObject({ userId: 'c1', type: 'status_change', link: '/orders/o1', read: false })
})

it('editLineAction writes a price_update notification', async () => {
  const { editLineAction } = await import('./actions')
  await editLineAction('owner', 'o1', { itemId: 'i1', finalAmount: 90000 })
  expect(notifWrites.some((n) => n.type === 'price_update' && n.userId === 'c1')).toBe(true)
})
```

> To capture notification writes separately, give the `tx.set` mock access to the target ref's collection path, or push all `tx.set` payloads to one array and filter by a discriminator (the notification has `type`/`link`; events have `fromStatus`/`toStatus` or `type:'status_change'` — note BOTH events and notifications may carry `type`, so prefer distinguishing by `link` presence, which only notifications have). Keep the existing status/event assertions intact.

- [ ] **Step 2: Run to verify the new assertions fail**

Run: `npm test -- src/app/admin/orders/actions.test.ts`
Expected: FAIL — no notification is written yet.

- [ ] **Step 3: Wire the notification writes**

In `actions.ts`, import the builders and add a notification `tx.set` inside each transaction. In `applyStatus` (used by `changeOrderStatusAction` + `cancelOrderAction`):

```ts
import { buildStatusNotification, buildPriceNotification } from '@/lib/notifications/buildNotification'

// inside applyStatus's runTransaction, after reading `snap` and computing `from`:
const order = snap.data()!
const now = Date.now()
tx.update(ref, { status: toStatus, updatedAt: now })
tx.set(eventRef, { type: 'status_change', fromStatus: from, toStatus, note: note ?? null, visibility: 'customer', byUserId: uid, byRole: 'owner', at: now })
const notifRef = db.collection('r31_notifications').doc()
tx.set(notifRef, buildStatusNotification({
  userId: order.customerId as string, orderId, orderNumber: order.orderNumber as string, toStatus, now,
}))
```

In `editLineAction`'s transaction, after updating items + finalTotal + the `line_edit` event:

```ts
const order = snap.data()!
const notifRef = db.collection('r31_notifications').doc()
tx.set(notifRef, buildPriceNotification({
  userId: order.customerId as string, orderId, orderNumber: order.orderNumber as string, now,
}))
```

> Create the `notifRef` (`.doc()`) outside the transaction callback alongside `eventRef`, per the Admin SDK pattern (a pre-generated ref written via `tx.set` inside the callback). Do NOT add a notification to `addOrderNoteAction`.

- [ ] **Step 4: Run to verify pass + typecheck**

Run: `npm test -- src/app/admin/orders/actions.test.ts && npm run typecheck`
Expected: PASS (existing 1b assertions + the 2 new notification assertions), 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/orders/actions.ts src/app/admin/orders/actions.test.ts
git commit -m "feat: write customer notification on status change + price adjustment"
```

---

## Task 3: Security rules for `r31_notifications`

**Files:**
- Modify: `firestore.rules`, `tests/rules/firestore.rules.test.ts`

**Interfaces:**
- Produces: rules where a customer reads only their own notifications, can update only the `read` field on their own, and client create/delete are denied.

- [ ] **Step 1: Read the existing rules + test harness**

Read `firestore.rules` and `tests/rules/firestore.rules.test.ts` (harness uses `@firebase/rules-unit-testing`, project `demo-r31`; match the existing `testEnv` + `assertSucceeds`/`assertFails` style).

- [ ] **Step 2: Add failing rules tests**

```ts
// add to tests/rules/firestore.rules.test.ts
it('notifications: own read, read-flag-only update, no client create', async () => {
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    await admin.firestore().collection('r31_notifications').doc('n1').set({ userId: 'c1', type: 'status_change', title: 'R31-0001', body: 'Status: In Repair', link: '/orders/o1', read: false, createdAt: 1 })
  })
  const c1 = testEnv.authenticatedContext('c1', { role: 'customer' }).firestore()
  const c2 = testEnv.authenticatedContext('c2', { role: 'customer' }).firestore()
  await assertSucceeds(c1.collection('r31_notifications').doc('n1').get())
  await assertFails(c2.collection('r31_notifications').doc('n1').get())                 // not your notification
  await assertSucceeds(c1.collection('r31_notifications').doc('n1').update({ read: true })) // mark read OK
  await assertFails(c1.collection('r31_notifications').doc('n1').update({ title: 'hacked' })) // only read may change
  await assertFails(c1.collection('r31_notifications').doc('n2').set({ userId: 'c1', read: false })) // client create denied
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — default-deny on `r31_notifications`.

- [ ] **Step 4: Add the rules**

In `firestore.rules`, inside `match /databases/{database}/documents`:

```
match /r31_notifications/{notifId} {
  allow read: if request.auth != null && request.auth.uid == resource.data.userId;
  allow update: if request.auth != null
    && request.auth.uid == resource.data.userId
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
  allow create, delete: if false;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:rules`
Expected: PASS (existing rules tests + the new notification cases).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/firestore.rules.test.ts
git commit -m "feat: security rules for r31_notifications (own-read, read-flag-only update)"
```

---

## Task 4: `NotificationBell` component + mount in the customer layout

**Files:**
- Create: `src/components/notifications/NotificationBell.tsx` (+ `.module.css`, `.test.tsx`)
- Modify: `src/app/(customer)/layout.tsx` (mount the bell in the header)

**Interfaces:**
- Consumes: client `db`/`auth` (`@/lib/firebase/client`), `firebase/firestore` (`collection`, `query`, `where`, `onSnapshot`, `doc`, `updateDoc`), `Notification` (`@/lib/types/notification`), `useAuth` (Phase 0), `next/navigation` `useRouter`.
- Produces: `<NotificationBell/>` — live unread badge + dropdown feed; mounted in the `(customer)` header.

- [ ] **Step 1: Write the failing component test**

```tsx
// src/components/notifications/NotificationBell.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const updateSpy = vi.fn(async () => {})
const push = vi.fn()
let snapCb: (snap: unknown) => void = () => {}
vi.mock('firebase/firestore', () => ({
  collection: () => ({}), query: (...a: unknown[]) => a, where: () => ({}), doc: (_db: unknown, _c: string, id: string) => ({ id }),
  onSnapshot: (_q: unknown, cb: (s: unknown) => void) => { snapCb = cb; return () => {} },
  updateDoc: (...a: unknown[]) => updateSpy(...a),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {}, auth: { currentUser: { uid: 'c1' } } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
// useAuth provides the uid; mock to a signed-in customer
vi.mock('@/lib/firebase/auth', () => ({ useAuth: () => ({ user: { uid: 'c1' }, claims: { role: 'customer' }, loading: false }) }))
import { NotificationBell } from './NotificationBell'

function emit(notifs: Record<string, unknown>[]) {
  snapCb({ docs: notifs.map((n) => ({ id: n.id, data: () => n })) })
}
const items = [
  { id: 'n1', userId: 'c1', type: 'status_change', title: 'R31-0001', body: 'Status: Ready for Collection', link: '/orders/o1', read: false, createdAt: 2 },
  { id: 'n2', userId: 'c1', type: 'price_update', title: 'R31-0001', body: 'Your quote was updated', link: '/orders/o1', read: true, createdAt: 1 },
]
beforeEach(() => { updateSpy.mockClear(); push.mockClear() })

describe('NotificationBell', () => {
  it('shows the unread count and lists notifications newest-first', () => {
    render(<NotificationBell />)
    emit(items)
    expect(screen.getByLabelText(/1 unread/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Status: Ready for Collection')).toBeInTheDocument()
  })
  it('marks an item read and navigates on click', async () => {
    render(<NotificationBell />)
    emit(items)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    fireEvent.click(screen.getByText('Status: Ready for Collection'))
    expect(updateSpy).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/orders/o1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/components/notifications/NotificationBell.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `NotificationBell`**

Build a `'use client'` component that:
- Reads the uid from `useAuth()` (handle `loading`/signed-out → render nothing).
- Subscribes via `onSnapshot(query(collection(db,'r31_notifications'), where('userId','==',uid)))`; in the callback, map docs → `Notification[]`, **sort by `createdAt` desc and slice to 20 client-side**; store in state. Unsubscribe on unmount.
- Renders a bell `<button>` with `aria-label={`Notifications, ${unread} unread`}` and a badge when `unread > 0` (`unread = items.filter(n => !n.read).length`).
- Toggling the button opens a dropdown panel listing items (title, body, relative time, an unread dot). Empty → "No notifications yet."
- Clicking an item: `await updateDoc(doc(db,'r31_notifications', n.id), { read: true })` then `router.push(n.link)`.
- A "Mark all as read" button updates each unread item's `read` to true.
- CSS module: design-system tokens only, 44px targets, dropdown becomes a near-full-width sheet under `@media (max-width:768px)`.

Match the established client-read style from Task 11 of 1b (`OrderDetail`/account pages). No `as any`/`@ts-ignore` (a `as Notification` cast on `doc.data()` is fine).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/components/notifications/NotificationBell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Mount in the customer layout**

Read `src/app/(customer)/layout.tsx`. Add `<NotificationBell/>` into the layout's header region (where the signed-in customer chrome lives), consistent with the existing layout markup. If the layout has no header element, add a minimal header row containing the bell aligned end. Keep it within the existing auth-gated layout (the bell only renders for a signed-in customer).

- [ ] **Step 6: Verify build-time wiring + typecheck**

Run: `npm run typecheck && npm test -- src/components/notifications/NotificationBell.test.tsx`
Expected: 0 type errors, tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/notifications "src/app/(customer)/layout.tsx"
git commit -m "feat: in-app notification bell + mount in customer layout"
```

---

## Final Integration & Verification

- [ ] **Typecheck + non-emulator suite:** `npm run typecheck` (0 errors) and `npx vitest run --exclude '**/queries.test.ts' --exclude '**/seedCatalog.test.ts' --exclude '**/orders/queries.test.ts'` (all pass).
- [ ] **Rules (emulator):** `npm run test:rules` — the new `r31_notifications` cases pass alongside the existing rules.
- [ ] **Manual E2E (dev, against live or emulator):** as a customer, book/open an order; as owner, change its status and adjust a line price; confirm the customer's bell shows an unread badge that increments live, the dropdown lists "Status: …" and "Your quote was updated" linking to the order, clicking marks read + navigates, and "mark all read" clears the badge. Confirm a second customer never sees the first's notifications.
- [ ] **Merge order:** this branch is off `phase-1b-orders`; merge **1b → main first**, then **1c → main**.

---

## Deferred to 1c-ii (do NOT build here)
FCM web push: `firebase-messaging-sw.js` service worker, `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, permission prompt (after first booking), `getToken`/`fcmTokens[]` lifecycle on `r31_users`, and sending push via `firebase-admin/messaging` from the same owner actions. The in-app store built here is its foundation.
