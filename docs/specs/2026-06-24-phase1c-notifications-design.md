# Phase 1c — In-app notifications (design)

**Status:** Approved for build (brainstormed 2026-06-24)
**Branch:** `phase-1c-notifications` (off `phase-1b-orders` @ `62c8e71` — 1b is not yet merged to `main`; 1c builds on 1b's order actions + event model). Merge order: 1b → main, then 1c → main.
**Predecessor:** Phase 1b (orders: booking, tracking, admin pipeline).
**Parent roadmap:** architecture "Phase 1 (MVP)" split into 1a / 1b / 1c. This is 1c.
Source docs: `docs/specs/2026-06-21-architecture-design.md` (§7 data model, §8 security, §10 notifications, §330 fan-out), `docs/31Repairs-PRD.md` (§6.4, §10).

---

## 1. Scope

When the shop changes an order's status or adjusts a line price, the order's **customer** gets an **in-app notification** — a bell with an unread badge and a dropdown feed, so they learn "your repair is ready" (or "your quote changed") without checking the page.

**In scope:**
- A `r31_notifications` collection (per-user notification docs).
- **Fan-out** written **inline** in the existing 1b owner server actions (atomic with the status/event write) — no Cloud Functions.
- An in-app **notification bell** on the customer surface: live unread badge, dropdown feed, mark-read, mark-all-read, deep-link to the order.
- Security rules for `r31_notifications`; tests.

**Explicitly out of scope (deferred):**
- **FCM web push → Phase 1c-ii** (service worker `firebase-messaging-sw.js`, VAPID key, permission prompt after first booking, Admin-SDK `messaging().send(...)`, `fcmTokens[]` lifecycle). The in-app store built here is its foundation.
- **Owner-side notifications** (e.g. "new booking arrived") — owners stay aware via the `/admin/orders` queue; owner alerts pair better with push (1c-ii).
- **Cloud Functions** (the architecture's §330 alternative) — not needed; the server action writes the notification atomically.
- Payment / invoice / warranty notifications → Phase 2/3.
- `addOrderNoteAction` does **not** notify (internal and customer-visible notes appear on the timeline but don't push a notification — keeps the bell to status + price events).

---

## 2. Data model

**`r31_notifications/{notifId}`** (architecture §7 shape):
- `userId` — the recipient (the order's `customerId`).
- `type` — `'status_change' | 'price_update'`.
- `title` — short, e.g. `"Order R31-0042"`.
- `body` — e.g. `"Status: Ready for Collection"` or `"Your quote was updated"`.
- `link` — `/orders/{orderId}`.
- `read` — boolean, default `false`.
- `createdAt` — number (epoch ms, `Date.now()`).

TS: `Notification` interface + `NotificationType` union in `src/lib/types/notification.ts`. The notification helper + any client query helpers live in `src/lib/notifications/`.

---

## 3. Fan-out (inline in the 1b owner actions)

A small server-side helper builds + writes the notification **within the existing transaction** of each owner action, so order update + `events` append + notification all commit atomically (no orphaned or missing notifications).

- **Helper:** `buildNotification(input)` (pure — maps a status/price change to the notification doc body `{ userId, type, title, body, link, read:false, createdAt }`, i.e. `Omit<Notification,'id'>`). The action calls `tx.set(notifRef, buildNotification(...))` on a fresh `r31_notifications` doc ref.
- **`changeOrderStatusAction`** → `type:'status_change'`, body `Status: {label}` (label from `statusMeta[toStatus].label`), `link:/orders/{id}`. `userId` = the order's `customerId` (already read in the transaction). `title` uses the order's `orderNumber` (also in the read doc).
- **`cancelOrderAction`** routes through the same status path → `Status: Cancelled`.
- **`editLineAction`** → `type:'price_update'`, body `Your quote was updated`, same link.
- `userId` is always the verified order's `customerId`, never client-supplied.

No change to `addOrderNoteAction` (no notification).

---

## 4. In-app bell (customer surface)

A `NotificationBell` `'use client'` component in the **`(customer)` layout header** (shows on `/account`, `/orders/[id]`, `/book`).

- **Live data:** `onSnapshot(query(collection(db,'r31_notifications'), where('userId','==',uid)))` — sorted by `createdAt` desc and capped to the latest ~20 **client-side** (no composite index needed — matches the project's JS-sort convention; per-customer volume is small). Badge + list update live while the app is open.
- **Bell + badge:** unread count (`read===false`); `aria-label` includes the count.
- **Dropdown panel:** title, body, relative time, unread dot per item. On mobile, a near-full-width sheet rather than a cramped dropdown. Empty state: "No notifications yet."
- **Interactions:** click an item → `updateDoc(..., { read:true })` + navigate to its `link`; **"Mark all as read"** clears the rest.
- Design-system tokens, 44px touch targets, dual-theme.

Mark-read writes are constrained by the rules (§5) to only the `read` field on the customer's own docs.

---

## 5. Security model (extend `firestore.rules`)

```
match /r31_notifications/{notifId} {
  allow read: if request.auth != null && request.auth.uid == resource.data.userId;
  allow update: if request.auth != null
    && request.auth.uid == resource.data.userId
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
  allow create, delete: if false;   // written only by Admin-SDK server actions
}
```

- **Read:** own notifications only.
- **Update:** own docs, and **only the `read` field may change** (can't forge `title`/`body`/`userId`/`link`).
- **Create/delete:** client-denied; notifications are written by the Admin-SDK server actions (which bypass rules), same write discipline as `r31_orders`.

---

## 6. Testing

- **Action tests** (extend 1b's `src/app/admin/orders/actions.test.ts`): `changeOrderStatusAction`, `cancelOrderAction`, `editLineAction` now also write a `r31_notifications` doc — assert it's created **in the same transaction** with `userId === order.customerId`, correct `type`, `link:/orders/{id}`, `read:false`. The existing transaction mock captures the extra `tx.set`.
- **`buildNotification` unit test:** status change → correct title/body/type/link; price update → `type:'price_update'`.
- **`NotificationBell` component test:** mock the client SDK (`onSnapshot`/`updateDoc`) + `next/navigation`; assert the unread badge count, the dropdown list, click-marks-read + navigates, and mark-all-read clears unread.
- **Rules emulator test** (beside 1b's, in `tests/rules/`): a customer reads only their own; can't read another customer's; can update **only** `read` on their own (changing `title`/`userId` denied); client create/delete denied.

---

## 7. Out-of-scope recap (so the plan doesn't drift)

Phase 1c-ii: FCM web push (service worker, VAPID key, permission prompt, Admin-SDK send, `fcmTokens[]`). Not in 1c: owner notifications, Cloud Functions, payment/invoice/warranty notifications, `addOrderNoteAction` notifications. Notifications read client-side gated by rules; all writes are server actions (Admin SDK).
