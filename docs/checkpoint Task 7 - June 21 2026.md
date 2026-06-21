Checkpoint — Foundation & design system (Tasks 1–7 complete)

Here's where we are. Everything is committed locally on main (7 commits), 16 tests green, typecheck clean, production build passing under Next 16.

Built so far:
- Scaffold, Vitest, theme system (dark/light, no-flash, persisted)
- Full UI kit from the design skill: Button, Pill, ServiceCard, SegmentedToggle, FeatureList, Faq, ComparisonTable
- Responsive Nav (with mobile burger overlay), Footer (real shop details), sticky MobileCta, and the (marketing) layout wrapping it all

To review it visually, run this in your prompt (the ! runs it in your session so you can watch/stop it):
!npm run dev
Then open http://localhost:3000 and try the theme toggle (top-right ☀/☾). Resize to ~360px to see the mobile burger + sticky CTA.

Expected at this stage: the homepage is an intentional placeholder ("Foundation online"), and Nav links to /services, /faq, /book, /login will 404 — those pages arrive in Tasks 10–15. The point of this checkpoint is to confirm the look, theme, and component feel match the 31Repairs design before I build the real pages on top.

Next group (Tasks 8–12): money helpers → seed catalog + pricing (PRD Appendix A) → landing page → static services catalog with live variant pricing → FAQ page. I'll pause again after Task 12.