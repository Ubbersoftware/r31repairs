# Phase 3 — Warranty & Settings (design)

**Status:** Approved for build (brainstormed 2026-06-26)
**Branch:** `phase-3-warranty` off `main` (created after the Phase 2 PR merges to `main`). PR back to `main`.
**Predecessor:** Phase 2 (invoicing/payments/e-signature) — provides `completeCollectionAction` (`ready → completed`), `r31_invoices`, and the `PAYMENT_CHANNELS` config constant this phase makes admin-editable.
**Parent roadmap:** PRD §6.7 (warranty), §7.5 (warranty management), §7.8 (settings), §9 (data model). The Phase 2 design re-cut PRD §14: warranty + settings land here in Phase 3; **revenue dashboard + PDF export → Phase 4**; **admin-account management → Phase 5+**.
Source docs: `docs/31Repairs-PRD.md`, `docs/specs/2026-06-25-phase2-invoicing-design.md` (action + fan-out + write-discipline conventions).

---

## 1. Scope

When an order reaches **Completed** (collected + e-signed in Phase 2), the shop **auto-issues a warranty per repaired line item**. Customers see warranty status (active/expired, expiry date, covered work) on `/account` and `/orders/[id]`, and can **raise a claim** (description + photos) against an active warranty. Claims enter an admin queue at `/admin/warranties`, where an owner moves them `received → assessing → resolved/rejected`. Separately, owners get a **Settings** screen (`/admin/settings`) to edit shop profile, payment-channel pay-to details, and the warranty period — turning the Phase 2 placeholder constants into real, admin-managed values.

Delivered as three independently shippable sub-phases, executed inline with a checkpoint at the end of each:

- **3a** — auto-warranty on completion + customer/admin warranty views.
- **3b** — warranty claims flow + admin claims queue.
- **3c** — settings (shop profile, payment channels, warranty period) + read-only admin list, wired back into Phase 2 surfaces.

**In scope:**
- New `r31_warranties/{warrantyId}` collection (one per completed line item), Admin-SDK-written.
- Auto-creation inside the existing `completeCollectionAction` transaction (no Cloud Functions).
- **Computed** expiry — stored status is `active`/`claimed`; `expired` is derived from `endDate` at read time via a pure helper.
- Claims subcollection `r31_warranties/{id}/claims/{claimId}`, Admin-SDK-written (customer raise + owner update).
- Claim photo upload to `r31/warranty-claims/{warrantyId}/` (client upload → server action attaches URLs).
- New `r31_settings/shop` single doc: shop profile, editable payment channels, warranty months.
- Claim-status **notifications** to the customer (extends the inline 1c fan-out).
- Refactor of Phase 2 placeholders (`PAYMENT_CHANNELS`, warranty period) to read from settings, with the code constants as fallback defaults.
- Security rules (tighten `r31_warranties` + claims to server-authoritative; tighten `r31_settings` write) and Storage paths; tests throughout.

**Explicitly out of scope (deferred):**
- **Revenue dashboard** + PDF export → **Phase 4** (`/admin/revenue` stays a 404/stub).
- **Admin-account management** (grant/revoke the `owner` custom claim) → **Phase 5+**. The settings admin list is **read-only**.
- **Cloud Functions** (no scheduled `active→expired` flip; expiry is computed at read time).
- **Owner notifications** (owners use the `/admin/warranties` queue) — consistent with 1c/2.
- Linking a repeat repair to a claim (PRD §7.5 "link a repeat repair") — not in v1 of this phase.

---

## 2. Data model

### 2.1 New collection `r31_warranties/{warrantyId}`
Written **only** by Admin-SDK server actions (clients never write directly).

- `orderId`, `customerId` — link + ownership.
- `invoiceId: string | null` — the order's invoice at completion time (may be `null`).
- `itemId` — the originating `OrderItem.itemId` (one warranty per item).
- `serviceName: string` — snapshot for display.
- `phoneModelName: string` — snapshot, resolved from `order.devices[deviceId].modelName`.
- `startDate: number` — `= order.completedAt`.
- `endDate: number` — `= startDate + warrantyMonths` (month arithmetic, see §4).
- `status: 'active' | 'claimed'` — **stored**. `expired` is **never stored** (see §4).
- `createdAt: number`.

TS: `Warranty`, `WarrantyStatus` (stored), `WarrantyState` (`'active' | 'expired' | 'claimed'`, computed) in `src/lib/types/warranty.ts`.

### 2.2 Claims subcollection `r31_warranties/{warrantyId}/claims/{claimId}`
Written **only** by Admin-SDK server actions.

- `warrantyId` — denormalized parent id (for flat queries / convenience).
- `customerId` — ownership (snapshot from the parent warranty).
- `description: string` (1–1000 chars).
- `photoURLs: string[]` — uploaded to `r31/warranty-claims/{warrantyId}/` (0–6 images).
- `status: 'received' | 'assessing' | 'resolved' | 'rejected'`.
- `adminNotes: string | null`.
- `createdAt: number`, `updatedAt: number`.

TS: `Claim`, `ClaimStatus` in `src/lib/types/warranty.ts`. `CLAIM_STATUSES` const + `claimStatusMeta` (label + design token) mirroring `statusMeta`.

### 2.3 New collection `r31_settings/{id}` — doc `shop`
Single doc `r31_settings/shop`. Written **only** by an Admin-SDK server action; **publicly readable** (landing page + customers paying need shop info / pay-to details).

- `name, address, mapURL, phone, instagram` — shop profile strings.
- `logoURL: string | null` — uploaded to `r31/branding/`.
- `paymentChannels: PaymentChannel[]` — editable copy of the Phase 2 `PAYMENT_CHANNELS` shape (`{ id, label, payToLabel, details }`).
- `warrantyMonths: number` — default 3.
- `updatedAt: number`, `updatedBy: string`.

TS: `ShopSettings` in `src/lib/types/settings.ts`.

### 2.4 Order is the completion trigger (no schema change)
No change to `Order`. `completeCollectionAction` already sets `status:'completed'`, `completedAt`, and the order carries `items`, `devices`, and `invoiceId` — everything warranty creation needs.

---

## 3. Server actions

All owner actions: `verifyOwner(idToken)`; customer actions: `verifyUser(idToken)`. Firestore **transaction** → (where relevant) inline notification fan-out → `revalidatePath`. Return `ActionResult`, wrap throws in `fail(e)` (existing convention). All `r31_warranties` / claims / `r31_settings` writes are Admin-SDK (clients never write).

### 3.1 Auto-warranty — extend `src/app/admin/orders/actions.ts`
- **`completeCollectionAction` (modify)** — in the **same transaction** that flips `ready → completed`, also create one `r31_warranties` doc per `order.items` entry. For each item: resolve `phoneModelName` from `order.devices` (match `item.deviceId`), set `startDate = now`, `endDate = addMonths(now, warrantyMonths)`, `status: 'active'`, `invoiceId = order.invoiceId ?? null`. `warrantyMonths` comes from **settings if present, else `WARRANTY_MONTHS` constant** (3c wires settings; 3a uses the constant). Existing behaviour (signature, event, completed notification) is unchanged. Idempotency: only runs from `status === 'ready'`, so it cannot fire twice for one order.

### 3.2 Claims — `src/app/(customer)/warranties/actions.ts` (customer) + `src/app/admin/warranties/actions.ts` (owner)
- **`raiseClaimAction(idToken, warrantyId, { description, photoURLs })`** (customer) — verifies `uid === warranty.customerId` (Admin SDK read); requires `warrantyState(warranty, now) === 'active'` (cannot claim an expired or already-claimed warranty); validates input (zod); creates the claim doc (`status:'received'`) **and** sets parent `warranty.status = 'claimed'`, same transaction. No owner notification (owners use the queue).
- **`updateClaimAction(idToken, warrantyId, claimId, { status, adminNotes })`** (owner) — validates the target status; updates the claim (`status`, `adminNotes`, `updatedAt`); **notifies the customer** via `buildClaimNotification`. Does **not** auto-revert the parent warranty (a resolved/rejected claim leaves the warranty `claimed`; v1 keeps the audit simple).

### 3.3 Settings — `src/app/admin/settings/actions.ts`
- **`updateSettingsAction(idToken, input)`** (owner) — zod-validated; `set(r31_settings/shop, { ...input, updatedAt, updatedBy }, { merge: true })`. Logo PNG/JPEG is uploaded client-side to `r31/branding/` first; the action only stores the URL. `revalidatePath` for `/`, `/admin/settings`, and any customer surface showing pay-to details.

---

## 4. Pure, testable helpers

`src/lib/warranties/expiry.ts`:
- `addMonths(startMs: number, months: number): number` — calendar-month arithmetic (not `+30*months` days), clamping end-of-month overflow (e.g. Jan 31 + 1 = Feb 28/29).
- `warrantyState(w: { status: WarrantyStatus; endDate: number }, now: number): WarrantyState` — returns `'claimed'` if stored `claimed`; else `'expired'` if `now > endDate`; else `'active'`.

`src/lib/warranties/mappers.ts`:
- `orderToWarrantyDrafts(order, warrantyMonths, now): WarrantyDraft[]` — one draft per item, resolving `phoneModelName` from devices, computing `endDate`.
- `toWarranty(id, d)` / `toClaim(id, d)` — Firestore doc → typed object with safe defaults (mirrors `toInvoice`).

`src/lib/settings/defaults.ts`:
- `DEFAULT_SETTINGS: ShopSettings` (seeded from current `PAYMENT_CHANNELS` + `WARRANTY_MONTHS`).
- `mergeSettings(stored: Partial<ShopSettings> | null): ShopSettings` — stored over defaults, so the app works before anything is saved.

---

## 5. UI surfaces

### 5.1 Customer
- **`/orders/[id]` (OrderDetail)** — when the order is `completed`, a **warranty card** per item: covered work (service + model), status pill (`warrantyState`), expiry date; for an `active` warranty, a **Raise a claim** button → `ClaimForm`; if `claimed`, show the latest claim's status + admin notes.
- **`/account`** — a **warranties section** listing the customer's warranties (status pill + expiry + link to the order).

### 5.2 Admin
- **`/admin/warranties`** — new page, two regions: **Claims queue** (claims across all warranties, `received` highlighted, newest first, JS-sorted; row → claim detail with status selector + admin-notes field calling `updateClaimAction`) and **All warranties** (active/expired list, filter by state). Server-rendered via Admin-SDK queries.
- **`/admin/settings`** — new page; `SettingsForm` with: shop profile fields, logo upload (`r31/branding/`), an editable list of payment channels (label / pay-to label / details per channel), warranty-months number, and a **read-only** owners list (name + email from `r31_users` where `role == 'owner'`).

### 5.3 Sidebar
`AdminSidebar` already links `/admin/warranties` and `/admin/settings` (and `/admin/revenue`). 3a/3b make warranties resolve; 3c makes settings resolve; `/admin/revenue` remains until Phase 4.

---

## 6. Components & lib

- `src/lib/types/warranty.ts` — `Warranty`, `WarrantyStatus`, `WarrantyState`, `Claim`, `ClaimStatus`, `CLAIM_STATUSES`, `claimStatusMeta`.
- `src/lib/types/settings.ts` — `ShopSettings`.
- `src/lib/warranties/`: `expiry.ts` (+test), `mappers.ts` (+test), `validation.ts` (+test, zod: claim raise / claim update), `queries.ts` (server-only Admin-SDK reads: `getWarrantiesForCustomer`, `getWarrantiesForAdmin`, `getWarranty`, `getClaimsForAdmin`).
- `src/lib/settings/`: `defaults.ts` (+test), `validation.ts` (+test), `queries.ts` (server-only `getSettings`).
- `src/lib/notifications/buildNotification.ts` — add `buildClaimNotification` (+ `'claim_update'` in `NotificationType`).
- `src/components/warranties/WarrantyCard.tsx`, `ClaimForm.tsx` (+test, multi-photo upload mirroring `ProofUploader`), `WarrantyStatusPill.tsx`, `ClaimStatusPill.tsx`.
- `src/app/admin/warranties/`: `page.tsx`, `WarrantyAdmin.tsx` (+ `.module.css`), `actions.ts` (+test).
- `src/app/(customer)/warranties/actions.ts` (+test).
- `src/app/admin/settings/`: `page.tsx`, `SettingsForm.tsx` (+test), `actions.ts` (+test), `.module.css`.
- Refactor consumers: `ProofUploader` + customer invoice pay-to block read channels from settings (fallback to constants); `completeCollectionAction` reads `warrantyMonths` from settings (fallback to constant).

---

## 7. Security

### 7.1 Firestore (`firestore.rules`) — tighten the existing scaffold
The current scaffold allows client writes (`r31_warranties` `write: if isOwner()`, claims `create: if isSignedIn()`, `r31_settings` `write: if isOwner()`). Tighten to the Phase 2 server-authoritative discipline:

```
match /r31_warranties/{id} {
  allow read: if isOwner() || (isSignedIn() && resource.data.customerId == request.auth.uid);
  allow write: if false; // Admin-SDK server actions only
  match /claims/{claimId} {
    allow read: if isOwner()
      || (isSignedIn() && get(/databases/$(database)/documents/r31_warranties/$(id)).data.customerId == request.auth.uid);
    allow write: if false; // raise + update via Admin-SDK actions
  }
}
match /r31_settings/{id} {
  allow read: if true;     // landing page + customers (pay-to details)
  allow write: if false;   // updateSettingsAction only
}
```

### 7.2 Storage (`storage.rules`)
```
match /r31/warranty-claims/{warrantyId}/{file=**} {
  allow read, write: if request.auth != null
    && (request.auth.token.role == 'owner'
        || request.auth.uid == firestore.get(/databases/(default)/documents/r31_warranties/$(warrantyId)).data.customerId);
}
match /r31/branding/{file=**} {
  allow read: if true;                       // logo shown publicly
  allow write: if request.auth.token.role == 'owner';
}
```

---

## 8. Testing

- **Unit:** `expiry` (`addMonths` month-end clamping; `warrantyState` active/expired/claimed boundaries); `warranties/mappers` (`orderToWarrantyDrafts` resolves model name, computes endDate, one per item; `toWarranty`/`toClaim` defaults); `warranties/validation` (claim description bounds, photo count, claim-status enum); `settings/defaults` (`mergeSettings` stored-over-defaults); `settings/validation`.
- **Action tests** (reuse the Phase 2 two-doc transaction mock pattern):
  - `completeCollectionAction` (extend existing test) — from `ready`, writes N warranty docs (one per item) with correct `endDate` + `phoneModelName`, alongside the existing completed transition.
  - `raiseClaimAction` — customer-gated; refuses non-`active` warranty; creates claim `received` + flips warranty to `claimed`.
  - `updateClaimAction` — owner-gated; moves status, writes `adminNotes`, emits `claim_update` notification.
  - `updateSettingsAction` — owner-gated; merges into `r31_settings/shop`.
- **Rules emulator** (`tests/rules/warranties.test.ts`, `tests/rules/settings.test.ts`): warranty read by owner + own customer, other customer denied; client writes to warranty/claims denied; settings public read, client write denied. Storage: warranty-customer can write own claim path, non-customer denied; branding write owner-only, read public.
- **Component:** `ClaimForm` uploads then calls `raiseClaimAction` with URLs; `WarrantyCard` renders the right state/pill; `SettingsForm` submits to `updateSettingsAction`.

---

## 9. Out-of-scope recap (so the plan doesn't drift)

**Phase 4:** revenue dashboard (week/month/custom range, charts, summary cards) + PDF export — driven by `paid` invoices. **Phase 5+:** admin-account management (grant/revoke `owner` claim). **Not in Phase 3:** Cloud Functions / scheduled expiry flip (expiry is computed), owner notifications, repeat-repair linkage on claims, server-side PDF. Warranties + claims + settings are server-authoritative (Admin-SDK writes); reads are rules-gated (warranties owner-or-own-customer; settings public read). The warranty period and payment-channel details live in `r31_settings/shop` after 3c, with code constants as fallback defaults.
