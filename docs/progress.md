# FiveFrames — Progress

Last updated: 2026-09-21

This file is current project state for a fresh implementation session, not a session log.
History and reasoning live in [docs/decisions.md](./decisions.md) (consequential decisions) and
git history (everything else). Update this file by rewriting it to match current reality, not by
appending narrative.

## Current phase

**Slice 4 — Host dashboard and moderation: complete.**

Built on Slice 2's frame-limit mechanism without changing it: moderation and capture open/close
only ever touch `hidden_at`/`deleted_at`/`favorited_at`/`capture_opened_at`/`capture_closed_at` —
never `slot_index` or `status` — so a hidden, deleted, or favorited capture can never free a slot
or restore a frame (product invariant 4). The event edit page at `/events/[eventId]` is now also
the host dashboard: lifecycle state, capture open/close control, guest-session and photo counts,
and a gallery grid with hide/unhide/delete/favorite, refreshed by client-side polling (decision
D9). No new schema was needed — the moderation columns already existed from Slice 2's migration.

Slice 3 — guest's own view and network resilience — is unchanged and remains complete; see its
prior verification record in git history if needed.

## What exists

- **Decisions D1–D11** ([decisions.md](./decisions.md)) — all **Accepted**, standing architecture.
  No new consequential decisions were needed for this slice.
- **Roadmap** ([roadmap.md](./roadmap.md)) — Slices 1–4 done, Slice 5 next.
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
- **Media:** `lib/media/storage.ts` — signed upload URL minting (`createSignedUploadUrl`, now
  returning both the PUT `signedUrl` and the bare `token` used for TUS auth), commit-time
  object/mime verification, `sharp`-based display (1600px) and thumbnail (400px) derivative
  generation written as separate objects (invariant 10: original untouched), `createSignedReadUrl`
  for private delivery, and `getResumableUploadEndpoint()` deriving the TUS host from the same
  project URL every other Supabase client already uses. `lib/media/constants.ts` holds the bucket
  name and the 6MB resumable-upload threshold (D7) without a `server-only` import, so the client
  upload code can read them too.
- **Upload path (Slice 3, resolves D7's deferred threshold):** the client picks a standard
  signed-URL PUT below 6MB, or `tus-js-client` at or above it — Supabase's own recommended cutover
  point, same value as the fixed TUS chunk size. The TUS path authenticates via the
  `createSignedUploadUrl` token in the `x-signature` header, never the anon key or a session token
  (D3/D4 boundary holds). `tus-js-client`'s default fingerprint-based resume continues a
  re-selected file from its last successful chunk, including across a reload, which is what makes
  "connection drops mid-upload" cheap for large files beyond the reserve/commit gate itself.
- **Guest UI:** `app/(guest)/e/[token]/` — calm states for "event not found", "not open yet", and
  "capture has ended" (no guest-facing error tone); join form; `CaptureSlots` client component
  driving reserve → direct upload (PUT or TUS) → commit, with the client-generated `reserve_key`
  persisted to `localStorage` before the first request (survives a reload mid-attempt) and
  cleared only on a terminal outcome, resuming an in-flight reservation on return. Committed slots
  render their actual thumbnail (signed URL) with a download link to the original, not just a
  "Captured" placeholder.
- **Guest's own view (Slice 3, spec §8.3/§13, criteria 6 and 16-guest-half):**
  `listCapturesForGuestSessionWithUrls` (`lib/dal/captures.ts`) wraps the existing
  ownership-scoped query and mints signed thumbnail/download URLs only for committed captures —
  the query itself is the access check, the signed URL is its result, never a substitute (the same
  rule as everywhere else media is served). The "capture has ended" calm state now also loads and
  shows the guest's own captures when their session still exists, via the shared `OwnCaptures`
  component (`app/(guest)/e/[token]/own-captures.tsx`), instead of only the generic message.
- **Dev activation stand-in for payment** (architecture §13, roadmap Slice 2): `pnpm
  dev:activate-event <eventId>` (`scripts/activate-event-dev.ts`) sets `activated_at`,
  `capture_opened_at`, and issues `event_token`/`gallery_token` directly against the linked dev
  database. It is a standalone script, not a route or UI affordance in the app itself — there is
  no code path in the shipped app that can activate an event without payment (invariant 7 is
  intact). Real payment-driven activation is Slice 6.
- **Host dashboard and moderation (Slice 4, product.md §11.2, roadmap criteria 11/22/24):**
  `/events/[eventId]` (`app/(host)/events/[eventId]/page.tsx`) now also serves as the dashboard —
  guest-session and photo counts (`getEventCaptureStats`), a capture open/close control
  (`openCapture`/`closeCapture` in `lib/dal/events.ts`, gated by the new `canOpenCapture` helper
  in `lib/events/lifecycle.ts`: refuses to reopen once the automatic safety-net close has passed),
  and a gallery grid (`listCapturesForEventHost`, `GalleryGrid` client component) with
  hide/unhide/delete/favorite (`moderateCapture` in `lib/dal/captures.ts`). All four moderation
  and both capture-control functions verify event ownership via `getEventForHost` before touching
  anything, matching the existing ownership-predicate discipline. Moderation only ever writes
  `hidden_at`/`deleted_at`/`favorited_at` — never `slot_index` or `status` — so it can never free a
  slot or return a frame (product invariant 4); `listCapturesForGuestSession` now also excludes
  hidden/deleted rows, so moderated captures disappear from the guest's own view too (spec §8.3
  exception), without affecting which slots are considered occupied. The dashboard refreshes via
  a client-side `DashboardPoller` calling `router.refresh()` on an interval (decision D9 — polling,
  not realtime). `EVENT_LIFECYCLE_STATE_LABEL` in `lib/events/lifecycle.ts` is now the single
  source for lifecycle-state display text, shared by the dashboard list and the event page.
- **Testing:** `lib/dal/captures.integration.test.ts` against the real linked dev Postgres and
  Storage — concurrent reserve storm (5 succeed, 6th exhausted, slots 0–4 exactly), duplicate
  reserve sharing one key (one row, one slot), retry-after-failed-upload (exactly one committed
  capture), abandoned-reservation TTL freeing its slot, a retry arriving after expiry reported as
  lapsed rather than revived, commit refused for a lapsed reservation, reserve/commit refused
  while capture is closed, the guest's own view returning signed thumbnail/download urls for a
  committed capture and null urls for a still-pending one, and (Slice 4) host moderation removing
  a capture from the guest's own view while a fresh reserve storm still only yields the remaining
  slots (never restoring the hidden/deleted one), moderation/stats scoped to the owning host only,
  `getEventCaptureStats` counting sessions and non-deleted committed photos, and capture
  open/close transitions including the "cannot reopen once the safety-net close has passed" rule.
  `lib/auth/guest-session-token.test.ts` — cookie signing round-trip, tamper rejection, cross-event
  rejection, wrong-secret rejection.

## Verification status

- `pnpm typecheck` — passing.
- `pnpm lint` — passing, no errors or warnings.
- `pnpm build` — passing; `/e/[token]` and `/events/[eventId]` register as dynamic routes.
- `pnpm test` (Vitest) — 33/33 passing, including the Slice 4 moderation/capture-control
  integration tests above against the real dev database and storage bucket.
- **Slice 2 real-device validation — passed, reported 2026-09-21.** All 6 checklist items (iPhone
  Safari, Android Chrome, FB/Messenger/IG in-app browsers, interrupted upload, reload mid-attempt,
  HEIC) — see the historical record below. Still valid for the unchanged reserve/commit mechanism.
- **Slice 3 real-device validation — passed, reported 2026-09-21.** All 4 checklist items
  (interrupted upload over the resumable path, reload mid-upload, own-captures thumbnails/
  downloads, capture-ended own-view) — see below. Items 1–2 were this slice's roadmap exit
  condition.
- **Slice 4 has no device-dependent acceptance criteria** — the dashboard is a standard desktop/
  browser host UI (counts, a button, a gallery grid), fully exercised by the integration tests
  above and the automated checks. The roadmap's own verification for this slice ("Counts correct
  without realtime. Hidden and deleted captures disappear from the guest view. Moderation never
  restores a frame.") is what those tests assert directly. No manual device checklist is required
  to consider this slice complete; the UI itself has not been clicked through in a browser (this
  environment does not run browser automation) — see the optional recommended checks below.

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

## Manual verification results (Slice 3 exit condition) — all passed, reported 2026-09-21

This is the roadmap's own verification for this slice ("Interrupted upload leaves the frame
available. Reload mid-upload yields a consistent state — committed or available, never both.").
Automated tests prove the reservation/commit mechanism honors this at the database level; these
four checks prove it holds in a real browser on a real network, which no automated test here can.

Seeded an active event the same way Slice 2 did (`pnpm dev:activate-event <eventId>`, tested
against the real-HTTPS Vercel deployment — the guest cookie is `Secure` and won't set over plain
HTTP).

1. **Interrupted upload is resumable, not lost** — pass. A photo at or above 6MB (the resumable
   threshold) was confirmed, the connection was killed mid-upload for several seconds, then
   restored. The upload continued rather than restarting or failing, and completed; the frame was
   never committed without the photo landing, and was never lost.
2. **Reload mid-upload leaves a consistent state** — pass. A large-photo attempt was reloaded
   mid-upload. After reload the slot correctly resolved to available-for-a-fresh-attempt or
   already-committed, never both and never stuck; re-selecting the same photo let the attempt
   finish rather than forcing a full restart.
3. **Own-captures thumbnails/downloads** — pass. Committed slots show the actual photo thumbnail
   with a working download link, not a placeholder.
4. **Capture-ended own-view** — pass. The event link after capture closed shows the "capture has
   ended" message plus the guest's own previously-committed captures with working downloads.

All four items passed; no failures to fix, so this slice's defect-to-regression policy does not
apply.

## Recommended (optional) manual check for Slice 4

Not a blocking exit condition — the roadmap's verification for this slice is fully covered by
automated tests above. If convenient, click through once in a browser as a sanity check:

1. Open `/events/[eventId]` for an event with a few committed captures. Confirm the guest-session
   and photo counts match reality, and the "Open capture" / "Close capture" button matches the
   current lifecycle state.
2. Hide, then unhide, a capture in the gallery grid. Confirm it disappears/reappears without a
   full page reload.
3. Delete a capture. Confirm it disappears and stays gone after a manual refresh.
4. Open the same event's guest link (`/e/[token]`) as the moderated guest and confirm the hidden/
   deleted capture is gone from their own view too.

## Next slice

**Slice 5 — Gallery reveal, gallery link, visibility** ([roadmap](./roadmap.md)). Not started.

## Blockers and open items

| Item | Type | Affects |
|---|---|---|
| Vercel Production env currently points at the dev Supabase project (see note above) | Known interim state | Must be reconciled before Slice 6+ production work |
| PayMongo account with KYC completed | External prerequisite | Slice 6 |
| No git remote configured | Setup | Any push/CI work |
| Service role key is the single highest-value secret; RLS does not constrain it | Security constraint | All slices |
| Safety-net close duration (48–72h) and expiry grace period (~30d) | Launch policy, from spec §19 | Slice 9 |
| Refund/retention/deletion legal copy | Business decision, from spec §19 | Pre-launch |
