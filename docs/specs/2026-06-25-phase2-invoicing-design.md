# Phase 2 — Invoicing, Payments & E-signature (design)

**Status:** Approved for build (brainstormed 2026-06-25)
**Branch:** `phase-2-invoicing` (off `main` @ live HEAD — all of 1a/1b/1c is merged and verified live). PR to merge back to `main`.
**Predecessor:** Phase 1c (in-app notifications) on top of 1b (orders).
**Parent roadmap:** PRD §6.5/§6.6/§7.4 (re-cut so warranty auto-issuance + revenue move to Phase 3/4).
Source docs: `docs/31Repairs-PRD.md` (§6.5 invoice/payment/proof, §6.6 e-signature, §7.4 invoicing, §9 data model), `docs/specs/2026-06-24-phase1c-notifications-design.md` (action + fan-out conventions).

---

## 1. Scope

When a device has been inspected, the shop raises an **invoice** from the order's line items, adjusts it (edit prices, add ad-hoc lines, apply a discount), and **issues** it. The customer can **download a PDF** and, for electronic payments, **upload proof of payment**, which an owner **verifies**; cash is **marked paid** directly by an owner. At collection an owner captures the customer's **e-signature**, which transitions the order to **Completed**.

**In scope:**
- New `r31_invoices` collection (1:1 with an order), Admin-SDK-written.
- Full invoice **line-item editor**: edit line prices, add/remove ad-hoc lines, order-level **discount** (fixed amount or percent).
- **Client-side PDF** download (`@react-pdf/renderer`) — same component for admin and customer.
- **Payment methods:** `cash`, `bank_transfer`, `orange_money`, `myzaka`, `pay2cell`. Cash → owner marks paid. All electronic → customer uploads proof → owner verifies.
- **Distinct pay-to details per electronic channel**, shown to the customer (config constant now; admin-editable in Phase 5).
- Payment-status lifecycle (authoritative on the invoice, mirrored to the order).
- **E-signature at collection** (owner-initiated; customer signs; PNG → Storage) → order **`completed`** (new status). Payment is **independent but warned** (owner may complete an unpaid order, with a UI warning).
- `/admin/invoices` standalone queue (cross-order payment-verification view).
- Invoice-issued + payment-verified **notifications** (extend the 1c inline fan-out). The `completed` status change reuses the existing status-notification path.
- Security rules (`r31_invoices` + tightened Storage paths) and tests throughout.

**Explicitly out of scope (deferred):**
- **Warranty** auto-issuance and warranty views/claims → **Phase 3**.
- **Revenue dashboard** + PDF export → **Phase 4**.
- **Admin-editable settings** (shop info, bank/mobile-money details, warranty period) → **Phase 5**. Phase 2 uses a code/env config constant.
- Owner-side notifications (owners use the `/admin/invoices` queue) and Cloud Functions (writes stay in transactional server actions) — consistent with 1c.
- Server-side PDF / a PDF download endpoint — rendering is client-side.

---

## 2. Data model

### 2.1 New collection `r31_invoices/{invoiceId}`
Written **only** by Admin-SDK server actions (clients never write directly).

- `invoiceNumber` — `INV-0007`, counter-generated (see §2.3).
- `orderId`, `customerId` — link + ownership.
- `customerName`, `customerPhone` — **snapshot** at creation, for the PDF.
- `lineItems[]` → `{ lineId, description, sourceItemId: string | null, amount }`
  - `amount` in **thebe** (integer). `sourceItemId` links to the originating `OrderItem.itemId`; `null` = ad-hoc line added on the invoice.
- `discount` → `{ type: 'amount' | 'percent', value } | null`
  - `amount` discount: `value` in thebe. `percent` discount: `value` is whole-number percent (0–100).
- `subtotal`, `discountAmount`, `total` — thebe, all **computed** (never client-supplied), see §4.
- `currency: 'BWP'`.
- `status: 'draft' | 'issued' | 'payment_submitted' | 'paid' | 'cancelled'`.
- `paymentMethod: 'cash' | 'bank_transfer' | 'orange_money' | 'myzaka' | 'pay2cell' | null`.
- `proofOfPaymentURL: string | null`, `proofUploadedAt: number | null`.
- `verifiedBy: string | null`, `verifiedAt: number | null`.
- `issuedAt: number | null`, `paidAt: number | null`.
- `createdAt`, `updatedAt`, `createdBy`.

TS: `Invoice`, `InvoiceLineItem`, `InvoiceStatus`, `Discount` in `src/lib/types/invoice.ts`.

### 2.2 Order changes (`src/lib/types/order.ts`)
- Add `completed` to `ORDER_STATUSES` and `statusMeta` (`label: 'Completed'`, deep-green `--success`, `hold: false`). Place after `ready`, before `cancelled`.
- Expand `paymentStatus: 'unpaid' | 'payment_submitted' | 'paid'` (mirrored from the invoice).
- Add `invoiceId: string | null`.
- Add `signatureURL?: string`, `signedAt?: number`, `completedAt?: number`.

**Mirroring rule:** the invoice is the source of truth for payment; every action that changes invoice payment state updates `order.paymentStatus` in the **same transaction**, so order cards/queues display payment without a join.

### 2.3 Invoice numbering
`src/lib/invoices/invoiceNumber.ts`, mirroring `orderNumber.ts`:
- `formatInvoiceNumber(seq)` → `INV-${seq padded to 4}`.
- `nextInvoiceNumber(db)` → transactional increment of `r31_counters/invoices` (`{ seq }`).

### 2.4 Payment-method config
`src/lib/invoices/paymentMethods.ts`:
- `PaymentMethod` union + `PAYMENT_METHODS` const.
- `isElectronic(method)` → `false` only for `'cash'`.
- `PAYMENT_CHANNELS` — array of `{ id: PaymentMethod, label, payToLabel, details }` for the electronic channels (bank account/branch, Orange Money merchant/number, MyZaka number, Pay2Cell number). Sourced from env/config now; Phase 5 makes it admin-editable. Cash has no `details` block.

---

## 3. Server actions

All owner actions: `verifyOwner(idToken)` → Firestore **transaction** → append order `events` where relevant → inline notification fan-out → `revalidatePath`. They return `ActionResult` and wrap throws in `fail(e)` (existing convention). Totals are always recomputed server-side from `lineItems` + `discount`.

### 3.1 Admin — `src/app/admin/invoices/actions.ts`
- **`createInvoiceAction(idToken, orderId)`** — reads the order, snapshots its `items` → draft `lineItems` (`{ lineId, description: serviceName(+variant), sourceItemId: itemId, amount: finalAmount ?? quotedAmount }`), assigns `invoiceNumber`, computes totals, writes `status:'draft'`, sets `order.invoiceId`. Idempotent guard: refuse if `order.invoiceId` already set (unless that invoice is `cancelled`).
- **`updateInvoiceAction(idToken, invoiceId, { lineItems, discount })`** — allowed while `draft`; validates + recomputes totals; `updatedAt`.
- **`issueInvoiceAction(idToken, invoiceId)`** — `draft → issued`, set `issuedAt`; **notify customer** ("Invoice INV-0007 ready").
- **`markPaidCashAction(idToken, invoiceId)`** — `issued → paid`, `paymentMethod:'cash'`, `paidAt`; mirror `order.paymentStatus='paid'`; **notify**.
- **`verifyPaymentAction(idToken, invoiceId, approve: boolean)`** — from `payment_submitted`: approve → `paid` (`verifiedBy/At`, `paidAt`, mirror order) ; reject → back to `issued` (clear `proofOfPaymentURL`/`proofUploadedAt`, mirror `order.paymentStatus='unpaid'`); **notify** either way.
- **`cancelInvoiceAction(idToken, invoiceId)`** — any non-`paid` → `cancelled`; leaves `order.invoiceId` pointing at it (a new invoice may then be created per the §3.1 guard).

### 3.2 Order/collection — `src/app/admin/orders/actions.ts` (extend existing file)
- **`completeCollectionAction(idToken, orderId, signatureURL)`** — only when `order.status === 'ready'`; set `signatureURL`, `signedAt`, `completedAt`, `status:'completed'`; append a `status_change` event (`ready → completed`); **notify** via the existing `buildStatusNotification` (works now that `completed` exists in `statusMeta`). The PNG itself is uploaded client-side by the owner (Storage SDK) before the action; the action only attaches the URL + flips status. No payment precondition — the UI surfaces an "unpaid" warning but does not block.

### 3.3 Customer — `src/app/(customer)/orders/actions.ts` (extend existing file)
- **`submitProofOfPaymentAction(idToken, invoiceId, paymentMethod, proofURL)`** — verifies caller `uid === invoice.customerId` (Admin SDK read); requires `isElectronic(paymentMethod)` and invoice status `issued`; sets `paymentMethod`, `proofOfPaymentURL`, `proofUploadedAt`, `status:'payment_submitted'`; mirror `order.paymentStatus='payment_submitted'`. No owner notification (owners use the verification queue, per 1c).

---

## 4. Totals (pure, testable)

`src/lib/invoices/totals.ts` — pure functions over thebe integers:
- `subtotal(lineItems)` = Σ `amount`.
- `discountAmount(subtotal, discount)` — `amount`: `min(value, subtotal)`; `percent`: `round(subtotal * value / 100)`; `null`: 0.
- `computeTotals(lineItems, discount)` → `{ subtotal, discountAmount, total }`, `total = subtotal − discountAmount` (never < 0).
All rounding in thebe to avoid float drift; formatting via the existing `formatPula`.

---

## 5. UI surfaces

### 5.1 Admin
- **`/admin/orders/[id]` (OrderManager)** — new **Invoice panel**:
  - No invoice → **Create invoice**.
  - Draft → **`InvoiceEditor`** (line rows with editable price, add/remove ad-hoc line, discount selector, live totals) + **Issue**.
  - Issued → **Mark paid (cash)**, **Verify proof** (when `payment_submitted`: view screenshot → Approve/Reject), **Download PDF**.
  - **Complete collection & sign** button when `status==='ready'` → opens `SignaturePad` modal; shows an **"Invoice unpaid ⚠"** notice if the invoice isn't `paid`, with **Complete anyway / Cancel**.
- **`/admin/invoices`** — new page: all invoices (newest first, JS-sorted client-side per project convention), filter by status; `payment_submitted` highlighted as the verification queue; row → `/admin/orders/[id]`.

### 5.2 Customer
- **`/orders/[id]` (OrderDetail)** — invoice card: line items + totals, **payment-status badge**, **Download PDF**; when `issued` and unpaid: a method picker (cash = "pay at shop"; electronic = that channel's pay-to block from `PAYMENT_CHANNELS`) + **proof uploader**.
- **`/account`** — invoices list section (status + total + link).

---

## 6. Components & lib

- `InvoicePdf` — `@react-pdf/renderer` `<Document>` (shop header, customer + invoice meta, line table, discount, total, payment status). `DownloadInvoiceButton` wraps `PDFDownloadLink`; used by both admin and customer.
- `InvoiceEditor` (admin, client) — live totals; emits `{ lineItems, discount }` to `updateInvoiceAction`.
- `SignaturePad` (client) — canvas → PNG data URL; owner uploads to Storage then calls `completeCollectionAction`.
- `ProofUploader` (customer) — adapts the existing `ImageUploader` pattern; uploads to Storage then calls `submitProofOfPaymentAction`.
- `PaymentStatusBadge`, `InvoiceStatusPill` — design-system tokens, dual-theme.
- `src/lib/types/invoice.ts`; `src/lib/invoices/`: `invoiceNumber.ts`, `paymentMethods.ts`, `totals.ts`, `mappers.ts` (order→draft snapshot; Firestore (de)serialize), `validation.ts` (zod: create/update/discount/proof), `queries.ts` (client reads — `onSnapshot`/`get`, gated by rules, JS-sorted).
- `src/lib/notifications/buildNotification.ts` — add `buildInvoiceNotification` (issued) and `buildPaymentNotification` (verified/paid/rejected). `completed` reuses `buildStatusNotification`.

---

## 7. Security

### 7.1 Firestore (`firestore.rules`)
```
match /r31_invoices/{invoiceId} {
  allow read: if request.auth != null
    && (request.auth.token.role == 'owner'
        || request.auth.uid == resource.data.customerId);
  allow create, update, delete: if false;   // Admin-SDK actions only (incl. customer proof submit)
}
```
- **Read:** owner, or the invoice's customer.
- **All writes** go through Admin-SDK server actions (which bypass rules) — including the customer proof submit, so client writes are denied. Same write discipline as `r31_orders` / `r31_notifications`.

### 7.2 Storage (`storage.rules`) — tighten existing placeholders
Existing rules use `request.auth != null` (too loose). Scope to owner-or-order-customer via `firestore.get`:
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
  allow write: if request.auth.token.role == 'owner';   // owner captures the signature
}
```
Both proof and signature are keyed by **`orderId`** (matches the existing path shape).

---

## 8. Testing

- **Unit:** `totals.ts` (amount + percent discount, clamping, thebe rounding); `invoiceNumber` (format + transactional sequence, mirrors `orderNumber.test`); `paymentMethods` (`isElectronic`); `mappers` (order items → draft line items snapshot).
- **Action tests** (`src/app/admin/invoices/actions.test.ts` + extend orders/customer-orders tests, reusing the existing transaction mock):
  - `createInvoiceAction` snapshots items, assigns number, sets `order.invoiceId`, refuses duplicate.
  - `issueInvoiceAction` sets `issuedAt` + writes invoice notification.
  - `markPaidCashAction` → `paid`, mirrors `order.paymentStatus`, notifies.
  - `verifyPaymentAction` approve → `paid` (+mirror+notify); reject → `issued` (clears proof, mirror `unpaid`, notify).
  - `completeCollectionAction` only from `ready`; sets signature fields + `status:'completed'`; appends event; notifies.
  - `submitProofOfPaymentAction` customer-gated (`uid===customerId`), electronic-only, `issued → payment_submitted`, mirrors order.
- **Rules emulator** (`tests/rules/`): invoice read by owner + own customer; other customer denied; client create/update/delete denied. Storage: order-customer can write own proof path; non-customer denied; signature write owner-only.
- **Component:** `InvoiceEditor` live totals (incl. discount); `SignaturePad` produces a data URL; `DownloadInvoiceButton` renders; `ProofUploader` calls the action with the uploaded URL.

---

## 9. Out-of-scope recap (so the plan doesn't drift)

Phase 3: warranty auto-issuance + warranty views/claims. Phase 4: revenue dashboard + PDF export. Phase 5: admin-editable settings (incl. payment-channel details). Not in Phase 2: owner notifications, Cloud Functions, server-side PDF. Payment is authoritative on the invoice, mirrored to the order; all invoice writes are Admin-SDK server actions; reads are client-side gated by rules.
