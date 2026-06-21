# 31Repairs — Product Requirements Document (PRD)

**Product:** 31Repairs — iPhone repair booking, tracking & management web app
**Owner:** 31Repairs (3 co-owners, all admins)
**Location:** Plot 594 Sekgoma, Gaborone, Botswana · [Google Maps](https://maps.app.goo.gl/yums9aXYCW93K94a8)
**Contact:** +267 75 443 175 · Instagram [@31.Repairs](https://instagram.com/31.Repairs)
**Currency:** Botswana Pula (BWP, "P")
**Stack:** Next.js (App Router) + Firebase
**Version:** 0.1 (Draft)
**Date:** 21 June 2026
**Status:** Awaiting sign-off → build

---

## 1. Executive summary

31Repairs is a walk-in iPhone repair shop in Gaborone. Today, customers call or message to ask prices, drop devices off, and then phone repeatedly to ask "is it ready?". This product replaces that friction with a self-service web app.

Customers register, browse a visual catalog of repair services (battery, screen, back glass, and more), book one or more repairs across one or more devices, drop the device(s) at the shop, then watch a live, color-coded status label move from *received* to *ready for collection* — with web push when the status changes. At collection they pay (cash or bank transfer), can optionally pre-pay against an invoice, e-sign on their phone to confirm handover, and receive a 3-month warranty.

The three owners share a single admin surface to manage the catalog and pricing, move jobs through the repair pipeline, raise and adjust invoices, verify proof of payment, issue warranties, edit the FAQ, and view a revenue dashboard.

The app is **mobile-first** (most customers are on phones), fully responsive for owners working on a laptop, and ships with a **day/night theme toggle**. Visual direction follows the TradingView pricing aesthetic — dark canvas, one bright accent, bold type, card-based pricing — which closely matches 31Repairs' existing brand.

---

## 2. Goals & non-goals

### 2.1 Goals

- Let customers **self-serve** booking and price discovery without calling.
- Give customers a **transparent, live status** for every repair, reducing "is it ready?" calls.
- Centralize **orders, invoices, payments, and warranties** in one place for the owners.
- Support **multi-service, multi-device** orders.
- Give owners **revenue visibility** (by week/month/custom range) with PDF export.
- Make the catalog **fully owner-managed** (new services, models, prices, images) with no developer involvement.

### 2.2 Success metrics (first 3 months post-launch)

- ≥ 60% of repair jobs booked through the app (vs. walk-in only).
- ≥ 50% reduction in inbound "status check" calls/messages.
- ≥ 90% of orders reach *Completed* with a captured e-signature.
- Owners raise ≥ 90% of invoices through the app.
- Revenue dashboard used at least weekly.

### 2.3 Non-goals (v1)

- No integrated card/online payment gateway (cash + bank transfer only; proof uploaded manually).
- No SMS or WhatsApp notifications in v1 (architected for later — see §13).
- No courier / pickup logistics — devices are physically dropped at the shop.
- No appointment time-slot scheduling (booking = a repair request, not a calendar slot).
- No public customer reviews / social wall in v1.
- No multi-branch support (single location).

---

## 3. Personas

**Customer (Thabo, 24, student in Gaborone).** Cracked his iPhone 13 screen. On his phone, wants to know the price, book the repair, drop it off, and get notified when it's ready without phoning. Comfortable with apps, low patience for clutter.

**Owner / Admin (one of 3 co-owners).** Runs the bench and the front desk. Needs to take in devices, update statuses quickly between repairs, raise invoices, confirm payments, and at month-end see how the business is doing. Often on a laptop at the shop, sometimes on a phone at the bench. All three owners have identical, full access.

---

## 4. Scope overview

| Area | Customer | Admin/Owner |
| --- | --- | --- |
| Auth | Register/login (email+password, Google) | Login (email+password, Google), elevated role |
| Catalog | Browse visual catalog, see prices | Full CRUD: services, models, prices, availability, images |
| Orders | Create multi-device/multi-service order, track status | View/manage all orders, advance status, add notes |
| Notifications | Color status label + web push | Trigger updates by changing status |
| Invoicing | View invoice, pay or pre-pay | Generate, adjust, close invoices |
| Payments | Upload proof of payment | Verify proof / mark paid (cash) |
| E-signature | Sign on mobile at collection | Capture/confirm signature on handover |
| Warranty | View warranty, raise a claim | Auto-issued on completion, manage claims |
| FAQ | Read | Edit (CRUD) |
| Revenue | — | Dashboard, date ranges, PDF export |

---

## 5. Information architecture

### 5.1 Customer app

- **/** — Landing / marketing page (brand hero, "how it works", featured services, CTA to book, FAQ teaser, location/map, contact).
- **/services** — Visual service catalog (cards with images, price-from).
- **/services/[slug]** — Service detail: image, description, model + variant selector, live price.
- **/book** — Booking flow (add devices → add services per device → review → submit). Requires auth.
- **/account** — Dashboard: my orders, my invoices, my warranties, profile.
- **/orders/[id]** — Single order: live status timeline, line items, invoice link, pay/upload proof, e-sign (when applicable).
- **/faq** — FAQ accordion.
- **/login**, **/register** — Auth.

### 5.2 Admin app (under /admin, role-gated)

- **/admin** — Overview (open jobs by status, today's collections, unverified payments).
- **/admin/orders** — Order queue (filter by status, search), kanban or list.
- **/admin/orders/[id]** — Manage order: change status, edit line items, add internal notes, raise/adjust invoice, verify payment, capture signature, mark complete.
- **/admin/catalog** — Services, phone models, pricing matrix, availability toggles, image uploads.
- **/admin/invoices** — All invoices, statuses, payment verification queue.
- **/admin/warranties** — Active/expired warranties, claims queue.
- **/admin/faq** — FAQ CRUD.
- **/admin/revenue** — Revenue dashboard + PDF export.
- **/admin/settings** — Shop info, bank/transfer details, warranty period, account/role list.

---

## 6. Customer features & flows

### 6.1 Registration & authentication

- Methods: **email + password** and **Google sign-in** (Firebase Auth).
- Profile fields: full name, email, phone number (for shop contact), optional photo.
- Email verification recommended before booking (configurable).
- Customers default to the `customer` role.

### 6.2 Browse catalog & pricing

- Catalog renders as **image cards** (TradingView-style), grouped by service category.
- Each service has its own image (e.g. a cracked-screen photo for Screen Replacement) so customers visually recognize the service.
- Service detail page: select **phone model** and, where relevant, a **variant** (e.g. *Basic Screen* vs *OLED Screen* — surfaced as a pill toggle like TradingView's Monthly/Annually). Price updates live.
- If a model/service is toggled unavailable by an admin, it shows as "Currently unavailable" and can't be added.

### 6.3 Booking / create order (multi-device, multi-service)

Flow:
1. **Add a device** — pick model (e.g. iPhone 13 Pro), give it a friendly label (e.g. "My blue 13 Pro") and optional notes (passcode handling, observed issues).
2. **Add services to that device** — e.g. Screen Replacement (OLED) + Battery Replacement. Each adds a line item with its quoted price.
3. **Add another device** if needed — repeat (different phones in one order supported).
4. **Review** — full line-item summary, **estimated total**, drop-off reminder (address + map), terms note that price is an estimate pending inspection.
5. **Submit** — order created with status **Order Placed**; customer is told to bring the device(s) to the shop.

Notes:
- Prices shown are **estimates**; final amounts are confirmed on the invoice after inspection.
- No payment at booking. No deposit.

### 6.4 Order tracking (color-coded status + web push)

- Each order (and each line item) shows a **status label that changes color** as it progresses (see §10 for the full lifecycle and color map).
- The order page shows a **vertical status timeline** with timestamps.
- On any status change, the customer receives a **web push notification** (Firebase Cloud Messaging) and an in-app notification. Push permission is requested at the right moment (after first booking).

### 6.5 Invoice, payment & proof of payment

- When the admin raises an invoice, it appears under the order and in **/account → invoices**.
- Payment is normally made **at collection** (cash or bank transfer). The app supports an optional **advance payment**: once an invoice exists, the customer may pay early.
- **Proof of payment:** if paying by transfer, the customer uploads a **screenshot** of the payment. The invoice moves to *Payment Submitted — awaiting verification*. An admin verifies it (before or after collection).
- If payment is cash (no proof needed), the admin simply **closes the invoice as Paid**.
- Payment status is independent of repair status (a phone can be *Ready for Collection* while *Unpaid*, and vice versa).

### 6.6 E-signature at collection

- On collection/handover, the customer **e-signs on their own mobile device** (canvas signature) to confirm: device(s) returned, repair acknowledged, and warranty terms accepted.
- Signature is saved (PNG in Storage) against the order/invoice with a timestamp. Completing this transitions the order to **Completed** and starts the warranty clock.

### 6.7 Warranty

- A **3-month warranty** is auto-issued **from the date the job is completed** (per service line, since different services may complete together).
- Customers see warranty status (active / expired, expiry date, covered work) under **/account → warranties**.
- Customers can **raise a warranty claim** (describe the issue, attach photos). Claim enters the admin queue.

### 6.8 FAQ

- Accordion of common questions (pricing, turnaround, warranty terms, parts quality — basic vs OLED, payment methods, location). Content is **admin-editable**.

---

## 7. Admin features & flows

### 7.1 Roles & access

- Three owners, **all with identical full access** (single `admin`/`owner` role for v1).
- Role enforced via Firebase Auth **custom claims** + Firestore security rules + route guards.
- Settings lists admin accounts; structure allows finer-grained staff roles to be added later without rework.

### 7.2 Order management & status pipeline

- **Order queue** with filters (status, payment status, date, customer) and search.
- Recommended view: a **kanban board** by status on desktop, a filterable **list** on mobile.
- Per order, an admin can: receive the device (move to *Device Received*), run diagnosis, **adjust line items / prices** if extra damage is found, advance status, add **internal notes** (not visible to customer), and mark complete.
- Every status change is written to an **order event log** (who, from→to, when, optional note) powering the customer timeline and an audit trail.

### 7.3 Catalog & pricing management

- **Services:** create/edit/archive a service (name, description, category, **image upload**, active flag, optional variants like Basic/OLED).
- **Phone models:** create/edit/archive models (e.g. iPhone 13 Pro). New models (and non-iPhone devices) can be added manually.
- **Pricing matrix:** set a price per (service × model × variant) and an **availability toggle** per cell. Bulk-edit friendly.
- Catalog is the single source of truth for prices shown to customers and for quoting line items.

### 7.4 Invoicing

- Generate an invoice from an order's line items (auto invoice number, shop details, customer details, BWP totals).
- **Adjust** before/after issuing: add line items (extra parts/labor found at inspection), edit prices, add discounts.
- Invoice statuses: *Draft → Issued → Payment Submitted → Paid* (also *Cancelled*).
- **Verify proof of payment** (view uploaded screenshot → approve/reject) or **close as Paid** for cash.
- Invoice is downloadable as **PDF** by both admin and customer.

### 7.5 Warranty management

- Warranty records are auto-created on job completion (3 months from completion date — period configurable in settings).
- Admin sees all warranties (active/expired) and a **claims queue**; can update claim status (received → assessing → resolved) and link a repeat repair if needed.

### 7.6 FAQ management

- Full CRUD on FAQ items (question, answer, category, order, active flag).

### 7.7 Revenue dashboard

- Summary cards: total revenue, jobs completed, average ticket, outstanding (issued-but-unpaid).
- **Time grouping:** by week, by month, and a **custom date range** picker.
- Charts: revenue over time, revenue by service category, revenue by phone model.
- Based on **Paid** invoices (paid date drives the period).
- **Export to PDF** for the selected range (summary + breakdown table).

### 7.8 Settings

- Shop profile (name, address, map link, phone, Instagram, logo).
- **Bank/transfer details** shown to customers paying in advance.
- Warranty period (default 3 months).
- Admin account list.

---

## 8. Repair status lifecycle

Order-level status (line items can carry their own sub-status where services finish at different times):

| # | Status | Meaning | Suggested label color |
| --- | --- | --- | --- |
| 1 | **Order Placed** | Customer booked online; device not yet dropped off | Neutral grey |
| 2 | **Device Received** | Device(s) physically taken in at the shop | Blue |
| 3 | **Diagnosing** | Inspection / quote confirmation; price may be adjusted | Amber |
| 4 | **Awaiting Approval** *(optional)* | Extra charges found; waiting for customer OK | Orange |
| 5 | **In Repair** | Work in progress | Cyan (brand accent) |
| 6 | **Awaiting Parts** *(optional)* | Paused pending parts | Purple |
| 7 | **Ready for Collection** | Repair done, awaiting customer pickup | Green |
| 8 | **Completed** | Collected + e-signed; warranty started | Solid/deep green |
| – | **Cancelled** | Order cancelled | Red |

Separate **payment status:** *Unpaid → Payment Submitted (proof uploaded) → Paid*. (Cash payments jump straight to *Paid* when the admin closes the invoice.)

The colored label is the customer's primary "notification" surface, reinforced by web push on each change.

---

## 9. Data model (Firestore)

> Collections and key fields. IDs are auto unless noted. Money stored in **thebe (integer minor units)** to avoid float errors; displayed as `P{amount}`. Timestamps are Firestore `Timestamp`.

**`users/{uid}`**
`role` (`customer` | `owner`), `fullName`, `email`, `phone`, `photoURL`, `fcmTokens[]`, `createdAt`, `updatedAt`

**`services/{serviceId}`**
`name`, `slug`, `category`, `description`, `imageURL`, `hasVariants` (bool), `variants[]` (e.g. `["Basic","OLED"]`), `active`, `sortOrder`

**`phoneModels/{modelId}`**
`name` (e.g. "iPhone 13 Pro"), `brand` (default "Apple"), `active`, `sortOrder`

**`prices/{priceId}`**  *(one per service × model × variant)*
`serviceId`, `modelId`, `variant` (nullable), `amount` (thebe), `available` (bool), `updatedAt`, `updatedBy`

**`orders/{orderId}`**
`orderNumber`, `customerId`, `status`, `paymentStatus`, `devices[]` → `{ deviceId, phoneModelId, label, notes }`, `items[]` → `{ itemId, deviceId, serviceId, variant, quotedAmount, finalAmount, lineStatus, completedAt }`, `estimatedTotal`, `finalTotal`, `invoiceId` (nullable), `createdAt`, `updatedAt`

**`orders/{orderId}/events/{eventId}`**  *(status timeline & audit)*
`type`, `fromStatus`, `toStatus`, `note`, `byUserId`, `byRole`, `at`

**`invoices/{invoiceId}`**
`invoiceNumber`, `orderId`, `customerId`, `lineItems[]`, `subtotal`, `adjustments[]`, `discount`, `total`, `currency` ("BWP"), `status` (`draft`|`issued`|`payment_submitted`|`paid`|`cancelled`), `paymentMethod` (`cash`|`bank_transfer`), `proofOfPaymentURL` (nullable), `verifiedBy` (nullable), `signatureURL` (nullable), `signedAt` (nullable), `issuedAt`, `paidAt`

**`warranties/{warrantyId}`**
`orderId`, `invoiceId`, `customerId`, `itemId`, `serviceName`, `phoneModelName`, `startDate`, `endDate`, `status` (`active`|`expired`|`claimed`), `createdAt`

**`warranties/{warrantyId}/claims/{claimId}`**
`customerId`, `description`, `photoURLs[]`, `status` (`received`|`assessing`|`resolved`|`rejected`), `adminNotes`, `createdAt`, `updatedAt`

**`faqs/{faqId}`**
`question`, `answer`, `category`, `active`, `sortOrder`

**`notifications/{notifId}`**
`userId`, `type`, `title`, `body`, `link`, `read` (bool), `createdAt`

**`settings/shop`** (single doc)
`name`, `address`, `mapURL`, `phone`, `instagram`, `logoURL`, `bankDetails`, `warrantyMonths` (default 3)

**Storage buckets:** `service-images/`, `proof-of-payment/{orderId}/`, `signatures/{orderId}/`, `warranty-claims/{claimId}/`, `branding/`.

---

## 10. Notifications

- **Primary:** in-app, color-coded **status label** on the order card/timeline.
- **Push:** **Firebase Cloud Messaging (FCM)** web push on each status change, payment verification, invoice issued, and warranty events. Token(s) stored on the user doc; permission prompted contextually.
- **In-app notification center:** bell icon with unread count, backed by the `notifications` collection.
- Triggers run in **Cloud Functions** (on order status change / invoice change) so logic is server-authoritative.
- *(Future:)* the same trigger layer can fan out to WhatsApp/SMS — see §13.

---

## 11. Design system & UX

**Direction (TradingView-inspired, on-brand for 31Repairs):**

- **Theme:** dark canvas as default with a **day/night toggle** (persisted per user). Light theme = white surfaces, dark text, same accent.
- **Color tokens:** near-black background (`~#0B0B0C`), elevated surface (`~#17181A`), primary text white/near-white, **single bright accent = 31Repairs cyan** (`~#27B8E6`, to be matched to the brand flyers). Status colors per §8.
- **Typography:** heavy grotesque sans for headings (e.g. Inter / Geist / Satoshi), regular weights for body; large, confident headline sizes echoing "Plans for every level of ambition".
- **Core components:**
  - *Service/price cards* with image, title, "from P—" price.
  - *Variant pill toggle* (Basic ↔ OLED), mirroring TradingView's Monthly/Annually switch with a savings/diff hint.
  - *Comparison table* for the full model × price matrix (collapsible on mobile).
  - *Status pill* (color-coded) + vertical timeline.
  - *FAQ accordion*.
  - *Signature pad* (mobile canvas).
  - *Bottom navigation* on mobile; sidebar on desktop admin.
  - *Bottom-sheet modals* on mobile for add-service, payment upload, etc.
- **Mobile-first:** every flow designed for a phone first; admin views progressively enhance to dense, multi-column layouts on laptop (kanban, tables, dashboard).
- **Accessibility:** WCAG AA contrast in both themes, keyboard-navigable, focus states, alt text on catalog images.

A full design-token spec and component library will be produced at the start of the build phase (using the frontend-design guidelines), seeded from the TradingView analysis above.

---

## 12. Technical architecture

- **Frontend:** Next.js (App Router) + React + TypeScript; **Tailwind CSS** for the design system; mobile-first responsive.
- **Auth:** Firebase Authentication (email/password + Google). Role via **custom claims**.
- **Database:** Cloud Firestore.
- **File storage:** Firebase Storage (service images, proof screenshots, signatures, claim photos, branding).
- **Server logic:** Firebase **Cloud Functions** — invoice/order-number generation, status-change notification fan-out, warranty auto-creation on completion, **PDF generation** (invoices + revenue report).
- **Push:** Firebase Cloud Messaging (web push) + service worker.
- **PDF:** server-side generation in a Cloud Function (consistent invoices/reports); client preview as needed.
- **E-signature:** canvas (e.g. `signature_pad`) → PNG → Storage → linked on invoice.
- **Hosting:** Firebase App Hosting **or** Vercel for the Next.js app (decision in Phase 0 based on SSR needs/cost). Functions + Firestore + Storage remain on Firebase either way.
- **Security:** Firestore **security rules** enforce customer-owns-own-data and admin-only writes to catalog/invoices/settings; Storage rules scope uploads; App Check recommended to block abuse.

---

## 13. Non-functional requirements

- **Performance:** first meaningful paint on 3G/mobile < 3s; catalog and order pages cached/optimized; images served responsively (Next/Image).
- **Reliability:** order/invoice writes are atomic (transactions/batched writes); event log is append-only.
- **Security & privacy:** least-privilege rules; only owners see all data; customers see only their own; payment screenshots access-controlled; PII minimized.
- **Localization:** BWP currency formatting; English (v1).
- **Auditability:** every status/invoice change attributed to a user and timestamped.
- **Scalability:** single-shop scale, but data model and triggers built to extend (more services, models, future channels, staff roles).
- **Offline tolerance (admin):** graceful handling of flaky shop Wi-Fi (Firestore offline persistence).

---

## 14. Phased delivery plan

**Phase 0 — Foundation & design system**
Project scaffolding, Firebase setup, auth (email + Google), role/custom-claims, security-rules baseline, theme system + day/night toggle, design tokens & core components, landing page shell, static catalog display.

**Phase 1 — Catalog + booking + tracking (MVP)**
Admin catalog management (services, models, pricing matrix, availability, image upload); customer registration; multi-device/multi-service booking; order queue (admin); status lifecycle + event log; color-coded tracking; in-app notifications + FCM web push; FAQ (read + admin CRUD).

**Phase 2 — Invoicing, payments & e-signature**
Invoice generation + adjustment; advance payment + proof-of-payment upload; admin verification / close-as-paid (cash); PDF invoices; e-signature at collection; *Completed* transition.

**Phase 3 — Warranty & revenue**
Auto-warranty on completion + warranty views; warranty claims flow + admin queue; revenue dashboard (week/month/custom range, charts) + PDF export; settings (shop info, bank details, warranty period, admin list).

**Phase 4 — Enhancements (post-launch, future)**
WhatsApp/SMS notifications; appointment scheduling; public reviews / social proof; finer staff roles & permissions; deeper analytics; non-iPhone catalog expansion at scale.

---

## 15. Open questions / decisions for build phase

1. **Hosting:** Firebase App Hosting vs Vercel — decide in Phase 0 (cost/SSR).
2. **Exact brand accent hex** to match the flyers precisely (sample from logo assets).
3. **Invoice/warranty wording** — do you have legal/warranty terms text to embed?
4. **Bank transfer details** to display for advance payments.
5. **Business hours / collection cut-off** copy for the landing page.
6. **Email sender identity** (for verification/receipts) — domain + Firebase email or a provider.
7. **Should line items be individually trackable** to customers, or is a single order-level status enough for v1? (Data model supports both; UI can start order-level.)

---

## Appendix A — Seed pricing (from current flyers, BWP)

> Prices below seed the catalog; all are editable in the admin panel.

### A.1 Battery Replacement

| Model | Price |
| --- | --- |
| iPhone X | P500 |
| iPhone XS / XR | P500 |
| iPhone XS Max | P600 |
| iPhone 11 | P600 |
| iPhone 11 Pro | P700 |
| iPhone 11 Pro Max | P800 |
| iPhone 12 | P700 |
| iPhone 12 Pro | P800 |
| iPhone 12 Pro Max | P950 |
| iPhone 13 | P800 |
| iPhone 13 Pro | P900 |
| iPhone 13 Pro Max | P1000 |
| iPhone 14 | P1000 |
| iPhone 14 Pro / 14 Plus | P1200 |
| iPhone 14 Pro Max | P1500 |
| iPhone 15 | P1500 |
| iPhone 15 Pro / 15 Plus | P2000 |
| iPhone 15 Pro Max | P2500 |

### A.2 Screen Replacement (Basic / OLED)

| Model | Basic | OLED |
| --- | --- | --- |
| iPhone X | P600 | P1000 |
| iPhone XS / XR | P600 | P1000 |
| iPhone XS Max | P700 | P1200 |
| iPhone 11 | P700 | P1500 |
| iPhone 11 Pro | P800 | P1700 |
| iPhone 11 Pro Max | P900 | P2000 |
| iPhone 12 | P900 | P1800 |
| iPhone 12 Pro | P1000 | P2000 |
| iPhone 12 Pro Max | P1200 | P2500 |
| iPhone 13 | P1000 | P2000 |
| iPhone 13 Pro | P1400 | P2500 |
| iPhone 13 Pro Max | P1800 | P3000 |
| iPhone 14 | P1400 | P3000 |
| iPhone 14 Pro / 14 Plus | P1800 | P3500 |
| iPhone 14 Pro Max | P2500 | P4000 |
| iPhone 15 | P1800 | P4500 |
| iPhone 15 Pro / 15 Plus | P3000 | P5000 |
| iPhone 15 Pro Max | P3500 | P6000 |

*Both options are tested and functional; OLED delivers the most accurate colour and brightness, like the original.*

### A.3 Back Glass Replacement

| Model | Price |
| --- | --- |
| iPhone X | P500 |
| iPhone XS / XR | P500 |
| iPhone XS Max | P500 |
| iPhone 11 | P500 |
| iPhone 11 Pro | P700 |
| iPhone 11 Pro Max | P700 |
| iPhone 12 | P600 |
| iPhone 12 Pro | P700 |
| iPhone 12 Pro Max | P800 |
| iPhone 13 | P800 |
| iPhone 13 Pro | P1000 |
| iPhone 13 Pro Max | P1000 |
| iPhone 14 | P900 |
| iPhone 14 Pro / 14 Plus | P1200 |
| iPhone 14 Pro Max | P1500 |
| iPhone 15 | P1500 |
| iPhone 15 Pro / 15 Plus | P1800 |
| iPhone 15 Pro Max | P2000 |

---

## Appendix B — Glossary

- **Basic vs OLED screen:** two screen part tiers; OLED is the premium, color-accurate option.
- **Proof of payment:** customer-uploaded screenshot of a bank transfer, verified by an admin.
- **Advance payment:** optional pre-payment by the customer once an invoice exists, before collection.
- **Completion date:** the date a job is finished and handed over (e-signed); starts the 3-month warranty.

*— End of PRD v0.1 —*
