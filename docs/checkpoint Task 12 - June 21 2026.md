Checkpoint — Catalog & public pages (Tasks 8–12 complete)

Where we are. Everything is committed locally on main (now 12 commits), 25 tests green, typecheck clean, production build passing under Next 16 — 6 routes prerendered as static HTML.

Built since the last checkpoint (Tasks 8–12):
- T8: money helpers — thebe/Pula in integer minor units, `formatPula` shows `P` with grouping (no decimals when whole). 5 tests.
- T9: seed catalog + pricing from PRD Appendix A — 18 iPhone models × 3 services (screen w/ Basic+OLED, battery, back-glass). `priceFor()` / `fromPrice()`. 4 tests.
- T10: landing page `/` — Hero, How-it-works (4 steps), Popular repairs (live "From" prices), FAQ teaser, location/contact.
- T11: `/services` (grid) and `/services/[slug]` (image placeholder, description, Basic/OLED toggle that flips every model's price live, price-by-model table). All three details are statically generated.
- T12: `/faq` — full accordion from a shared content file.

To review it visually, run this in your prompt (the ! runs it in your session):
!npm run dev
Then open http://localhost:3000 and try:
- The homepage: hero, the 4 how-it-works steps, popular repairs with real "From P…" prices, the FAQ teaser, contact block.
- /services → click "Screen Replacement" → toggle Basic ↔ OLED and watch all 18 prices change.
- /faq accordion. Theme toggle (top-right) on every page. Resize to ~360px for the mobile stack + sticky CTA.

Still expected to 404 (later tasks): /book (booking flow) and /login + /register (auth, Tasks 13–14).

Deviations from the plan worth knowing:
- `src/lib/content/faq.ts` was created in T10 (plan put it in T12) because the landing FAQ teaser needs it; the T12 page reuses the same source.
- No empty `services/[slug]/page.module.css` — all detail styling lives in `ServiceDetail.module.css`.
- T10–12 are pages/composition, so no new unit tests (per the plan); verified via typecheck + production build instead.

Not pushed yet: the T8–T12 commits are local only. A push needs your Git Credential Manager sign-in.

Next group (Tasks 13–15): Firebase client init → auth (context, register, login, Google) → owner-bootstrap script. T13 needs the real `lmsb2b` web config dropped into a gitignored `.env.local` first — I'll ask you for those values (or point me at them) when we resume. I'll pause again after T15.
