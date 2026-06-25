# Phase 2 — Invoicing, Payments & E-signature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners raise/adjust/issue invoices from orders, let customers pay (cash or BW electronic channels) with proof upload + owner verification, download a PDF, and capture an e-signature at collection that moves the order to *Completed*.

**Architecture:** A new `r31_invoices` collection (1:1 with an order), written only by transactional Admin-SDK server actions; payment status is authoritative on the invoice and mirrored onto the order in the same transaction. Reads are client-side via the Firebase SDK gated by security rules. PDF is rendered client-side with `@react-pdf/renderer`; notifications reuse the existing inline 1c fan-out.

**Tech Stack:** Next.js 16 (App Router) + React 19, Firebase (Firestore, Storage, Admin SDK), Zod v4, Vitest 4 + Testing Library, `@firebase/rules-unit-testing`, `@react-pdf/renderer`.

## Global Constraints

- **Money is integer `thebe`** everywhere (1 Pula = 100 thebe). Never store/compute floats. Format only at display via `formatPula` (`src/lib/money.ts`).
- **All `r31_invoices` writes go through Admin-SDK server actions** (`getAdminDb()`); clients never write invoices directly. Rules deny client writes.
- **Collections are `r31_*`; Storage prefix is `r31/`** (e.g. `r31/proof-of-payment/{orderId}/`, `r31/signatures/{orderId}/`).
- **Owner actions** verify with `verifyOwner(idToken)`; **customer actions** verify with `verifyUser(idToken)` (both from `@/lib/firebase/admin`). Return `ActionResult` from `@/lib/catalog/actionResult`; wrap throws with `fail(e)`.
- **Server-only lib files** start with `import 'server-only'` and their unit tests start with `vi.mock('server-only', () => ({}))`.
- **`firestore.rules` write discipline:** invoices are server-authoritative — `allow write: if false`.
- **Invoice number format:** `INV-####` (zero-padded to 4), counter at `r31_counters/invoices`.
- **Payment methods (verbatim):** `cash`, `bank_transfer`, `orange_money`, `myzaka`, `pay2cell`. Only `cash` is non-electronic.
- **New order status:** `completed` (deep-green `--success`), placed after `ready` and before `cancelled` in `ORDER_STATUSES`.
- **Branch:** `phase-2-invoicing` off `main`. Never build directly on `main` (auto-deploys to Vercel). Commit after every passing step.
- **Test commands:** unit/component `npm test`; rules `npm run test:rules`; types `npm run typecheck`.

---

## File Structure

**New files**
- `src/lib/types/invoice.ts` — `Invoice`, `InvoiceLineItem`, `InvoiceStatus`, `Discount`.
- `src/lib/invoices/paymentMethods.ts` — `PaymentMethod`, `PAYMENT_METHODS`, `isElectronic`, `PAYMENT_CHANNELS`.
- `src/lib/invoices/invoiceNumber.ts` (+ `.test.ts`) — number formatter + counter.
- `src/lib/invoices/totals.ts` (+ `.test.ts`) — pure `subtotal`/`discountAmount`/`computeTotals`.
- `src/lib/invoices/mappers.ts` (+ `.test.ts`) — `orderItemsToLineItems`, `toInvoice`.
- `src/lib/invoices/validation.ts` (+ `.test.ts`) — Zod schemas.
- `src/app/admin/invoices/actions.ts` (+ `.test.ts`) — create/update/issue/markPaidCash/verifyPayment/cancel.
- `src/app/admin/invoices/page.tsx`, `InvoiceQueue.tsx`, `InvoiceQueue.module.css` — verification queue.
- `src/components/invoices/InvoicePdf.tsx`, `DownloadInvoiceButton.tsx` — PDF.
- `src/components/invoices/InvoiceEditor.tsx` (+ `.test.tsx`) + `.module.css`.
- `src/components/invoices/ProofUploader.tsx` (+ `.test.tsx`).
- `src/components/invoices/PaymentBadge.tsx`, `InvoiceStatusPill.tsx`.
- `src/components/orders/SignaturePad.tsx` (+ `.test.tsx`) + `.module.css`.
- `tests/rules/invoices.test.ts` — Firestore rules emulator tests.

**Modified files**
- `src/lib/types/order.ts` — add `completed`; expand `paymentStatus`; add `invoiceId`/signature fields.
- `src/lib/orders/mappers.ts` — read `paymentStatus`/`invoiceId`/signature fields.
- `src/lib/notifications/buildNotification.ts` — `buildInvoiceNotification`, `buildPaymentNotification`.
- `src/app/admin/orders/actions.ts` (+ `.test.ts`) — `completeCollectionAction`.
- `src/app/(customer)/orders/actions.ts` (+ `.test.ts`) — `submitProofOfPaymentAction`.
- `src/app/admin/orders/[id]/OrderManager.tsx` — invoice panel + collection/signature wiring.
- `src/app/(customer)/orders/[id]/OrderDetail.tsx` — invoice card + proof upload.
- `src/app/(customer)/account/page.tsx` — invoices list section.
- `firestore.rules` — tighten `r31_invoices` to `write: if false`.
- `storage.rules` — scope proof/signature paths.

---

## Task 0: Branch setup

- [ ] **Step 1: Create the working branch**

```bash
git checkout main && git pull
git checkout -b phase-2-invoicing
```

- [ ] **Step 2: Confirm clean baseline**

Run: `npm test && npm run typecheck`
Expected: existing suites PASS, no type errors. (If failing on `main`, stop and report.)

---

## Task 1: Order type, `completed` status & mapper

**Files:**
- Modify: `src/lib/types/order.ts`
- Modify: `src/lib/orders/mappers.ts`
- Test: `src/lib/types/order.test.ts` (exists), `src/lib/orders/mappers.test.ts` (exists)

**Interfaces:**
- Produces: `ORDER_STATUSES` includes `'completed'`; `statusMeta.completed = { label: 'Completed', token: '--success', hold: false }`; `Order.paymentStatus: 'unpaid' | 'payment_submitted' | 'paid'`; `Order.invoiceId: string | null`; `Order.signatureURL?: string`; `Order.signedAt?: number`; `Order.completedAt?: number`.

- [ ] **Step 1: Write failing test for the new status + payment field**

Append to `src/lib/types/order.test.ts` (create the file if absent, mirroring existing test style):

```typescript
import { describe, it, expect } from 'vitest'
import { ORDER_STATUSES, statusMeta } from './order'

describe('order statuses', () => {
  it('includes completed with deep-green success token, ordered before cancelled', () => {
    expect(ORDER_STATUSES).toContain('completed')
    expect(ORDER_STATUSES.indexOf('completed')).toBeLessThan(ORDER_STATUSES.indexOf('cancelled'))
    expect(statusMeta.completed).toEqual({ label: 'Completed', token: '--success', hold: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/types/order.test.ts`
Expected: FAIL (`completed` missing).

- [ ] **Step 3: Update `order.ts`**

In `src/lib/types/order.ts`:

```typescript
export const ORDER_STATUSES = [
  'placed', 'received', 'diagnosing', 'awaiting_approval',
  'in_repair', 'awaiting_parts', 'ready', 'completed', 'cancelled',
] as const
```

Add to `statusMeta` (before `cancelled`):

```typescript
  ready:             { label: 'Ready for Collection',  token: '--success',       hold: false },
  completed:         { label: 'Completed',             token: '--success',       hold: false },
  cancelled:         { label: 'Cancelled',             token: '--danger',        hold: false },
```

Update the `Order` interface:

```typescript
export interface Order {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  customerPhone: string
  status: OrderStatus
  paymentStatus: 'unpaid' | 'payment_submitted' | 'paid'
  invoiceId: string | null
  devices: OrderDevice[]
  items: OrderItem[]
  estimatedTotal: number
  finalTotal?: number
  signatureURL?: string
  signedAt?: number
  completedAt?: number
  createdAt: number
  updatedAt: number
}
```

- [ ] **Step 4: Write failing test for the mapper**

Append to `src/lib/orders/mappers.test.ts`:

```typescript
import { toOrder } from './mappers'

describe('toOrder payment + invoice fields', () => {
  it('reads paymentStatus and invoiceId from the doc, defaulting safely', () => {
    const o = toOrder('o1', { orderNumber: 'R31-0001', customerId: 'c1', status: 'ready' })
    expect(o.paymentStatus).toBe('unpaid')
    expect(o.invoiceId).toBeNull()
    const p = toOrder('o2', { paymentStatus: 'paid', invoiceId: 'inv1', signatureURL: 's', signedAt: 5, completedAt: 6 })
    expect(p.paymentStatus).toBe('paid')
    expect(p.invoiceId).toBe('inv1')
    expect(p.completedAt).toBe(6)
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- src/lib/orders/mappers.test.ts`
Expected: FAIL (`paymentStatus` hardcoded to `'unpaid'`, no `invoiceId`).

- [ ] **Step 6: Update `toOrder` in `src/lib/orders/mappers.ts`**

```typescript
export function toOrder(id: string, d: D): Order {
  return {
    id, orderNumber: d.orderNumber, customerId: d.customerId,
    customerName: d.customerName ?? '', customerPhone: d.customerPhone ?? '',
    status: d.status,
    paymentStatus: d.paymentStatus ?? 'unpaid',
    invoiceId: d.invoiceId ?? null,
    devices: d.devices ?? [], items: d.items ?? [],
    estimatedTotal: d.estimatedTotal ?? 0, finalTotal: d.finalTotal,
    signatureURL: d.signatureURL, signedAt: d.signedAt, completedAt: d.completedAt,
    createdAt: d.createdAt ?? 0, updatedAt: d.updatedAt ?? 0,
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- src/lib/types/order.test.ts src/lib/orders/mappers.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types/order.ts src/lib/types/order.test.ts src/lib/orders/mappers.ts src/lib/orders/mappers.test.ts
git commit -m "feat: add completed status + invoice/payment fields to Order"
```

---

## Task 2: Invoice types

**Files:**
- Create: `src/lib/types/invoice.ts`

**Interfaces:**
- Produces: `InvoiceStatus`, `Discount`, `InvoiceLineItem`, `Invoice` (consumed by every later task).

- [ ] **Step 1: Create `src/lib/types/invoice.ts`**

```typescript
// src/lib/types/invoice.ts
import type { PaymentMethod } from '@/lib/invoices/paymentMethods'

export type InvoiceStatus = 'draft' | 'issued' | 'payment_submitted' | 'paid' | 'cancelled'

export interface Discount {
  type: 'amount' | 'percent'
  value: number // amount: thebe; percent: 0-100 whole number
}

export interface InvoiceLineItem {
  lineId: string
  description: string
  sourceItemId: string | null // null = ad-hoc line added on the invoice
  amount: number // thebe
}

export interface Invoice {
  id: string
  invoiceNumber: string
  orderId: string
  customerId: string
  customerName: string
  customerPhone: string
  lineItems: InvoiceLineItem[]
  discount: Discount | null
  subtotal: number
  discountAmount: number
  total: number
  currency: 'BWP'
  status: InvoiceStatus
  paymentMethod: PaymentMethod | null
  proofOfPaymentURL: string | null
  proofUploadedAt: number | null
  verifiedBy: string | null
  verifiedAt: number | null
  issuedAt: number | null
  paidAt: number | null
  createdAt: number
  updatedAt: number
  createdBy: string
}
```

- [ ] **Step 2: Commit** (typecheck runs after Task 3, which provides `PaymentMethod`)

```bash
git add src/lib/types/invoice.ts
git commit -m "feat: add Invoice types"
```

---

## Task 3: Payment-method config

**Files:**
- Create: `src/lib/invoices/paymentMethods.ts`
- Test: `src/lib/invoices/paymentMethods.test.ts`

**Interfaces:**
- Produces: `PaymentMethod` union; `PAYMENT_METHODS: PaymentMethod[]`; `isElectronic(m: PaymentMethod): boolean`; `PAYMENT_CHANNELS: PaymentChannel[]` where `PaymentChannel = { id: PaymentMethod; label: string; payToLabel: string; details: string }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/invoices/paymentMethods.test.ts
import { describe, it, expect } from 'vitest'
import { PAYMENT_METHODS, isElectronic, PAYMENT_CHANNELS } from './paymentMethods'

describe('payment methods', () => {
  it('lists all five methods', () => {
    expect(PAYMENT_METHODS).toEqual(['cash', 'bank_transfer', 'orange_money', 'myzaka', 'pay2cell'])
  })
  it('treats only cash as non-electronic', () => {
    expect(isElectronic('cash')).toBe(false)
    expect(isElectronic('orange_money')).toBe(true)
    expect(isElectronic('bank_transfer')).toBe(true)
  })
  it('exposes a pay-to channel for every electronic method', () => {
    const ids = PAYMENT_CHANNELS.map((c) => c.id)
    expect(ids).toEqual(['bank_transfer', 'orange_money', 'myzaka', 'pay2cell'])
    for (const c of PAYMENT_CHANNELS) {
      expect(c.label).toBeTruthy()
      expect(c.details).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/invoices/paymentMethods.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/invoices/paymentMethods.ts`**

```typescript
// src/lib/invoices/paymentMethods.ts
export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'orange_money', 'myzaka', 'pay2cell'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function isElectronic(m: PaymentMethod): boolean {
  return m !== 'cash'
}

export interface PaymentChannel {
  id: PaymentMethod
  label: string
  payToLabel: string
  details: string
}

// PLACEHOLDER pay-to details — real account/merchant numbers to be supplied by the
// shop owner; becomes admin-editable in Phase 5 settings.
export const PAYMENT_CHANNELS: PaymentChannel[] = [
  { id: 'bank_transfer', label: 'Bank transfer', payToLabel: 'Bank account', details: 'FNB Botswana — Acct 0000000000 (branch 28xxxx)' },
  { id: 'orange_money',  label: 'Orange Money',  payToLabel: 'Merchant',     details: 'Orange Money merchant 000000' },
  { id: 'myzaka',        label: 'MyZaka',        payToLabel: 'MyZaka number', details: '7XXXXXXX' },
  { id: 'pay2cell',      label: 'Pay2Cell',      payToLabel: 'Pay2Cell number', details: '7XXXXXXX' },
]
```

> Note: `details` strings are placeholders. They are *content*, not logic — the owner will supply real values; nothing else depends on their exact text.

- [ ] **Step 4: Run test + typecheck**

Run: `npm test -- src/lib/invoices/paymentMethods.test.ts && npm run typecheck`
Expected: PASS (typecheck now also resolves `Invoice`'s `PaymentMethod` import from Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/paymentMethods.ts src/lib/invoices/paymentMethods.test.ts
git commit -m "feat: add payment-method config + isElectronic helper"
```

---

## Task 4: Invoice number generator

**Files:**
- Create: `src/lib/invoices/invoiceNumber.ts`
- Test: `src/lib/invoices/invoiceNumber.test.ts`

**Interfaces:**
- Produces: `formatInvoiceNumber(seq: number): string`; `nextInvoiceNumber(db: Firestore): Promise<string>`.

- [ ] **Step 1: Write the failing test** (mirrors `orderNumber.test.ts`)

```typescript
// src/lib/invoices/invoiceNumber.test.ts
import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { formatInvoiceNumber } from './invoiceNumber'

describe('formatInvoiceNumber', () => {
  it('zero-pads to 4 digits with the INV- prefix', () => {
    expect(formatInvoiceNumber(1)).toBe('INV-0001')
    expect(formatInvoiceNumber(42)).toBe('INV-0042')
    expect(formatInvoiceNumber(12345)).toBe('INV-12345')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/invoices/invoiceNumber.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/invoices/invoiceNumber.ts`**

```typescript
import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'

export function formatInvoiceNumber(seq: number): string {
  return `INV-${String(seq).padStart(4, '0')}`
}

export async function nextInvoiceNumber(db: Firestore): Promise<string> {
  const ref = db.collection('r31_counters').doc('invoices')
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const next = ((snap.exists ? (snap.data()!.seq as number) : 0) ?? 0) + 1
    tx.set(ref, { seq: next }, { merge: true })
    return next
  })
  return formatInvoiceNumber(seq)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/invoices/invoiceNumber.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/invoiceNumber.ts src/lib/invoices/invoiceNumber.test.ts
git commit -m "feat: add invoice number generator"
```

---

## Task 5: Totals (pure)

**Files:**
- Create: `src/lib/invoices/totals.ts`
- Test: `src/lib/invoices/totals.test.ts`

**Interfaces:**
- Consumes: `InvoiceLineItem`, `Discount` (Task 2).
- Produces: `subtotal(items)`, `discountAmount(subtotal, discount)`, `computeTotals(items, discount) => { subtotal, discountAmount, total }` — all thebe integers.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/invoices/totals.test.ts
import { describe, it, expect } from 'vitest'
import { subtotal, discountAmount, computeTotals } from './totals'
import type { InvoiceLineItem } from '@/lib/types/invoice'

const items: InvoiceLineItem[] = [
  { lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 },
  { lineId: 'b', description: 'Seal', sourceItemId: null, amount: 8000 },
]

describe('totals', () => {
  it('sums line items', () => {
    expect(subtotal(items)).toBe(128000)
  })
  it('applies a fixed-amount discount, clamped to subtotal', () => {
    expect(discountAmount(128000, { type: 'amount', value: 10000 })).toBe(10000)
    expect(discountAmount(128000, { type: 'amount', value: 999999 })).toBe(128000)
  })
  it('applies a percent discount, rounded to thebe', () => {
    expect(discountAmount(128000, { type: 'percent', value: 10 })).toBe(12800)
    expect(discountAmount(12345, { type: 'percent', value: 10 })).toBe(1235) // rounds .5 up
  })
  it('returns 0 discount when null', () => {
    expect(discountAmount(128000, null)).toBe(0)
  })
  it('computes totals and never goes below zero', () => {
    expect(computeTotals(items, { type: 'percent', value: 10 })).toEqual({ subtotal: 128000, discountAmount: 12800, total: 115200 })
    expect(computeTotals(items, { type: 'amount', value: 999999 })).toEqual({ subtotal: 128000, discountAmount: 128000, total: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/invoices/totals.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/invoices/totals.ts`**

```typescript
import type { InvoiceLineItem, Discount } from '@/lib/types/invoice'

export function subtotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, it) => sum + it.amount, 0)
}

export function discountAmount(sub: number, discount: Discount | null): number {
  if (!discount) return 0
  if (discount.type === 'amount') return Math.min(discount.value, sub)
  return Math.min(Math.round((sub * discount.value) / 100), sub)
}

export function computeTotals(items: InvoiceLineItem[], discount: Discount | null) {
  const sub = subtotal(items)
  const disc = discountAmount(sub, discount)
  return { subtotal: sub, discountAmount: disc, total: Math.max(sub - disc, 0) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/invoices/totals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/totals.ts src/lib/invoices/totals.test.ts
git commit -m "feat: add invoice totals (subtotal/discount/total) in thebe"
```

---

## Task 6: Invoice mappers (snapshot + deserialize)

**Files:**
- Create: `src/lib/invoices/mappers.ts`
- Test: `src/lib/invoices/mappers.test.ts`

**Interfaces:**
- Consumes: `OrderItem` (`@/lib/types/order`), `Invoice`/`InvoiceLineItem` (Task 2).
- Produces: `orderItemsToLineItems(items: OrderItem[]): InvoiceLineItem[]`; `toInvoice(id: string, d: Record<string, any>): Invoice`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/invoices/mappers.test.ts
import { describe, it, expect } from 'vitest'
import { orderItemsToLineItems, toInvoice } from './mappers'
import type { OrderItem } from '@/lib/types/order'

const orderItems: OrderItem[] = [
  { itemId: 'i1', deviceId: 'd1', serviceId: 's1', serviceName: 'Screen Replacement', variant: 'OLED', quotedAmount: 120000, lineStatus: 'placed' },
  { itemId: 'i2', deviceId: 'd1', serviceId: 's2', serviceName: 'Battery', variant: null, quotedAmount: 35000, finalAmount: 40000, lineStatus: 'placed' },
]

describe('orderItemsToLineItems', () => {
  it('snapshots each order item, preferring finalAmount and labelling the variant', () => {
    const lines = orderItemsToLineItems(orderItems)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ description: 'Screen Replacement (OLED)', sourceItemId: 'i1', amount: 120000 })
    expect(lines[1]).toMatchObject({ description: 'Battery', sourceItemId: 'i2', amount: 40000 })
    expect(lines[0].lineId).toBeTruthy()
  })
})

describe('toInvoice', () => {
  it('maps a firestore doc into an Invoice with safe defaults', () => {
    const inv = toInvoice('inv1', {
      invoiceNumber: 'INV-0001', orderId: 'o1', customerId: 'c1',
      customerName: 'Thabo', customerPhone: '7', lineItems: [], discount: null,
      subtotal: 0, discountAmount: 0, total: 0, currency: 'BWP', status: 'draft',
      createdAt: 1, updatedAt: 1, createdBy: 'o1',
    })
    expect(inv.id).toBe('inv1')
    expect(inv.status).toBe('draft')
    expect(inv.paymentMethod).toBeNull()
    expect(inv.proofOfPaymentURL).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/invoices/mappers.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/invoices/mappers.ts`**

```typescript
import type { OrderItem } from '@/lib/types/order'
import type { Invoice, InvoiceLineItem } from '@/lib/types/invoice'

type D = Record<string, any>

export function orderItemsToLineItems(items: OrderItem[]): InvoiceLineItem[] {
  return items.map((it, idx) => ({
    lineId: `${it.itemId}-${idx}`,
    description: it.variant ? `${it.serviceName} (${it.variant})` : it.serviceName,
    sourceItemId: it.itemId,
    amount: it.finalAmount ?? it.quotedAmount,
  }))
}

export function toInvoice(id: string, d: D): Invoice {
  return {
    id,
    invoiceNumber: d.invoiceNumber,
    orderId: d.orderId,
    customerId: d.customerId,
    customerName: d.customerName ?? '',
    customerPhone: d.customerPhone ?? '',
    lineItems: d.lineItems ?? [],
    discount: d.discount ?? null,
    subtotal: d.subtotal ?? 0,
    discountAmount: d.discountAmount ?? 0,
    total: d.total ?? 0,
    currency: 'BWP',
    status: d.status,
    paymentMethod: d.paymentMethod ?? null,
    proofOfPaymentURL: d.proofOfPaymentURL ?? null,
    proofUploadedAt: d.proofUploadedAt ?? null,
    verifiedBy: d.verifiedBy ?? null,
    verifiedAt: d.verifiedAt ?? null,
    issuedAt: d.issuedAt ?? null,
    paidAt: d.paidAt ?? null,
    createdAt: d.createdAt ?? 0,
    updatedAt: d.updatedAt ?? 0,
    createdBy: d.createdBy ?? '',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/invoices/mappers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/mappers.ts src/lib/invoices/mappers.test.ts
git commit -m "feat: add invoice mappers (order snapshot + deserialize)"
```

---

## Task 7: Validation schemas

**Files:**
- Create: `src/lib/invoices/validation.ts`
- Test: `src/lib/invoices/validation.test.ts`

**Interfaces:**
- Produces: `discountSchema`, `lineItemSchema`, `updateInvoiceSchema` (`{ lineItems, discount }`), `proofSchema` (`{ paymentMethod, proofURL }`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/invoices/validation.test.ts
import { describe, it, expect } from 'vitest'
import { updateInvoiceSchema, proofSchema } from './validation'

describe('updateInvoiceSchema', () => {
  it('accepts integer thebe amounts and an optional discount', () => {
    const ok = updateInvoiceSchema.safeParse({
      lineItems: [{ lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 }],
      discount: { type: 'percent', value: 10 },
    })
    expect(ok.success).toBe(true)
  })
  it('rejects non-integer / negative amounts', () => {
    expect(updateInvoiceSchema.safeParse({ lineItems: [{ lineId: 'a', description: 'x', sourceItemId: null, amount: 1.5 }], discount: null }).success).toBe(false)
    expect(updateInvoiceSchema.safeParse({ lineItems: [{ lineId: 'a', description: 'x', sourceItemId: null, amount: -1 }], discount: null }).success).toBe(false)
  })
  it('rejects a percent discount above 100', () => {
    expect(updateInvoiceSchema.safeParse({ lineItems: [{ lineId: 'a', description: 'x', sourceItemId: null, amount: 1 }], discount: { type: 'percent', value: 101 } }).success).toBe(false)
  })
})

describe('proofSchema', () => {
  it('requires an electronic method and a URL', () => {
    expect(proofSchema.safeParse({ paymentMethod: 'orange_money', proofURL: 'https://x/y.png' }).success).toBe(true)
    expect(proofSchema.safeParse({ paymentMethod: 'cash', proofURL: 'https://x/y.png' }).success).toBe(false)
    expect(proofSchema.safeParse({ paymentMethod: 'orange_money', proofURL: '' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/invoices/validation.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/invoices/validation.ts`**

```typescript
import { z } from 'zod'

export const discountSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('amount'), value: z.number().int().nonnegative() }),
  z.object({ type: z.literal('percent'), value: z.number().int().min(0).max(100) }),
]).nullable()

export const lineItemSchema = z.object({
  lineId: z.string().min(1),
  description: z.string().min(1).max(200),
  sourceItemId: z.string().min(1).nullable(),
  amount: z.number().int().nonnegative(),
})

export const updateInvoiceSchema = z.object({
  lineItems: z.array(lineItemSchema).min(1),
  discount: discountSchema,
})
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>

export const proofSchema = z.object({
  paymentMethod: z.enum(['bank_transfer', 'orange_money', 'myzaka', 'pay2cell']),
  proofURL: z.string().url(),
})
export type ProofInput = z.infer<typeof proofSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/invoices/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/validation.ts src/lib/invoices/validation.test.ts
git commit -m "feat: add invoice validation schemas"
```

---

## Task 8: Notification builders for invoice + payment

**Files:**
- Modify: `src/lib/notifications/buildNotification.ts`
- Test: `src/lib/notifications/buildNotification.test.ts` (exists)

**Interfaces:**
- Consumes: `Notification` type. Note `NotificationType` currently is `'status_change' | 'price_update'` — extend it.
- Produces: `buildInvoiceNotification({ userId, orderId, orderNumber, now })`; `buildPaymentNotification({ userId, orderId, orderNumber, paid, now })` (`paid:true` → "Payment confirmed"; `paid:false` → "Payment proof was not accepted").

- [ ] **Step 1: Extend the notification type union**

In `src/lib/types/notification.ts`, add `'invoice_issued' | 'payment_update'` to the `NotificationType` union (keep existing members).

- [ ] **Step 2: Write the failing test**

Append to `src/lib/notifications/buildNotification.test.ts`:

```typescript
import { buildInvoiceNotification, buildPaymentNotification } from './buildNotification'

describe('invoice + payment notifications', () => {
  it('builds an invoice-issued notification', () => {
    const n = buildInvoiceNotification({ userId: 'c1', orderId: 'o1', orderNumber: 'R31-0042', now: 5 })
    expect(n).toMatchObject({ userId: 'c1', type: 'invoice_issued', link: '/orders/o1', read: false, createdAt: 5 })
    expect(n.body).toMatch(/invoice/i)
  })
  it('builds payment confirmed / rejected notifications', () => {
    expect(buildPaymentNotification({ userId: 'c1', orderId: 'o1', orderNumber: 'R31-0042', paid: true, now: 5 }).body).toMatch(/confirmed/i)
    expect(buildPaymentNotification({ userId: 'c1', orderId: 'o1', orderNumber: 'R31-0042', paid: false, now: 5 }).body).toMatch(/not accepted/i)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/notifications/buildNotification.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 4: Add the builders to `src/lib/notifications/buildNotification.ts`**

```typescript
export function buildInvoiceNotification(args: {
  userId: string; orderId: string; orderNumber: string; now: number
}): Body {
  return {
    userId: args.userId, type: 'invoice_issued', title: args.orderNumber,
    body: 'Your invoice is ready',
    link: `/orders/${args.orderId}`, read: false, createdAt: args.now,
  }
}

export function buildPaymentNotification(args: {
  userId: string; orderId: string; orderNumber: string; paid: boolean; now: number
}): Body {
  return {
    userId: args.userId, type: 'payment_update', title: args.orderNumber,
    body: args.paid ? 'Payment confirmed' : 'Payment proof was not accepted',
    link: `/orders/${args.orderId}`, read: false, createdAt: args.now,
  }
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npm test -- src/lib/notifications/buildNotification.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/notification.ts src/lib/notifications/buildNotification.ts src/lib/notifications/buildNotification.test.ts
git commit -m "feat: add invoice + payment notification builders"
```

---

## Task 9: Admin invoice actions — create

**Files:**
- Create: `src/app/admin/invoices/actions.ts`
- Test: `src/app/admin/invoices/actions.test.ts`

**Interfaces:**
- Consumes: `verifyOwner`/`getAdminDb`, `nextInvoiceNumber`, `orderItemsToLineItems`, `computeTotals`, `fail`/`ActionResult`.
- Produces: `createInvoiceAction(idToken, orderId): Promise<ActionResult & { invoiceId?: string }>`. The shared test mock defined here (`makeDb`) is reused by Tasks 10–11.

- [ ] **Step 1: Write the failing test (with the reusable two-doc mock)**

```typescript
// src/app/admin/invoices/actions.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = {
  order: {} as Record<string, any>,
  invoice: null as Record<string, any> | null,
  writes: [] as { path: string; data: Record<string, any> }[],
  revalidated: [] as string[],
}

vi.mock('next/cache', () => ({ revalidatePath: (p: string) => state.revalidated.push(p) }))
vi.mock('@/lib/invoices/invoiceNumber', () => ({
  nextInvoiceNumber: async () => 'INV-0007',
}))
vi.mock('@/lib/firebase/admin', () => ({
  verifyOwner: async (t: string) => { if (t !== 'owner') throw new Error('FORBIDDEN'); return { uid: 'o1' } },
  getAdminDb: () => makeDb(),
}))

// Routes tx.get/update/set by ref.path; order doc id 'o1', invoice doc id 'inv1'.
function makeDb() {
  const ref = (path: string) => ({
    path,
    collection: (c: string) => ({ doc: (id?: string) => ref(`${path}/${c}/${id ?? 'auto'}`) }),
  })
  const dataFor = (path: string) =>
    path.startsWith('r31_orders') ? state.order : state.invoice
  const applyUpdate = (path: string, d: Record<string, any>) => {
    if (path.startsWith('r31_orders')) Object.assign(state.order, d)
    else state.invoice = { ...(state.invoice ?? {}), ...d }
  }
  return {
    collection: (c: string) => ({ doc: (id?: string) => ref(`${c}/${id ?? 'inv1'}`) }),
    runTransaction: async (fn: (tx: any) => Promise<unknown>) => fn({
      get: async (r: { path: string }) => {
        const d = dataFor(r.path)
        return { exists: !!d && Object.keys(d).length > 0, data: () => d }
      },
      update: (r: { path: string }, d: Record<string, any>) => applyUpdate(r.path, d),
      set: (r: { path: string }, d: Record<string, any>) => {
        state.writes.push({ path: r.path, data: d })
        applyUpdate(r.path, d)
      },
    }),
  }
}

beforeEach(() => {
  state.order = {
    orderNumber: 'R31-0042', customerId: 'c1', customerName: 'Thabo', customerPhone: '7',
    status: 'ready', paymentStatus: 'unpaid', invoiceId: null,
    items: [
      { itemId: 'i1', serviceName: 'Screen Replacement', variant: 'OLED', quotedAmount: 120000, lineStatus: 'placed' },
      { itemId: 'i2', serviceName: 'Battery', variant: null, quotedAmount: 35000, finalAmount: 40000, lineStatus: 'placed' },
    ],
  }
  state.invoice = null
  state.writes.length = 0
  state.revalidated.length = 0
})

describe('createInvoiceAction', () => {
  it('rejects a non-owner', async () => {
    const { createInvoiceAction } = await import('./actions')
    expect(await createInvoiceAction('cust', 'o1')).toMatchObject({ ok: false, error: 'FORBIDDEN' })
  })
  it('snapshots order items into a draft invoice and links it to the order', async () => {
    const { createInvoiceAction } = await import('./actions')
    const r = await createInvoiceAction('owner', 'o1')
    expect(r.ok).toBe(true)
    const inv = state.writes.find((w) => w.path.startsWith('r31_invoices'))!.data
    expect(inv).toMatchObject({ invoiceNumber: 'INV-0007', status: 'draft', orderId: 'o1', customerId: 'c1', total: 160000 })
    expect(inv.lineItems).toHaveLength(2)
    expect(state.order.invoiceId).toBe('inv1')
  })
  it('refuses to create a second invoice when one already exists', async () => {
    state.order.invoiceId = 'existing'
    const { createInvoiceAction } = await import('./actions')
    expect(await createInvoiceAction('owner', 'o1')).toMatchObject({ ok: false, error: 'INVALID' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/admin/invoices/actions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/app/admin/invoices/actions.ts` with `createInvoiceAction`**

```typescript
// src/app/admin/invoices/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { verifyOwner, getAdminDb } from '@/lib/firebase/admin'
import { nextInvoiceNumber } from '@/lib/invoices/invoiceNumber'
import { orderItemsToLineItems } from '@/lib/invoices/mappers'
import { computeTotals } from '@/lib/invoices/totals'
import { fail, type ActionResult } from '@/lib/catalog/actionResult'
import type { OrderItem } from '@/lib/types/order'

function revalidateInvoice(orderId: string) {
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/invoices')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/account')
}

export async function createInvoiceAction(
  idToken: string,
  orderId: string,
): Promise<ActionResult & { invoiceId?: string }> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }

  const db = getAdminDb()
  const orderRef = db.collection('r31_orders').doc(orderId)
  const invoiceRef = db.collection('r31_invoices').doc()
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef)
      if (!snap.exists) throw new Error('INVALID')
      const order = snap.data()!
      if (order.invoiceId) throw new Error('INVALID') // already invoiced (cancel first to re-invoice)
      const lineItems = orderItemsToLineItems((order.items ?? []) as OrderItem[])
      const totals = computeTotals(lineItems, null)
      const now = Date.now()
      const invoiceNumber = await nextInvoiceNumber(db)
      tx.set(invoiceRef, {
        invoiceNumber, orderId, customerId: order.customerId,
        customerName: order.customerName ?? '', customerPhone: order.customerPhone ?? '',
        lineItems, discount: null, ...totals, currency: 'BWP', status: 'draft',
        paymentMethod: null, proofOfPaymentURL: null, proofUploadedAt: null,
        verifiedBy: null, verifiedAt: null, issuedAt: null, paidAt: null,
        createdAt: now, updatedAt: now, createdBy: uid,
      })
      tx.update(orderRef, { invoiceId: invoiceRef.id, updatedAt: now })
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true, invoiceId: invoiceRef.id }
}
```

> Note: `nextInvoiceNumber` runs its own transaction; calling it inside the outer transaction is acceptable here (single-shop, no contention) and is mocked in tests. If contention ever matters, move the counter read into the same `tx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/admin/invoices/actions.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/invoices/actions.ts src/app/admin/invoices/actions.test.ts
git commit -m "feat: add createInvoiceAction (snapshot order -> draft invoice)"
```

---

## Task 10: Admin invoice actions — update, issue, markPaidCash, verifyPayment, cancel

**Files:**
- Modify: `src/app/admin/invoices/actions.ts`
- Modify: `src/app/admin/invoices/actions.test.ts`

**Interfaces:**
- Produces: `updateInvoiceAction(idToken, invoiceId, input)`, `issueInvoiceAction(idToken, invoiceId)`, `markPaidCashAction(idToken, invoiceId)`, `verifyPaymentAction(idToken, invoiceId, approve)`, `cancelInvoiceAction(idToken, invoiceId)` — all `Promise<ActionResult>`.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/admin/invoices/actions.test.ts` (the `makeDb` mock already routes both docs; set `state.invoice` per test):

```typescript
const notifs = () => state.writes.filter((w) => w.path.startsWith('r31_notifications')).map((w) => w.data)

describe('issue / pay / verify', () => {
  beforeEach(() => {
    state.invoice = {
      invoiceNumber: 'INV-0007', orderId: 'o1', customerId: 'c1', status: 'draft',
      lineItems: [{ lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 }],
      discount: null, subtotal: 120000, discountAmount: 0, total: 120000,
    }
  })

  it('updateInvoiceAction recomputes totals on a draft', async () => {
    const { updateInvoiceAction } = await import('./actions')
    const r = await updateInvoiceAction('owner', 'inv1', {
      lineItems: [
        { lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 },
        { lineId: 'b', description: 'Seal', sourceItemId: null, amount: 8000 },
      ],
      discount: { type: 'amount', value: 8000 },
    })
    expect(r.ok).toBe(true)
    expect(state.invoice).toMatchObject({ subtotal: 128000, discountAmount: 8000, total: 120000 })
  })

  it('issueInvoiceAction flips draft->issued and notifies the customer', async () => {
    const { issueInvoiceAction } = await import('./actions')
    const r = await issueInvoiceAction('owner', 'inv1')
    expect(r.ok).toBe(true)
    expect(state.invoice!.status).toBe('issued')
    expect(state.invoice!.issuedAt).toBeTypeOf('number')
    expect(notifs().some((n) => n.type === 'invoice_issued' && n.userId === 'c1')).toBe(true)
  })

  it('markPaidCashAction flips issued->paid, mirrors order, notifies', async () => {
    state.invoice!.status = 'issued'
    const { markPaidCashAction } = await import('./actions')
    const r = await markPaidCashAction('owner', 'inv1')
    expect(r.ok).toBe(true)
    expect(state.invoice).toMatchObject({ status: 'paid', paymentMethod: 'cash' })
    expect(state.order.paymentStatus).toBe('paid')
    expect(notifs().some((n) => n.type === 'payment_update')).toBe(true)
  })

  it('verifyPaymentAction approve -> paid + mirror', async () => {
    state.invoice = { ...state.invoice, status: 'payment_submitted', paymentMethod: 'orange_money', proofOfPaymentURL: 'u' }
    const { verifyPaymentAction } = await import('./actions')
    const r = await verifyPaymentAction('owner', 'inv1', true)
    expect(r.ok).toBe(true)
    expect(state.invoice!.status).toBe('paid')
    expect(state.order.paymentStatus).toBe('paid')
  })

  it('verifyPaymentAction reject -> issued, clears proof, mirrors unpaid', async () => {
    state.order.paymentStatus = 'payment_submitted'
    state.invoice = { ...state.invoice, status: 'payment_submitted', paymentMethod: 'orange_money', proofOfPaymentURL: 'u' }
    const { verifyPaymentAction } = await import('./actions')
    const r = await verifyPaymentAction('owner', 'inv1', false)
    expect(r.ok).toBe(true)
    expect(state.invoice!.status).toBe('issued')
    expect(state.invoice!.proofOfPaymentURL).toBeNull()
    expect(state.order.paymentStatus).toBe('unpaid')
  })

  it('cancelInvoiceAction cancels a non-paid invoice', async () => {
    const { cancelInvoiceAction } = await import('./actions')
    const r = await cancelInvoiceAction('owner', 'inv1')
    expect(r.ok).toBe(true)
    expect(state.invoice!.status).toBe('cancelled')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/admin/invoices/actions.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Add the actions to `src/app/admin/invoices/actions.ts`**

Add imports at the top:

```typescript
import { updateInvoiceSchema } from '@/lib/invoices/validation'
import { computeTotals } from '@/lib/invoices/totals' // already imported in Task 9
import { buildInvoiceNotification, buildPaymentNotification } from '@/lib/notifications/buildNotification'
```

Append the functions:

```typescript
export async function updateInvoiceAction(
  idToken: string, invoiceId: string,
  input: { lineItems: unknown; discount: unknown },
): Promise<ActionResult> {
  let _uid: string
  try { _uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const parsed = updateInvoiceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status !== 'draft') throw new Error('INVALID') // only editable while draft
      const totals = computeTotals(parsed.data.lineItems, parsed.data.discount)
      tx.update(ref, { lineItems: parsed.data.lineItems, discount: parsed.data.discount, ...totals, updatedAt: Date.now() })
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}

export async function issueInvoiceAction(idToken: string, invoiceId: string): Promise<ActionResult> {
  let _uid: string
  try { _uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  const notifRef = db.collection('r31_notifications').doc()
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status !== 'draft') throw new Error('INVALID')
      const now = Date.now()
      tx.update(ref, { status: 'issued', issuedAt: now, updatedAt: now })
      tx.set(notifRef, buildInvoiceNotification({ userId: inv.customerId, orderId: inv.orderId, orderNumber: inv.invoiceNumber, now }))
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}

export async function markPaidCashAction(idToken: string, invoiceId: string): Promise<ActionResult> {
  return settlePayment(idToken, invoiceId, { method: 'cash', verifierUid: null })
}

export async function verifyPaymentAction(idToken: string, invoiceId: string, approve: boolean): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  const notifRef = db.collection('r31_notifications').doc()
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status !== 'payment_submitted') throw new Error('INVALID')
      const now = Date.now()
      const orderRef = db.collection('r31_orders').doc(inv.orderId)
      if (approve) {
        tx.update(ref, { status: 'paid', verifiedBy: uid, verifiedAt: now, paidAt: now, updatedAt: now })
        tx.update(orderRef, { paymentStatus: 'paid', updatedAt: now })
      } else {
        tx.update(ref, { status: 'issued', proofOfPaymentURL: null, proofUploadedAt: null, updatedAt: now })
        tx.update(orderRef, { paymentStatus: 'unpaid', updatedAt: now })
      }
      tx.set(notifRef, buildPaymentNotification({ userId: inv.customerId, orderId: inv.orderId, orderNumber: inv.invoiceNumber, paid: approve, now }))
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}

async function settlePayment(
  idToken: string, invoiceId: string, opts: { method: 'cash'; verifierUid: string | null },
): Promise<ActionResult> {
  let _uid: string
  try { _uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  const notifRef = db.collection('r31_notifications').doc()
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status !== 'issued') throw new Error('INVALID')
      const now = Date.now()
      tx.update(ref, { status: 'paid', paymentMethod: opts.method, paidAt: now, updatedAt: now })
      tx.update(db.collection('r31_orders').doc(inv.orderId), { paymentStatus: 'paid', updatedAt: now })
      tx.set(notifRef, buildPaymentNotification({ userId: inv.customerId, orderId: inv.orderId, orderNumber: inv.invoiceNumber, paid: true, now }))
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}

export async function cancelInvoiceAction(idToken: string, invoiceId: string): Promise<ActionResult> {
  let _uid: string
  try { _uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      orderId = inv.orderId
      if (inv.status === 'paid') throw new Error('INVALID')
      tx.update(ref, { status: 'cancelled', updatedAt: Date.now() })
    })
  } catch (e) { return fail(e) }
  revalidateInvoice(orderId)
  return { ok: true }
}
```

> The `makeDb` mock's `collection('r31_orders').doc('o1')` returns path `r31_orders/o1` and `dataFor` routes it to `state.order`, so mirror-writes update the order object in tests.

- [ ] **Step 4: Run test + typecheck**

Run: `npm test -- src/app/admin/invoices/actions.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/invoices/actions.ts src/app/admin/invoices/actions.test.ts
git commit -m "feat: add invoice update/issue/pay/verify/cancel actions"
```

---

## Task 11: completeCollectionAction (order -> completed + signature)

**Files:**
- Modify: `src/app/admin/orders/actions.ts`
- Modify: `src/app/admin/orders/actions.test.ts`

**Interfaces:**
- Consumes: existing `applyStatus` helpers / `getAdminDb` / `verifyOwner` / `buildStatusNotification`.
- Produces: `completeCollectionAction(idToken, orderId, signatureURL): Promise<ActionResult>`.

- [ ] **Step 1: Write the failing test**

Append to `src/app/admin/orders/actions.test.ts`:

```typescript
describe('completeCollectionAction', () => {
  it('rejects when the order is not ready', async () => {
    Object.assign(order, { status: 'in_repair' })
    const { completeCollectionAction } = await import('./actions')
    expect(await completeCollectionAction('owner', 'o1', 'https://x/sig.png')).toMatchObject({ ok: false, error: 'INVALID' })
  })
  it('from ready: stores signature, flips to completed, appends event + notifies', async () => {
    Object.assign(order, { status: 'ready' })
    const { completeCollectionAction } = await import('./actions')
    const r = await completeCollectionAction('owner', 'o1', 'https://x/sig.png')
    expect(r).toEqual({ ok: true })
    expect(order.status).toBe('completed')
    expect(order.signatureURL).toBe('https://x/sig.png')
    expect(order.completedAt).toBeTypeOf('number')
    expect(getEvents()[0]).toMatchObject({ type: 'status_change', fromStatus: 'ready', toStatus: 'completed' })
    expect(getNotifs().some((n) => n.type === 'status_change')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/admin/orders/actions.test.ts`
Expected: FAIL (function not exported).

- [ ] **Step 3: Add `completeCollectionAction` to `src/app/admin/orders/actions.ts`**

```typescript
export async function completeCollectionAction(
  idToken: string,
  orderId: string,
  signatureURL: string,
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyOwner(idToken)).uid } catch (e) { return fail(e) }
  if (!signatureURL) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const ref = db.collection('r31_orders').doc(orderId)
  const eventRef = ref.collection('events').doc()
  const notifRef = db.collection('r31_notifications').doc()
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const order = snap.data()!
      if (order.status !== 'ready') throw new Error('INVALID')
      const now = Date.now()
      tx.update(ref, { status: 'completed', signatureURL, signedAt: now, completedAt: now, updatedAt: now })
      tx.set(eventRef, {
        type: 'status_change', fromStatus: 'ready', toStatus: 'completed',
        note: 'Collected & signed', visibility: 'customer', byUserId: uid, byRole: 'owner', at: now,
      })
      tx.set(notifRef, buildStatusNotification({
        userId: order.customerId as string, orderId,
        orderNumber: order.orderNumber as string, toStatus: 'completed', now,
      }))
    })
  } catch (e) { return fail(e) }
  revalidateOrder(orderId)
  return { ok: true }
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npm test -- src/app/admin/orders/actions.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/orders/actions.ts src/app/admin/orders/actions.test.ts
git commit -m "feat: add completeCollectionAction (signature -> completed)"
```

---

## Task 12: submitProofOfPaymentAction (customer)

**Files:**
- Modify: `src/app/(customer)/orders/actions.ts`
- Test: `src/app/(customer)/orders/actions.test.ts` (exists)

**Interfaces:**
- Consumes: `verifyUser`/`getAdminDb`, `proofSchema`.
- Produces: `submitProofOfPaymentAction(idToken, invoiceId, paymentMethod, proofURL): Promise<ActionResult>`.

- [ ] **Step 1: Write the failing test**

Append to `src/app/(customer)/orders/actions.test.ts` (follow the file's existing mock style; route invoice/order docs like Task 9's `makeDb` if not already present):

```typescript
describe('submitProofOfPaymentAction', () => {
  it('rejects when the caller is not the invoice customer', async () => {
    // verifyUser returns uid 'other'; invoice.customerId = 'c1'
    const { submitProofOfPaymentAction } = await import('./actions')
    const r = await submitProofOfPaymentAction('other', 'inv1', 'orange_money', 'https://x/p.png')
    expect(r).toMatchObject({ ok: false, error: 'FORBIDDEN' })
  })
  it('from issued: records method+proof, flips to payment_submitted, mirrors order', async () => {
    const { submitProofOfPaymentAction } = await import('./actions')
    const r = await submitProofOfPaymentAction('c1', 'inv1', 'orange_money', 'https://x/p.png')
    expect(r.ok).toBe(true)
    // assertions against the test's invoice/order state objects
  })
  it('rejects a cash method', async () => {
    const { submitProofOfPaymentAction } = await import('./actions')
    expect(await submitProofOfPaymentAction('c1', 'inv1', 'cash' as never, 'https://x/p.png')).toMatchObject({ ok: false, error: 'INVALID' })
  })
})
```

> If the existing customer-actions test file lacks a Firestore mock (the current `createOrderAction` uses catalog queries), add the same two-doc `makeDb` mock from Task 9 (invoice id `inv1`, order routed by `orderId`) at the top of this describe block, plus `vi.mock('@/lib/firebase/admin', ...)` exposing `verifyUser` that returns `{ uid }` from the token.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "src/app/(customer)/orders/actions.test.ts"`
Expected: FAIL (function not exported).

- [ ] **Step 3: Add the action to `src/app/(customer)/orders/actions.ts`**

```typescript
import { proofSchema } from '@/lib/invoices/validation'

export async function submitProofOfPaymentAction(
  idToken: string,
  invoiceId: string,
  paymentMethod: string,
  proofURL: string,
): Promise<ActionResult> {
  let uid: string
  try { uid = (await verifyUser(idToken)).uid } catch (e) { return fail(e) }
  const parsed = proofSchema.safeParse({ paymentMethod, proofURL })
  if (!parsed.success) return { ok: false, error: 'INVALID' }
  const db = getAdminDb()
  const ref = db.collection('r31_invoices').doc(invoiceId)
  let orderId = ''
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('INVALID')
      const inv = snap.data()!
      if (inv.customerId !== uid) throw new Error('FORBIDDEN')
      if (inv.status !== 'issued') throw new Error('INVALID')
      orderId = inv.orderId
      const now = Date.now()
      tx.update(ref, {
        status: 'payment_submitted', paymentMethod: parsed.data.paymentMethod,
        proofOfPaymentURL: parsed.data.proofURL, proofUploadedAt: now, updatedAt: now,
      })
      tx.update(db.collection('r31_orders').doc(inv.orderId), { paymentStatus: 'payment_submitted', updatedAt: now })
    })
  } catch (e) { return fail(e) }
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/account')
  revalidatePath('/admin/invoices')
  return { ok: true }
}
```

> Ensure `getAdminDb` and `revalidatePath` are imported in this file (add to existing imports if missing).

- [ ] **Step 4: Run test + typecheck**

Run: `npm test -- "src/app/(customer)/orders/actions.test.ts" && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(customer)/orders/actions.ts" "src/app/(customer)/orders/actions.test.ts"
git commit -m "feat: add customer submitProofOfPaymentAction"
```

---

## Task 13: Security rules (Firestore + Storage)

**Files:**
- Modify: `firestore.rules`
- Modify: `storage.rules`
- Test: `tests/rules/invoices.test.ts`

**Interfaces:**
- Produces: `r31_invoices` read = owner or own customer; all writes denied. Storage proof/signature scoped.

- [ ] **Step 1: Write the failing rules test** (mirror existing `tests/rules/` style)

```typescript
// tests/rules/invoices.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-r31',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'r31_invoices/inv1'), { customerId: 'c1', orderId: 'o1', status: 'issued' })
  })
})
afterAll(async () => { await env.cleanup() })

describe('r31_invoices rules', () => {
  it('lets the owning customer read their invoice', async () => {
    const ctx = env.authenticatedContext('c1')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_invoices/inv1')))
  })
  it('denies another customer', async () => {
    const ctx = env.authenticatedContext('c2')
    await assertFails(getDoc(doc(ctx.firestore(), 'r31_invoices/inv1')))
  })
  it('lets an owner read', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'r31_invoices/inv1')))
  })
  it('denies all client writes (even owner)', async () => {
    const ctx = env.authenticatedContext('o1', { role: 'owner' })
    await assertFails(setDoc(doc(ctx.firestore(), 'r31_invoices/inv2'), { customerId: 'c1', orderId: 'o1', status: 'draft' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rules -- tests/rules/invoices.test.ts`
Expected: FAIL on the "denies all client writes" case (current rule allows `isOwner()` writes).

- [ ] **Step 3: Tighten `firestore.rules`**

Replace the existing `r31_invoices` block (lines ~31-34) with:

```
    match /r31_invoices/{id} {
      allow read: if isOwner() || (isSignedIn() && resource.data.customerId == request.auth.uid);
      allow write: if false; // all writes via Admin SDK server actions
    }
```

- [ ] **Step 4: Update `storage.rules`** (scope proof + signature)

```
    match /r31/proof-of-payment/{orderId}/{file=**} {
      allow read, write: if request.auth != null
        && (request.auth.token.role == 'owner'
            || request.auth.uid == firestore.get(/databases/(default)/documents/r31_orders/$(orderId)).data.customerId);
    }
    match /r31/signatures/{orderId}/{file=**} {
      allow read: if request.auth != null
        && (request.auth.token.role == 'owner'
            || request.auth.uid == firestore.get(/databases/(default)/documents/r31_orders/$(orderId)).data.customerId);
      allow write: if request.auth != null && request.auth.token.role == 'owner';
    }
```

- [ ] **Step 5: Run rules test to verify it passes**

Run: `npm run test:rules -- tests/rules/invoices.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules storage.rules tests/rules/invoices.test.ts
git commit -m "feat: tighten invoice firestore rules + scope storage paths"
```

---

## Task 14: PDF dependency + InvoicePdf + DownloadInvoiceButton

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/components/invoices/InvoicePdf.tsx`, `src/components/invoices/DownloadInvoiceButton.tsx`
- Test: `src/components/invoices/DownloadInvoiceButton.test.tsx`

**Interfaces:**
- Consumes: `Invoice` type, `formatPula`.
- Produces: `InvoicePdf({ invoice }: { invoice: Invoice })` (a react-pdf `<Document>`); `DownloadInvoiceButton({ invoice }: { invoice: Invoice })` (client component).

- [ ] **Step 1: Install a React-19-compatible react-pdf and verify it imports**

```bash
npm install @react-pdf/renderer@^4.3.0
```

Run: `npm run typecheck`
Expected: no errors. If install pulls a version that errors against React 19, try the latest 4.x (`npm install @react-pdf/renderer@latest`) and record the working version in the commit message. **Do not proceed to Step 3 until import is clean.**

- [ ] **Step 2: Write the failing component test**

```tsx
// src/components/invoices/DownloadInvoiceButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Invoice } from '@/lib/types/invoice'

// PDFDownloadLink renders children as a function; mock to render a plain anchor
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  View: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  StyleSheet: { create: (s: any) => s },
  PDFDownloadLink: ({ children }: any) => <a href="#">{typeof children === 'function' ? children({ loading: false }) : children}</a>,
}))

import { DownloadInvoiceButton } from './DownloadInvoiceButton'

const invoice = {
  id: 'inv1', invoiceNumber: 'INV-0007', total: 160000, currency: 'BWP',
  lineItems: [{ lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 160000 }],
  discount: null, subtotal: 160000, discountAmount: 0, status: 'issued',
  customerName: 'Thabo', customerPhone: '7', orderId: 'o1', customerId: 'c1',
  paymentMethod: null, proofOfPaymentURL: null, proofUploadedAt: null, verifiedBy: null,
  verifiedAt: null, issuedAt: 1, paidAt: null, createdAt: 1, updatedAt: 1, createdBy: 'o1',
} as Invoice

describe('DownloadInvoiceButton', () => {
  it('renders a download link labelled with the invoice number', () => {
    render(<DownloadInvoiceButton invoice={invoice} />)
    expect(screen.getByText(/INV-0007/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/components/invoices/DownloadInvoiceButton.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 4: Create `src/components/invoices/InvoicePdf.tsx`**

```tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Invoice } from '@/lib/types/invoice'
import { formatPula } from '@/lib/money'

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 11, color: '#111' },
  h1: { fontSize: 18, marginBottom: 4 },
  muted: { color: '#666' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  hr: { borderBottomWidth: 1, borderColor: '#ccc', marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, fontSize: 13 },
})

export function InvoicePdf({ invoice }: { invoice: Invoice }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>31 Repairs</Text>
        <Text style={s.muted}>Gaborone, Botswana</Text>
        <View style={s.hr} />
        <View style={s.row}><Text>Invoice</Text><Text>{invoice.invoiceNumber}</Text></View>
        <View style={s.row}><Text>Customer</Text><Text>{invoice.customerName} · {invoice.customerPhone}</Text></View>
        <View style={s.row}><Text>Status</Text><Text>{invoice.status}</Text></View>
        <View style={s.hr} />
        {invoice.lineItems.map((li) => (
          <View key={li.lineId} style={s.row}><Text>{li.description}</Text><Text>{formatPula(li.amount)}</Text></View>
        ))}
        <View style={s.hr} />
        <View style={s.row}><Text>Subtotal</Text><Text>{formatPula(invoice.subtotal)}</Text></View>
        {invoice.discountAmount > 0 && (
          <View style={s.row}><Text>Discount</Text><Text>-{formatPula(invoice.discountAmount)}</Text></View>
        )}
        <View style={s.totalRow}><Text>Total</Text><Text>{formatPula(invoice.total)}</Text></View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 5: Create `src/components/invoices/DownloadInvoiceButton.tsx`**

```tsx
'use client'
import { PDFDownloadLink } from '@react-pdf/renderer'
import type { Invoice } from '@/lib/types/invoice'
import { InvoicePdf } from './InvoicePdf'

export function DownloadInvoiceButton({ invoice }: { invoice: Invoice }) {
  return (
    <PDFDownloadLink
      document={<InvoicePdf invoice={invoice} />}
      fileName={`${invoice.invoiceNumber}.pdf`}
      style={{ color: 'var(--accent)', fontSize: 'var(--fs-sm)' }}
    >
      {({ loading }) => (loading ? 'Preparing…' : `Download ${invoice.invoiceNumber} (PDF)`)}
    </PDFDownloadLink>
  )
}
```

- [ ] **Step 6: Run test + typecheck**

Run: `npm test -- src/components/invoices/DownloadInvoiceButton.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/invoices/InvoicePdf.tsx src/components/invoices/DownloadInvoiceButton.tsx src/components/invoices/DownloadInvoiceButton.test.tsx
git commit -m "feat: add client-side invoice PDF + download button"
```

---

## Task 15: InvoiceEditor component

**Files:**
- Create: `src/components/invoices/InvoiceEditor.tsx`, `InvoiceEditor.module.css`
- Test: `src/components/invoices/InvoiceEditor.test.tsx`

**Interfaces:**
- Consumes: `InvoiceLineItem`, `Discount`, `computeTotals`, `formatPula`.
- Produces: `InvoiceEditor({ initialLineItems, initialDiscount, onSave })` where `onSave(input: { lineItems: InvoiceLineItem[]; discount: Discount | null }) => Promise<void>`. Pula entered by the user is converted to thebe via `toThebe` on input.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/invoices/InvoiceEditor.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvoiceEditor } from './InvoiceEditor'
import type { InvoiceLineItem } from '@/lib/types/invoice'

const lines: InvoiceLineItem[] = [
  { lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 },
]

describe('InvoiceEditor', () => {
  it('shows a live total and saves the edited line items', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<InvoiceEditor initialLineItems={lines} initialDiscount={null} onSave={onSave} />)
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('P1,200')

    await userEvent.click(screen.getByRole('button', { name: /add line/i }))
    const descs = screen.getAllByLabelText(/description/i)
    await userEvent.type(descs[descs.length - 1], 'Adhesive seal')
    const amounts = screen.getAllByLabelText(/amount/i)
    await userEvent.clear(amounts[amounts.length - 1])
    await userEvent.type(amounts[amounts.length - 1], '80')
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('P1,280')

    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith({
      lineItems: [
        { lineId: 'a', description: 'Screen', sourceItemId: 'i1', amount: 120000 },
        expect.objectContaining({ description: 'Adhesive seal', sourceItemId: null, amount: 8000 }),
      ],
      discount: null,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/invoices/InvoiceEditor.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/components/invoices/InvoiceEditor.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { InvoiceLineItem, Discount } from '@/lib/types/invoice'
import { computeTotals } from '@/lib/invoices/totals'
import { formatPula, toThebe, fromThebe } from '@/lib/money'
import styles from './InvoiceEditor.module.css'

interface Props {
  initialLineItems: InvoiceLineItem[]
  initialDiscount: Discount | null
  onSave: (input: { lineItems: InvoiceLineItem[]; discount: Discount | null }) => Promise<void>
}

export function InvoiceEditor({ initialLineItems, initialDiscount, onSave }: Props) {
  const [lines, setLines] = useState<InvoiceLineItem[]>(initialLineItems)
  const [discount, setDiscount] = useState<Discount | null>(initialDiscount)
  const [busy, setBusy] = useState(false)
  const totals = computeTotals(lines, discount)

  function setLine(idx: number, patch: Partial<InvoiceLineItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, { lineId: `new-${prev.length}-${Date.now()}`, description: '', sourceItemId: null, amount: 0 }])
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className={styles.root}>
      {lines.map((l, i) => (
        <div key={l.lineId} className={styles.row}>
          <input aria-label={`Description ${i + 1}`} value={l.description}
            onChange={(e) => setLine(i, { description: e.target.value })} />
          <input aria-label={`Amount ${i + 1}`} type="number" min="0" step="0.01"
            value={l.amount === 0 ? '' : fromThebe(l.amount)}
            onChange={(e) => setLine(i, { amount: toThebe(Number(e.target.value) || 0) })} />
          <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => removeLine(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={addLine}>+ Add line</button>

      <div className={styles.discountRow}>
        <select aria-label="Discount type"
          value={discount?.type ?? 'none'}
          onChange={(e) => {
            const v = e.target.value
            setDiscount(v === 'none' ? null : { type: v as 'amount' | 'percent', value: 0 })
          }}>
          <option value="none">No discount</option>
          <option value="amount">Amount (P)</option>
          <option value="percent">Percent (%)</option>
        </select>
        {discount && (
          <input aria-label="Discount value" type="number" min="0"
            value={discount.value === 0 ? '' : (discount.type === 'amount' ? fromThebe(discount.value) : discount.value)}
            onChange={(e) => {
              const n = Number(e.target.value) || 0
              setDiscount({ type: discount.type, value: discount.type === 'amount' ? toThebe(n) : n })
            }} />
        )}
      </div>

      <p className={styles.totalLine}>
        Subtotal {formatPula(totals.subtotal)}
        {totals.discountAmount > 0 && ` · −${formatPula(totals.discountAmount)}`}
      </p>
      <p className={styles.total} data-testid="invoice-total">Total {formatPula(totals.total)}</p>

      <button type="button" disabled={busy}
        onClick={async () => { setBusy(true); try { await onSave({ lineItems: lines, discount }) } finally { setBusy(false) } }}>
        {busy ? 'Saving…' : 'Save invoice'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/invoices/InvoiceEditor.module.css`**

```css
.root { display: flex; flex-direction: column; gap: var(--space-3); }
.row { display: grid; grid-template-columns: 1fr 120px 44px; gap: var(--space-2); }
.row input, .discountRow input, .discountRow select { min-height: 44px; padding: 0 var(--space-2); background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.discountRow { display: flex; gap: var(--space-2); }
.totalLine { color: var(--text-muted); font-size: var(--fs-sm); }
.total { color: var(--text-strong); font-weight: 600; }
```

- [ ] **Step 5: Run test + typecheck**

Run: `npm test -- src/components/invoices/InvoiceEditor.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/invoices/InvoiceEditor.tsx src/components/invoices/InvoiceEditor.module.css src/components/invoices/InvoiceEditor.test.tsx
git commit -m "feat: add InvoiceEditor with live totals"
```

---

## Task 16: SignaturePad component

**Files:**
- Create: `src/components/orders/SignaturePad.tsx`, `SignaturePad.module.css`
- Test: `src/components/orders/SignaturePad.test.tsx`

**Interfaces:**
- Produces: `SignaturePad({ onConfirm }: { onConfirm: (pngDataUrl: string) => Promise<void> })`. Captures pointer strokes on a `<canvas>`; "Clear" resets; "Confirm" calls `onConfirm(canvas.toDataURL('image/png'))`. Disabled until at least one stroke.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/orders/SignaturePad.test.tsx
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignaturePad } from './SignaturePad'

beforeAll(() => {
  // jsdom canvas: stub getContext + toDataURL
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    clearRect: vi.fn(), lineWidth: 0, lineCap: '', strokeStyle: '',
  })) as never
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,AAAA')
})

describe('SignaturePad', () => {
  it('confirm is disabled until a stroke, then calls onConfirm with the PNG', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<SignaturePad onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: /confirm/i })
    expect(confirm).toBeDisabled()

    const canvas = screen.getByLabelText(/signature/i)
    await userEvent.pointer([{ target: canvas, keys: '[MouseLeft>]', coords: { x: 5, y: 5 } }, { coords: { x: 20, y: 20 } }, { keys: '[/MouseLeft]' }])
    expect(confirm).toBeEnabled()

    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('data:image/png;base64,AAAA')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/orders/SignaturePad.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/components/orders/SignaturePad.tsx`**

```tsx
'use client'
import { useRef, useState } from 'react'
import styles from './SignaturePad.module.css'

export function SignaturePad({ onConfirm }: { onConfirm: (pngDataUrl: string) => Promise<void> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)
  const [busy, setBusy] = useState(false)

  function ctx() {
    const c = canvasRef.current!
    const g = c.getContext('2d')!
    g.lineWidth = 2; g.lineCap = 'round'; g.strokeStyle = '#111'
    return g
  }
  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function down(e: React.PointerEvent) {
    drawing.current = true
    const g = ctx(); const p = pos(e); g.beginPath(); g.moveTo(p.x, p.y)
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return
    const g = ctx(); const p = pos(e); g.lineTo(p.x, p.y); g.stroke(); setHasInk(true)
  }
  function up() { drawing.current = false }
  function clear() {
    const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHasInk(false)
  }

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} width={320} height={160} aria-label="Signature pad"
        className={styles.canvas}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div className={styles.actions}>
        <button type="button" onClick={clear}>Clear</button>
        <button type="button" disabled={!hasInk || busy}
          onClick={async () => {
            setBusy(true)
            try { await onConfirm(canvasRef.current!.toDataURL('image/png')) } finally { setBusy(false) }
          }}>
          {busy ? 'Saving…' : 'Confirm signature'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/orders/SignaturePad.module.css`**

```css
.root { display: flex; flex-direction: column; gap: var(--space-3); }
.canvas { background: #fff; border: 1px solid var(--border); border-radius: var(--radius-sm); touch-action: none; width: 100%; max-width: 320px; }
.actions { display: flex; gap: var(--space-2); }
.actions button { min-height: 44px; padding: 0 var(--space-3); }
```

- [ ] **Step 5: Run test + typecheck**

Run: `npm test -- src/components/orders/SignaturePad.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/orders/SignaturePad.tsx src/components/orders/SignaturePad.module.css src/components/orders/SignaturePad.test.tsx
git commit -m "feat: add SignaturePad canvas component"
```

---

## Task 17: ProofUploader component

**Files:**
- Create: `src/components/invoices/ProofUploader.tsx`
- Test: `src/components/invoices/ProofUploader.test.tsx`

**Interfaces:**
- Consumes: Firebase Storage client SDK (`ref`/`uploadBytes`/`getDownloadURL`), `auth`, `submitProofOfPaymentAction`, `PAYMENT_CHANNELS`.
- Produces: `ProofUploader({ orderId, invoiceId, onDone }: { orderId: string; invoiceId: string; onDone: () => void })`. User picks a channel, sees its pay-to details, uploads a screenshot → Storage `r31/proof-of-payment/{orderId}/{filename}` → calls `submitProofOfPaymentAction`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/invoices/ProofUploader.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const submit = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/(customer)/orders/actions', () => ({ submitProofOfPaymentAction: (...a: unknown[]) => submit(...a) }))
vi.mock('firebase/storage', () => ({
  ref: () => ({}), uploadBytes: async () => ({ ref: {} }), getDownloadURL: async () => 'https://x/p.png',
}))
vi.mock('@/lib/firebase/client', () => ({ auth: { currentUser: { getIdToken: async () => 'tok' } }, storage: {} }))

import { ProofUploader } from './ProofUploader'

describe('ProofUploader', () => {
  it('shows channel details and submits proof with the chosen method', async () => {
    const onDone = vi.fn()
    render(<ProofUploader orderId="o1" invoiceId="inv1" onDone={onDone} />)
    await userEvent.selectOptions(screen.getByLabelText(/payment method/i), 'orange_money')
    expect(screen.getByText(/merchant/i)).toBeInTheDocument()

    const file = new File(['x'], 'proof.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText(/upload proof/i), file)

    expect(submit).toHaveBeenCalledWith('tok', 'inv1', 'orange_money', 'https://x/p.png')
    expect(onDone).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/invoices/ProofUploader.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/components/invoices/ProofUploader.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/client'
import { submitProofOfPaymentAction } from '@/app/(customer)/orders/actions'
import { PAYMENT_CHANNELS, type PaymentMethod } from '@/lib/invoices/paymentMethods'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX = 5_000_000

export function ProofUploader({ orderId, invoiceId, onDone }: { orderId: string; invoiceId: string; onDone: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const channel = PAYMENT_CHANNELS.find((c) => c.id === method)!

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED.includes(file.type)) { setErr('Use a JPEG, PNG, or WebP image'); return }
    if (file.size > MAX) { setErr('Image must be under 5 MB'); return }
    setBusy(true); setErr('')
    try {
      const path = `r31/proof-of-payment/${orderId}/${Date.now()}-${file.name}`
      const snap = await uploadBytes(ref(storage, path), file)
      const url = await getDownloadURL(snap.ref)
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('not signed in')
      const res = await submitProofOfPaymentAction(idToken, invoiceId, method, url)
      if (!res.ok) throw new Error('save failed')
      onDone()
    } catch { setErr('Upload failed — please try again') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <label>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Payment method</span>
        <select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} style={{ minHeight: 44 }}>
          {PAYMENT_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{channel.payToLabel}: {channel.details}</p>
      <input aria-label="Upload proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={busy} style={{ minHeight: 44 }} />
      {busy && <span role="status">Uploading…</span>}
      {err && <span role="alert" style={{ color: 'var(--danger)' }}>{err}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npm test -- src/components/invoices/ProofUploader.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/invoices/ProofUploader.tsx src/components/invoices/ProofUploader.test.tsx
git commit -m "feat: add customer ProofUploader"
```

---

## Task 18: Status pills — PaymentBadge + InvoiceStatusPill

**Files:**
- Create: `src/components/invoices/PaymentBadge.tsx`, `src/components/invoices/InvoiceStatusPill.tsx`
- Test: `src/components/invoices/PaymentBadge.test.tsx`

**Interfaces:**
- Produces: `PaymentBadge({ status }: { status: Order['paymentStatus'] })`; `InvoiceStatusPill({ status }: { status: InvoiceStatus })`. Pure label+token lookup (mirror existing `StatusPill`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/invoices/PaymentBadge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaymentBadge } from './PaymentBadge'

describe('PaymentBadge', () => {
  it('renders a human label per payment status', () => {
    render(<PaymentBadge status="payment_submitted" />)
    expect(screen.getByText(/awaiting verification/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/invoices/PaymentBadge.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Create both components**

`src/components/invoices/PaymentBadge.tsx`:

```tsx
import type { Order } from '@/lib/types/order'

const META: Record<Order['paymentStatus'], { label: string; token: string }> = {
  unpaid: { label: 'Unpaid', token: '--text-muted' },
  payment_submitted: { label: 'Awaiting verification', token: '--warning' },
  paid: { label: 'Paid', token: '--success' },
}

export function PaymentBadge({ status }: { status: Order['paymentStatus'] }) {
  const m = META[status]
  return <span style={{ color: `var(${m.token})`, fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{m.label}</span>
}
```

`src/components/invoices/InvoiceStatusPill.tsx`:

```tsx
import type { InvoiceStatus } from '@/lib/types/invoice'

const META: Record<InvoiceStatus, { label: string; token: string }> = {
  draft: { label: 'Draft', token: '--text-muted' },
  issued: { label: 'Issued', token: '--status-blue' },
  payment_submitted: { label: 'Payment submitted', token: '--warning' },
  paid: { label: 'Paid', token: '--success' },
  cancelled: { label: 'Cancelled', token: '--danger' },
}

export function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  const m = META[status]
  return <span style={{ color: `var(${m.token})`, fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{m.label}</span>
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npm test -- src/components/invoices/PaymentBadge.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/invoices/PaymentBadge.tsx src/components/invoices/InvoiceStatusPill.tsx src/components/invoices/PaymentBadge.test.tsx
git commit -m "feat: add payment + invoice status pills"
```

---

## Task 19: Wire the admin invoice panel into OrderManager

**Files:**
- Modify: `src/app/admin/orders/[id]/OrderManager.tsx`
- Modify: `src/app/admin/orders/[id]/OrderManagerLoader.tsx` (also load the invoice doc)

**Interfaces:**
- Consumes: all admin invoice actions, `completeCollectionAction`, `InvoiceEditor`, `DownloadInvoiceButton`, `InvoiceStatusPill`, `PaymentBadge`, `SignaturePad`, `toInvoice`.

> This is a wiring task — manual verification via the running app, no new unit test (the actions/components are already tested). Keep changes additive; do not alter existing status/notes UI.

- [ ] **Step 1: Load the invoice alongside the order in `OrderManagerLoader.tsx`**

After the events fetch, add:

```tsx
import { toInvoice } from '@/lib/invoices/mappers'
import type { Invoice } from '@/lib/types/invoice'
// ...add state: const [invoice, setInvoice] = useState<Invoice | null>(null)
// inside fetchData, after setOrder(orderData):
if (orderData.invoiceId) {
  const invSnap = await getDoc(doc(db, 'r31_invoices', orderData.invoiceId))
  setInvoice(invSnap.exists() ? toInvoice(invSnap.id, invSnap.data()) : null)
} else {
  setInvoice(null)
}
// pass invoice + onChanged to OrderManager
return <OrderManager order={order} events={events} invoice={invoice} onChanged={fetchData} />
```

- [ ] **Step 2: Add the invoice panel + collection flow to `OrderManager.tsx`**

Add an `invoice?: Invoice | null` prop, import the actions/components, and render a panel:

```tsx
// helper to get a fresh owner token
async function token() {
  const t = await auth.currentUser?.getIdToken()
  if (!t) throw new Error('not signed in')
  return t
}
```

Panel behaviour (render below the existing manager content):
- **No invoice** → button calling `createInvoiceAction(await token(), order.id)` then `onChanged()`.
- **Draft invoice** → `<InvoiceEditor initialLineItems={invoice.lineItems} initialDiscount={invoice.discount} onSave={async (input) => { await updateInvoiceAction(await token(), invoice.id, input); await onChanged() }} />` + an **Issue** button calling `issueInvoiceAction`.
- **Issued/payment_submitted/paid** → `<InvoiceStatusPill>`, `<DownloadInvoiceButton invoice={invoice} />`, and:
  - if `issued` → **Mark paid (cash)** (`markPaidCashAction`).
  - if `payment_submitted` → show `<a href={invoice.proofOfPaymentURL}>View proof</a>` + **Approve** / **Reject** (`verifyPaymentAction(token, invoice.id, true|false)`).
- **Complete collection** (only when `order.status === 'ready'`): a button that opens a modal containing `<SignaturePad onConfirm={async (png) => { const url = await uploadSignature(order.id, png); await completeCollectionAction(await token(), order.id, url); await onChanged() }} />`. If `order.paymentStatus !== 'paid'`, show an "Invoice unpaid ⚠ — complete anyway?" notice above the pad.

Add an `uploadSignature` helper (owner uploads via Storage client SDK):

```tsx
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase/client'

async function uploadSignature(orderId: string, pngDataUrl: string): Promise<string> {
  const r = ref(storage, `r31/signatures/${orderId}/${Date.now()}.png`)
  const snap = await uploadString(r, pngDataUrl, 'data_url')
  return getDownloadURL(snap.ref)
}
```

- [ ] **Step 3: Typecheck + run existing OrderManager tests**

Run: `npm run typecheck && npm test -- src/app/admin/orders/[id]/OrderManager.test.tsx`
Expected: PASS (existing tests still green; new code is additive).

- [ ] **Step 4: Manual verification (running app)**

Run `npm run dev`, sign in as owner, open a `ready` order:
1. Create invoice → edit a line + add a line + discount → total updates → Save → Issue.
2. Download PDF opens a valid `INV-####.pdf`.
3. Mark paid (cash) → payment badge shows Paid.
4. Complete collection → signature pad → confirm → order shows **Completed**; customer bell gets a notification.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/orders/[id]/OrderManager.tsx src/app/admin/orders/[id]/OrderManagerLoader.tsx
git commit -m "feat: wire invoice panel + collection signature into OrderManager"
```

---

## Task 20: /admin/invoices verification queue

**Files:**
- Create: `src/app/admin/invoices/page.tsx`, `InvoiceQueue.tsx`, `InvoiceQueue.module.css`

**Interfaces:**
- Consumes: Firebase client SDK reads of `r31_invoices`, `InvoiceStatusPill`, `formatPula`. Guarded by `RequireOwner` (existing pattern in `/admin` layout).

- [ ] **Step 1: Create `InvoiceQueue.tsx`** (client read, JS-sorted, filter)

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { toInvoice } from '@/lib/invoices/mappers'
import type { Invoice, InvoiceStatus } from '@/lib/types/invoice'
import { InvoiceStatusPill } from '@/components/invoices/InvoiceStatusPill'
import { formatPula } from '@/lib/money'
import styles from './InvoiceQueue.module.css'

const FILTERS: (InvoiceStatus | 'all')[] = ['all', 'payment_submitted', 'issued', 'paid', 'draft', 'cancelled']

export function InvoiceQueue() {
  const [items, setItems] = useState<Invoice[]>([])
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('payment_submitted')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const snap = await getDocs(collection(db, 'r31_invoices'))
      setItems(snap.docs.map((d) => toInvoice(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt))
      setLoading(false)
    })()
  }, [])

  const shown = filter === 'all' ? items : items.filter((i) => i.status === filter)

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading invoices…</p>

  return (
    <div className={styles.root}>
      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={filter === f ? styles.active : ''} onClick={() => setFilter(f)}>{f.replace('_', ' ')}</button>
        ))}
      </div>
      <ul className={styles.list}>
        {shown.length === 0 ? <li className={styles.empty}>No invoices.</li> : shown.map((inv) => (
          <li key={inv.id} className={inv.status === 'payment_submitted' ? styles.flag : ''}>
            <Link href={`/admin/orders/${inv.orderId}`}>
              <span>{inv.invoiceNumber}</span>
              <span>{inv.customerName}</span>
              <span>{formatPula(inv.total)}</span>
              <InvoiceStatusPill status={inv.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/admin/invoices/page.tsx`**

```tsx
import { InvoiceQueue } from './InvoiceQueue'

export default function AdminInvoicesPage() {
  return (
    <section style={{ marginTop: 'var(--space-5)' }}>
      <h1 style={{ color: 'var(--text-strong)' }}>Invoices</h1>
      <InvoiceQueue />
    </section>
  )
}
```

- [ ] **Step 3: Create `src/app/admin/invoices/InvoiceQueue.module.css`**

```css
.root { display: flex; flex-direction: column; gap: var(--space-4); margin-top: var(--space-4); }
.filters { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.filters button { min-height: 40px; padding: 0 var(--space-3); background: var(--surface); color: var(--text-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); text-transform: capitalize; }
.filters .active { color: var(--text-strong); border-color: var(--accent); }
.list { display: flex; flex-direction: column; gap: var(--space-2); list-style: none; padding: 0; }
.list a { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: var(--space-3); align-items: center; padding: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text); }
.flag a { border-color: var(--warning); }
.empty { color: var(--text-muted); }
```

- [ ] **Step 4: Add a nav link** to `src/components/layout/AdminSidebar.tsx` (Invoices → `/admin/invoices`), matching existing link markup.

- [ ] **Step 5: Typecheck + manual check**

Run: `npm run typecheck`
Then `npm run dev`: `/admin/invoices` lists invoices, defaults to the `payment_submitted` filter, rows link to the order.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/invoices/page.tsx src/app/admin/invoices/InvoiceQueue.tsx src/app/admin/invoices/InvoiceQueue.module.css src/components/layout/AdminSidebar.tsx
git commit -m "feat: add /admin/invoices verification queue"
```

---

## Task 21: Customer invoice card + /account invoices

**Files:**
- Modify: `src/app/(customer)/orders/[id]/OrderDetail.tsx`
- Modify: `src/app/(customer)/account/page.tsx`

**Interfaces:**
- Consumes: client read of the order's invoice, `DownloadInvoiceButton`, `PaymentBadge`, `InvoiceStatusPill`, `ProofUploader`, `toInvoice`, `isElectronic`.

> Wiring task — manual verification (the underlying pieces are unit-tested).

- [ ] **Step 1: Add an invoice card to `OrderDetail.tsx`**

Load the invoice client-side when `order.invoiceId` is set (same `getDoc` + `toInvoice` pattern as Task 19), then render:
- Line items + `formatPula` totals, `<InvoiceStatusPill status={invoice.status} />`, `<PaymentBadge status={order.paymentStatus} />`, `<DownloadInvoiceButton invoice={invoice} />`.
- When `invoice.status === 'issued'` and unpaid: a **cash** note ("Pay at the shop") **and** `<ProofUploader orderId={order.id} invoiceId={invoice.id} onDone={refetch} />` for electronic channels.
- When `payment_submitted`: "Proof received — awaiting verification."

- [ ] **Step 2: Add an invoices section to `account/page.tsx`**

Query `r31_invoices` where `customerId == uid` (client SDK, JS-sorted), list `invoiceNumber` + `formatPula(total)` + `<InvoiceStatusPill>` linking to `/orders/{orderId}`.

- [ ] **Step 3: Typecheck + manual verification**

Run: `npm run typecheck`
Then as a customer: open an order with an issued invoice → download PDF; pick Orange Money → see merchant details → upload a screenshot → status becomes "awaiting verification"; `/account` lists the invoice.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(customer)/orders/[id]/OrderDetail.tsx" "src/app/(customer)/account/page.tsx"
git commit -m "feat: customer invoice card + proof upload + account invoices list"
```

---

## Task 22: Full-suite verification + PR

- [ ] **Step 1: Run everything**

Run: `npm test && npm run test:rules && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: production build succeeds (catches any react-pdf SSR/client boundary issues).

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin phase-2-invoicing
```
Open the PR to `main` manually in the browser (gh CLI not installed). Title: "Phase 2 — Invoicing, payments & e-signature". Body: summary + the manual-verification checklist from Tasks 19/21.

- [ ] **Step 4: Post-merge smoke (on Vercel)**

After merge, verify on the live URL: create→edit→issue invoice, download PDF, customer proof upload, owner verify, complete collection→Completed + bell notification.

---

## Self-Review

**Spec coverage:**
- §1 scope (invoice gen, full editor, PDF, methods, proof+verify, e-sign→completed, queue, notifications) → Tasks 1–22. ✓
- §2 data model (invoice doc, order changes, numbering, payment config) → Tasks 1–4. ✓
- §3 actions (create/update/issue/markPaidCash/verify/cancel/completeCollection/submitProof) → Tasks 9–12. ✓
- §4 totals → Task 5. ✓
- §5 UI (admin panel, /admin/invoices, customer card, /account) → Tasks 19–21. ✓
- §6 components & lib → Tasks 2–8, 14–18. ✓
- §7 security (firestore + storage) → Task 13. ✓
- §8 testing → embedded per task + Task 22. ✓

**Placeholder scan:** The only literal placeholders are the `PAYMENT_CHANNELS` account/merchant strings — flagged explicitly as owner-supplied content (not logic). No "TBD"/"implement later" steps. ✓

**Type consistency:** `PaymentMethod` (Task 3) used by `Invoice` (Task 2) and `proofSchema` (Task 7); `InvoiceLineItem`/`Discount` consistent across totals/mappers/editor; action names match between actions (Tasks 9–12) and wiring (Tasks 19–21); `computeTotals` signature stable. ✓

**Risk note:** `@react-pdf/renderer` on React 19 — Task 14 Step 1 verifies import before any UI depends on it; if the pinned `^4.3.0` fails, fall back to latest 4.x and record the version.
