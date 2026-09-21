# FiveFrames — Progress

Last updated: 2026-09-21

This file is current project state for a fresh implementation session, not a session log.
History and reasoning live in [docs/decisions.md](./decisions.md) (consequential decisions) and
git history (everything else). Update this file by rewriting it to match current reality, not by
appending narrative.

## Current phase

**Slice 2 — Guest join and photo capture: complete.**

All 6 items in the manual verification checklist passed on real devices, reported 2026-09-21:
iPhone Safari, Android Chrome, and Facebook/Messenger/Instagram in-app browsers all completed the
full join → 5-capture flow; an interrupted upload retried cleanly with no duplicate and no lost
frame; a reload mid-attempt correctly resumed via the persisted `reserve_key`; and a real HEIC
capture from an iPhone committed and produced a viewable JPEG derivative — resolving the spec's
open question (product.md §19): no extra conversion work is needed, `sharp` decodes HEIC/HEIF
transparently on commit.

## What exists

- **Decisions D1–D11** ([decisions.md](./decisions.md)) — all **Accepted**, standing architecture.
  No new consequential decisions were needed for this slice; D5–D7 already anticipated the shape
  implemented here.
- **Roadmap** ([roadmap.md](./roadmap.md)) — Slices 1–2 done, Slice 3 next.
- **Vercel project** `five-frames` (org `ezanglos-projects`), linked via `.vercel/` (gitignored).
  Created ad hoc during this slice to get a real-HTTPS URL for device testing — the guest session
  cookie is `Secure`, which plain-HTTP LAN testing can't satisfy. Env vars (`NEXT_PUBLIC_
  SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `GUEST_SESSION_SECRET`) are set for both Preview and Production scopes, both pointing at the
  **dev** Supabase project. Live at `https://five-frames.vercel.app`.
  **Known interim state to reconcile before a real production launch:** because Vercel assigns a
  brand-new project's first deployment to Production regardless of intent, this Vercel project's
  Production environment currently serves the dev database, not a production one. Fine for
  continued device testing; must not be mistaken for a real production deployment later —
  Slice 6+ will need a genuine production Supabase project and Vercel env separation before this
  goes anywhere near real payments or guest data.
- **Schema (migration `20260921120000_guest_capture.sql`):** `guest_sessions` (event-scoped,
  display name); `captures` (`slot_index` 0–4 check constraint, partial unique index on
  `(guest_session_id, slot_index)` over live statuses, unique index on
  `(guest_session_id, reserve_key)`); the `reserve_capture()` Postgres function implementing the
  reserve step — row-locks the guest session, lazily expires abandoned reservations past their
  30-minute TTL, and is idempotent on `reserve_key`. RLS deny-all on both tables, same rationale
  as Slice 1. Private Storage bucket `captures` (no public read, `image/jpeg|png|webp|heic|heif`
  only). `supabase db advisors` shows only the pre-existing, unrelated
  `auth_leaked_password_protection` warning from Slice 1.
- **The frame-limit mechanism** (architecture §6, decisions D5/D6): `lib/dal/captures.ts` —
  `reserveCapture` re-checks the capture gate with a fresh event read, then calls
  `reserve_capture()`; `commitCapture` re-checks the gate again, refuses a lapsed reservation
  (checking `expires_at` directly, not just the `status` column, since the lazy sweep only runs
  inside `reserve_capture()` — see the regression note below), verifies the uploaded object
  before ever marking a frame consumed, and generates derivatives. Both are idempotent for their
  respective terminal states.
- **Guest identity:** `lib/auth/guest-session.ts` + `lib/auth/guest-session-token.ts` — our own
  httpOnly/Secure/SameSite=Lax signed cookie (decision D3), one cookie name per event token
  (HMAC-SHA256, `GUEST_SESSION_SECRET`), so one browser can hold sessions for multiple events.
  `lib/dal/guest-sessions.ts` scopes every query by `event_id`.
- **Media:** `lib/media/storage.ts` — signed upload URL minting (`createSignedUploadUrl`, D7),
  commit-time object/mime verification, `sharp`-based display (1600px) and thumbnail (400px)
  derivative generation written as separate objects (invariant 10: original untouched), signed
  read URL helper for later slices.
- **Guest UI:** `app/(guest)/e/[token]/` — calm states for "event not found", "not open yet", and
  "capture has ended" (no guest-facing error tone); join form; `CaptureSlots` client component
  driving reserve → direct PUT upload → commit, with the client-generated `reserve_key`
  persisted to `localStorage` before the first request (survives a reload mid-attempt) and
  cleared only on a terminal outcome, resuming an in-flight reservation on return.
- **Dev activation stand-in for payment** (architecture §13, roadmap Slice 2): `pnpm
  dev:activate-event <eventId>` (`scripts/activate-event-dev.ts`) sets `activated_at`,
  `capture_opened_at`, and issues `event_token`/`gallery_token` directly against the linked dev
  database. It is a standalone script, not a route or UI affordance in the app itself — there is
  no code path in the shipped app that can activate an event without payment (invariant 7 is
  intact). Real payment-driven activation is Slice 6.
- **Testing:** `lib/dal/captures.integration.test.ts` against the real linked dev Postgres and
  Storage — concurrent reserve storm (5 succeed, 6th exhausted, slots 0–4 exactly), duplicate
  reserve sharing one key (one row, one slot), retry-after-failed-upload (exactly one committed
  capture), abandoned-reservation TTL freeing its slot, a retry arriving after expiry reported as
  lapsed rather than revived, commit refused for a lapsed reservation, and reserve/commit refused
  while capture is closed. `lib/auth/guest-session-token.test.ts` — cookie signing round-trip,
  tamper rejection, cross-event rejection, wrong-secret rejection.

## Verification status

- `pnpm typecheck` — passing.
- `pnpm lint` — passing (same 1 pre-existing warning as Slice 1, `app/layout.tsx` unused `Geist`
  import; no errors).
- `pnpm build` — passing; `/e/[token]` registers as a dynamic route.
- `pnpm test` (Vitest) — 28/28 passing, including the frame-mechanism integration tests above
  against the real dev database and storage bucket.
- **Real-device validation — passed, reported 2026-09-21.** All 6 checklist items (iPhone
  Safari, Android Chrome, FB/Messenger/IG in-app browsers, interrupted upload, reload mid-attempt,
  HEIC) — see below.

## Regression protection added for human-found defects

One defect was caught by the integration tests themselves during implementation, before reaching
a human: the first version of `commitCapture` only checked the `status` column for "expired," but
that column is only updated lazily inside `reserve_capture()`, so a reservation whose TTL had
lapsed without a subsequent reserve call could still pass commit's gate. Fixed by having
`commitCapture` check `expires_at` directly against the current time, not just `status`. Covered
by "refuses to commit a lapsed reservation" in `lib/dal/captures.integration.test.ts`. No defects
were found during human verification.

## Manual verification results (Slice 2 exit condition) — all passed, 2026-09-21

Seeded via a draft event activated with `pnpm dev:activate-event <eventId>`, tested against the
Vercel deployment described above for real HTTPS.

1. **iPhone Safari** — pass. Full join → 5-capture flow completed.
2. **Android Chrome** — pass. Full join → 5-capture flow completed.
3. **Facebook/Messenger/Instagram in-app browsers** — pass. Picker opened and upload completed
   in each.
4. **Interrupted upload + retry** — pass. No duplicate capture, no lost frame.
5. **Reload mid-attempt** — pass. The persisted `reserve_key` correctly resumed the in-progress
   reservation rather than losing or duplicating it.
6. **HEIC on a real iPhone** — pass. Committed and produced a viewable JPEG derivative; resolves
   product.md §19's open question — no dedicated HEIC conversion step is needed, `sharp` handles
   it on the existing derivative path.

## Next slice

**Slice 3 — Guest's own view and network resilience** ([roadmap](./roadmap.md)). Not started.
Device testing surfaced no upload failures severe enough to demand TUS immediately, but Slice 3
should still set the resumable-upload size threshold deliberately rather than skip it, per the
roadmap.

## Blockers and open items

| Item | Type | Affects |
|---|---|---|
| Vercel Production env currently points at the dev Supabase project (see note above) | Known interim state | Must be reconciled before Slice 6+ production work |
| PayMongo account with KYC completed | External prerequisite | Slice 6 |
| No git remote configured | Setup | Any push/CI work |
| Service role key is the single highest-value secret; RLS does not constrain it | Security constraint | All slices |
| Safety-net close duration (48–72h) and expiry grace period (~30d) | Launch policy, from spec §19 | Slice 9 |
| Refund/retention/deletion legal copy | Business decision, from spec §19 | Pre-launch |
