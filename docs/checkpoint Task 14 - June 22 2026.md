Checkpoint — Firebase + auth (Tasks 13–14 complete, code)

Where we are. Tasks 13 and 14 are built and committed on main. 27 tests green, typecheck clean, production build passing under Next 16 — 7 routes prerender (added /login and /register).

Built since the last checkpoint:
- T13: Firebase client init — `src/lib/firebase/client.ts` exports `firebaseApp`, `auth`, `db`, `storage`, and `firebaseConfig`, all assembled from `NEXT_PUBLIC_FIREBASE_*` env. Real `lmsb2b` config is in the gitignored `.env.local` (never committed). firebase v12 installed.
- T14: Authentication —
  - `src/lib/firebase/auth.ts`: `registerWithEmail`, `loginWithEmail`, `loginWithGoogle`, `logout`, and `newUserDoc`. First sign-in creates `r31_users/{uid}` with `role: customer`.
  - `AuthProvider` + `useAuth()` → `{ user, claims, loading }` (role read from the ID-token custom claim).
  - `AuthForm` (react-hook-form + zod) with a `/register` and `/login` page; root layout wrapped in `AuthProvider`.

What needs YOU before we continue:

1. Manual auth verification (Task 14, Step 7). Run in your prompt:
   !npm run dev
   Then:
   - Go to http://localhost:3000/register and create a test account.
   - In the Firebase console (project lmsb2b → Firestore), confirm a doc appears at r31_users/<uid> with role: customer.
   - Sign out, then sign in again at /login.
   - Try "Continue with Google" (localhost is an authorized domain by default).
   Tell me if anything misbehaves.

2. Service-account key for Task 15. The owner-bootstrap script (`npm run set-owner`) grants the 'owner' custom claim. It needs a service-account JSON: Firebase console → Project settings → Service accounts → Generate new private key. Keep it OUT of git; we pass it via the FIREBASE_SERVICE_ACCOUNT env var. Also: the 3 owners must each register in-app (step 1 above) before we can grant them owner.

One thing to eyeball during verify: /login and /register sit inside the marketing layout, so they show the top nav (with its blue "Book a repair") plus the form's own primary button — two primary buttons on one screen, against the "one primary per view" rule. It's what the plan specified, but say the word and I'll move auth pages out of the marketing chrome (or drop the nav CTA on those routes).

Not pushed yet: check whether the T13–T14 commits have been pushed to origin (a push needs your Git Credential Manager sign-in).

Next group (Task 15): owner custom-claims bootstrap script, a RequireOwner guard, the /admin shell, an /account placeholder, and the (customer) layout. Then T16 (security rules — needs Java/JDK for the emulator) and T17 (README + Vercel deploy).
