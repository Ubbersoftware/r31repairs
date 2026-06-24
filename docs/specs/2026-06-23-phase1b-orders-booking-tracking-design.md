# Phase 1b — Orders: booking, tracking & admin pipeline (design)

**Status:** Approved for build (brainstormed 2026-06-23)
**Branch:** `phase-1b-orders` (NOT `main` — `main` now auto-deploys to Vercel; 1b merges only when complete)
**Predecessor:** Phase 1a (catalog + FAQ in Firestore, admin CRUD) — live in production.
**Parent roadmap:** architecture "Phase 1 (MVP)" split into 1a / 1b / 1c. This is 1b.
Source docs: `docs/specs/2026-06-21-architecture-design.md` (§6 routes, §7 data model, §8 security), `docs/31Repairs-PRD.md` (§6.3 booking, §6.4 tracking, §7.2 order management, §8 status lifecycle).

---

## 1. Scope

Build the repair-order loop on top of the 1a catalog: a customer books repairs, the shop moves the job through a status pipeline, and the customer watches a live, color-coded status timeline.

**In scope:**
- Customer **booking** (`/book`): multi-device, multi-service, prices from the live 1a catalog. Customer-only (no admin-created orders in 1b).
- Customer **tracking**: `/account` (order list) + `/orders/[id]` (status timeline + line items). Read-only.
- Admin **order queue** (`/admin/orders`): filterable, searchable **list** (works on phone + laptop).
- Admin **order management** (`/admin/orders/[id]`): advance status, edit line items/prices, internal notes, cancel.
- **Status pipeline** (order-level) + append-only **event log** + the **status→color token map**.
- Security rules for `r31_orders` (+ `events`); tests.

**Explicitly out of scope (deferred):**
- *Completed* status, e-signature, payment, invoicing, warranty → **Phase 2/3**.
- In-app notifications + FCM web push → **Phase 1c**. (1b writes the event log that 1c will fan out from.)
- Desktop **kanban board** and the `/admin` **overview dashboard** → **fast-follow** after 1b's working loop.
- Admin-created (walk-in) orders; customer approve/decline of price adjustments; customer-initiated cancellation; per-line-item status management in the UI (`lineStatus` stored, not surfaced — per decision D5).

---

## 2. Status model

Order-level status (per architecture D5: order carries the status; `lineStatus` stored for later, no migration).

```
Order Placed ─► Device Received ─► Diagnosing ─► In Repair ─► Ready for Collection
                                       │             │
                                       └─► Awaiting   └─► Awaiting Parts (hold)
                                           Approval (hold)
   (any non-terminal) ─► Cancelled
```

- **5 main states** + **2 optional holds** (Awaiting Approval, Awaiting Parts) + **Cancelled** (terminal in 1b). No *Completed* (needs e-sign → Phase 2).
- **Transitions are owner-driven, free-but-logged** — not a rigid state machine. The UI highlights the natural next step but an owner may set any status (shops move backward too). Validity is "any status → any status" except out of `Cancelled`.
- **Awaiting Approval** is entered when an owner adjusts a price during Diagnosing. It is an **informational hold** — the customer sees the revised quote; there is no binding approve/decline in 1b (that pairs with invoicing in Phase 2).
- Every change is an owner-only **server action** that *atomically* updates `order.status` and appends an immutable `events` entry.

### Status → color token map

Design system ships `--success / --danger / --warning` + the electric-blue accent. 1b adds **two status-only tokens** (`--status-blue`, `--status-purple`) — architecture sanctioned "1–2". The two holds share a **"paused" treatment** (dashed outline + pause glyph) instead of unique hues.

| Status | Hex | Token | Pill treatment |
|---|---|---|---|
| Order Placed | `#787B86` | `--muted` *(exists)* | solid — "not in the shop yet" |
| Device Received | `#2A8AF0` | `--status-blue` *(new)* | solid |
| Diagnosing | `#FF9800` | `--warning` *(exists)* | solid |
| Awaiting Approval | `#FF9800` | `--warning` *(exists)* | **outline + pause glyph** (hold) |
| In Repair | `#2962FF` | `--accent` *(exists)* | solid — brand "active work" state |
| Awaiting Parts | `#7E57C2` | `--status-purple` *(new)* | **outline + pause glyph** (hold) |
| Ready for Collection | `#089981` | `--success` *(exists)* | solid green |
| Cancelled | `#F23645` | `--danger` *(exists)* | solid red |

- **Deviation from PRD** (accepted): PRD suggested a distinct orange for Awaiting Approval; we reuse amber with the hold treatment to avoid a third token.
- Each pill renders as **tinted background (~14% of hue) + full-strength text/border**, so it adapts to **both light and dark themes**; every pill verified to WCAG AA on both.
- Implemented once as a `StatusPill` component + a `statusMeta` map `{ label, token, treatment }` consumed by both the customer timeline and the admin queue.

---

## 3. Customer surface

### Booking — `/book` (auth-gated, no payment)

A **single-page builder** (not a stepped wizard) — fewer mobile page transitions, with a running total for instant price feedback:

```
┌─ Book a repair ───────────────────────────┐
│  Device 1   [iPhone 13 ▾]  label: "______" │
│    • Screen — OLED        P1,500   [×]      │
│    • Battery              P  600   [×]      │
│    [+ Add service]                          │
│  ───────────────────────────────────────── │
│  [+ Add another device]                     │
├─────────────────────────────────────────── │
│  Estimated total  P2,100   [ Review → ]     │ ◄ sticky
└─────────────────────────────────────────── ┘
```

- **Add device** → pick model (active `r31_phoneModels`) + optional label + notes. **Add service** → pick from active `r31_services`; variant selector when `hasVariants`; **live price** from the matrix (`priceFor`).
- **Review** expands a grouped summary (per device, estimated total in Pula) → **Submit** → `createOrderAction`.
- On submit the server **snapshots** the computed `quotedAmount` (thebe), the model/service names, and the customer's name/phone onto the order, so later catalog edits don't mutate a placed order.

### Tracking — `/account` (list) + `/orders/[id]` (detail)

- `/account`: the customer's orders, newest-first — order #, date, device summary, `StatusPill`, estimated total. Empty state → "No repairs yet · Book a repair".
- `/orders/[id]`: large current `StatusPill`; a **vertical status timeline** built from customer-visible `events` (each change + timestamp + note); line items grouped by device showing quoted price — **and a revised price + note where the shop adjusted it**. Read-only in 1b. Layout reserves the slots where pay / invoice / e-sign land in Phase 2.

### Defaults
- **Login required, email-verification not required** in 1b (configurable later).
- **Cancellation is owner-only** in 1b (no customer-cancel button).

---

## 4. Admin surface (list-based; kanban + overview = fast-follow)

### `/admin/orders` — the queue

Filterable, searchable **list** (works on phone and laptop):
- Filter by status (chips); search by order # / customer name; newest-first.
- Each row: order #, customer, device+service summary, `StatusPill`, **age** (days since placed — surfaces stale jobs). Tap → detail.

### `/admin/orders/[id]` — manage one order

- **Header**: order #, customer **name + phone** (to call them), current `StatusPill`.
- **Status control (primary action)**: prominent button for the natural next step (e.g. "Mark Device Received") + a menu to set any status (corrections, holds, Cancel), each with an optional note → `changeOrderStatusAction`.
- **Line items** grouped by device: edit a line's price (the revised price the customer sees), add a line (extra damage), remove a line → `editOrderLinesAction` (recomputes `finalTotal`).
- **Internal notes**: free-text, `visibility: internal` → `addOrderNoteAction`.
- **Activity log**: the full `events` feed (admin sees all, including internal) — the audit trail.
- **Cancel** → `cancelOrderAction`.

### Deferred
`/admin` overview dashboard and the desktop kanban board → fast-follow. The Phase 0 `/admin` placeholder stays until then.

---

## 5. Data model & types

Uses the architecture §7 shapes (already specced). TS interfaces in `src/lib/types`.

- **`r31_orders/{orderId}`**: `orderNumber` (e.g. `R31-0001`), `customerId`, `customerName` + `customerPhone` (snapshot), `status` (`OrderStatus`), `paymentStatus` (default `'unpaid'`, not surfaced in 1b), `devices[]` `{ deviceId, phoneModelId, modelName (snapshot), label?, notes? }`, `items[]` `{ itemId, deviceId, serviceId, serviceName (snapshot), variant|null, quotedAmount (thebe), finalAmount?, lineStatus, completedAt? }`, `estimatedTotal`, `finalTotal?`, `createdAt`, `updatedAt`.
- **`r31_orders/{orderId}/events/{eventId}`**: `type` (`'created' | 'status_change' | 'line_edit' | 'note'`), `fromStatus?`, `toStatus?`, `note?`, `visibility` (`'customer' | 'internal'`), `byUserId`, `byRole`, `at`.
- **`r31_counters/orders`**: `{ seq }` — atomic transaction increment mints `orderNumber`.

New TS: `Order`, `OrderDevice`, `OrderItem`, `OrderEvent`, `OrderStatus` union, `statusMeta` map. Zod schemas (`validation.ts`) for booking input, status-change, line-edit, note.

---

## 6. Server actions & data flow

Server-authoritative; mirror the 1a pattern (`verifyOwner` / `ActionResult` from shared `actionResult.ts` / `revalidatePath`). All in `src/app/.../actions.ts` files with `'use server'`.

- **`createOrderAction(idToken, bookingInput)`** (customer auth): **verify the caller's ID token via a new `verifyUser(idToken)` Admin helper** (alongside 1a's `verifyOwner` — `verifyUser` accepts any authenticated user and returns the decoded token; `customerId` is set to that `uid`, never trusted from the client); validate selections; **recompute every price server-side from the live price matrix — never trust client-sent prices**; mint `orderNumber` via a `r31_counters/orders` transaction; write the order + a `created` event. `revalidatePath('/account')`.
- **`changeOrderStatusAction(idToken, orderId, toStatus, note?)`** (owner): transaction — update `status` + append `status_change` event.
- **`editOrderLinesAction(idToken, orderId, edits)`** (owner): update/add/remove items, recompute `finalTotal`, append `line_edit` event(s) (customer-visible).
- **`addOrderNoteAction(idToken, orderId, note, visibility)`** (owner): append `note` event.
- **`cancelOrderAction(idToken, orderId, note?)`** (owner): status → Cancelled + event.
- Owner write actions `revalidatePath('/admin/orders')`, `/admin/orders/[id]`, `/orders/[id]`, `/account`. (1c hooks notification fan-out here.)

**Reads / auth split (avoids new session-cookie infra):**
- **Customer** reads own orders + customer-visible events **client-side via the Firebase SDK**, gated by rules.
- **Admin** reads via the **server** (Admin SDK) — `getOrdersForAdmin(filters)`, `getOrder(id)`, `getOrderEvents(id)`. Mirrors the 1a server query layer.
- **All writes** go through server actions (Admin SDK). Clients never write orders directly.

---

## 7. Security model (extend `firestore.rules`, all `r31_*`)

- **`r31_orders/{orderId}`**: `allow read: if isOwner() || request.auth.uid == resource.data.customerId;` `allow write: if false;` (all writes are Admin-SDK server actions, which bypass rules).
- **`r31_orders/{orderId}/events/{eventId}`**: `allow read: if isOwner() || (resource.data.visibility == 'customer' && <requester owns the parent order>);` — internal events are owner-only. Append-only; never client-deletable; client writes denied.
- Reuse the existing `isOwner()` helper. Add cases to the rules-unit tests beside the 1a catalog tests.

---

## 8. Testing

- **Unit (Vitest):** server price recompute/snapshot, `orderNumber` minting/format, status-change event logging, zod schemas.
- **Component:** booking builder (add device/service, live total, submit calls action), `StatusPill` (each status + hold treatment), timeline, admin list filters + search, status control.
- **Emulator rules tests** (beside 1a's): customer reads only their own orders; cannot read another customer's order; internal events owner-only; customer-visible events readable by the order owner; client writes denied.
- **Pricing-integrity test:** `createOrderAction` ignores client-sent prices and recomputes from the matrix (booking can't be tampered to a cheaper price).

---

## 9. Out-of-scope recap (so the plan doesn't drift)

Phase 2: payment, invoicing, e-signature, *Completed*, warranty. Phase 1c: in-app notifications + FCM push. Fast-follow: kanban board, `/admin` overview dashboard. Not in 1b: admin-created orders, customer approve/decline, customer-cancel, per-line status UI.

**Implementation de-scope (recorded during the final whole-branch review):** `editLineAction`/the admin UI support editing an existing line's price (the extra-damage repricing path), but **not adding or removing order lines** — the design text in §4 mentioned add/remove, but 1b ships edit-only. Adding/removing a line is a fast-follow (it pairs naturally with invoicing in Phase 2). This is a deliberate, internally-consistent reduction, not a regression.

**Security note (controller correction during execution):** the admin order pages (`/admin/orders`, `/admin/orders/[id]`) read CLIENT-side via the Firebase SDK (owner `role:'owner'` claim + rules permit owner-reads-all), NOT server-side via the Admin SDK — because orders are private and `/admin` is gated only by a client `RequireOwner` guard, so a server read would ship all order PII in the initial payload before the guard runs. The server query layer (`getOrdersForAdmin`/`getOrder`/`getOrderEvents`) is retained for a future session-authenticated/kanban path.
