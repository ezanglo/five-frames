# FiveFrames — Progress

Last updated: 2026-09-22 (Slice 8 implemented, awaiting human verification)

This file is current project state for a fresh implementation session, not a session log.
History and reasoning live in [docs/decisions.md](./decisions.md) (consequential decisions) and
git history (everything else). Update this file by rewriting it to match current reality, not by
appending narrative.

## Current phase

**Slices 1–8: implemented, automated checks passing. Slice 8 is `awaiting human verification`**
before it can be marked complete — see the checklist below. The PayMongo account-creation blocker
recorded earlier in this slice (KYC page broken) was resolved by the user directly with PayMongo;
test-mode API keys now exist. Nothing about Slices 1–7 changed in this pass.

**Reconciliation pass (2026-09-22, second pass — operator role, manual payment, Operator
Console).** product.md was updated with the internal Operator role, supplier-assisted/manual
payment, and the MVP Operator Console (§5/§5.1). Architecture, decisions, and roadmap were
reconciled against those changes without touching Slices 1–6 or any accepted decision before D15:
- **decisions.md** gained D15 (operators are Supabase Auth users gated by an explicit grant
  table, not a role platform), D16 (provider and manual payment converge on one idempotent
  `activateEvent` function, same atomic-guard pattern as D5/D6/D13), and D17 (the manual
  payment/refund audit trail lives on the `payments` row itself, no separate audit-log table).
- **architecture.md** gained §5a (Operators — identity, `requireOperator()`, the
  `ops:grant-operator` script, the ownership-conflict check), §8a (manual payment and the shared
  activation path), and §8b (Operator Console shape and privilege boundaries), plus an
  `operators` table and a from-scratch `payments` table design (§4) that carries both payment
  sources from the start — the `payments` table had not been built yet, so this is a first
  design, not a retrofit of shipped schema.
- **roadmap.md** split the former Slice 7 ("Payment, activation, and event signage") into three:
  **Slice 7** (operator identity model + read-only Console shell, no mutations), **Slice 8**
  (provider payment through the new shared `activateEvent`, plus signage — functionally the old
  Slice 7 minus manual payment), and **Slice 9** (manual payment confirmation and refunds through
  the Console, reusing Slice 8's activation path). Former Slices 8–12 renumbered to 10–14. None
  of them had started, so this is not a reopening of completed work.
- No change to product.md's §12 invariants 1–12, or to any of the frame-limit (§6), event-capacity
  (§6a), or demo-isolation (§6b) mechanisms — those are untouched by this pass.

**Former current-phase entry (Slice 6), preserved below:**

**Slice 6 — Event join capacity enforcement and guest trust cues: complete.**

`guest_session_cap` (default 250) and `guest_session_count` columns were added to `events`
(migration `20260922000000_event_join_capacity.sql`), enforced by a new
`join_guest_session()` Postgres function mirroring `reserve_capture()`'s pattern (D5/D6): a
single atomic `UPDATE events SET guest_session_count = guest_session_count + 1 WHERE
guest_session_count < guest_session_cap RETURNING ...` acts as both lock and guard, so the
`guest_sessions` insert only happens once that update returns a row, in the same statement's
transaction — the exact mechanism decision D13 specifies. `createGuestSession`
(`lib/dal/guest-sessions.ts`) now calls this RPC and returns a `{kind: "joined" |
"at_capacity"}` outcome instead of throwing or assuming success. The guest join screen
(`app/(guest)/e/[token]/`) pre-checks `hasReachedGuestCapacity()` (`lib/events/lifecycle.ts`,
a read-only display helper — never the enforcement) to show a calm "This event is full"
state to a fresh visitor without attempting a join; the join action itself re-checks via the
atomic RPC regardless, so a race between that read and a concurrent submit can't let the
event grow past its cap. Guest trust cues (product.md §4 principle 9) were added as a short
line under the join form: no app, no account, captures follow the event's own access
settings — phrased to match the actual access model (§8), not overstate privacy. The host
dashboard's existing ambient caption now reads "`N` of `cap` guests" instead of just `N`,
reusing the event row it already has rather than a new query.

**Reconciliation pass (2026-09-22).** product.md was updated with the pre-purchase demo,
revised launch pricing (₱999 → ₱1,490 target), the 250-session event capacity boundary, expanded
signage deliverables, and guest trust cues. Architecture, decisions, and roadmap were reconciled
against those changes — see decisions D13 (event capacity: atomic counter, configurable cap) and
D14 (public demo: entirely client-side, no server storage). The roadmap gained two new slices
(event capacity enforcement + trust cues; the public demo) and Slice 7's scope now includes
signage; slices 6–10 were renumbered to 6–12 to make room since none had started. Slices 1–5 are
unaffected.

**Slice 5 — Gallery reveal, gallery link, visibility: complete.**

No schema change was needed — `reveal_mode`, `reveal_at`, `visibility`, `event_token`, and
`gallery_token` all already existed on `events` from Slice 1, and the host config form already
wrote to them. This slice added: the reveal-timing mechanism (`isGalleryRevealed()`); the public
`(gallery)/g/[token]` viewer route, gated on that plus `visibility`; and host-facing link
rotation/revocation for both the capture link and the gallery link. See decision D12 for how
"after the event" reveal is anchored mechanically. Slices 1–4 are unchanged and remain complete;
see prior verification records in git history if needed.

## What exists

- **Decisions D1–D17** ([decisions.md](./decisions.md)) — all **Accepted**, standing architecture.
  D12 records how "after the event" reveal timing is anchored to capture closing. D13/D14 record
  the event-capacity counter mechanism and the client-only public demo (implemented, Slice 6).
  D15–D17 record the operator grant model, the shared provider/manual activation function
  (implemented, Slice 8), and the payment-row-as-audit-trail decision (manual fields land Slice 9).
- **Roadmap** ([roadmap.md](./roadmap.md)) — Slices 1–8 implemented; Slice 8 is `awaiting human
  verification` (see checklist below); Slice 9 (manual payment/refunds through the Operator
  Console) next once it passes.
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
- **Gallery reveal, link, and visibility (Slice 5, product.md §7.3/§8, roadmap criteria 14–17):**
  `isGalleryRevealed()` (`lib/events/lifecycle.ts`, decision D12) derives reveal state from
  `reveal_mode`/`reveal_at` plus the existing lifecycle timestamps — never activated is never
  revealed; `immediate` reveals on activation; `after_event` (default) reveals once capture has
  closed; `custom` reveals at `reveal_at`. The public viewer lives at `(gallery)/g/[token]`
  (`app/(gallery)/`), resolved by `getEventByGalleryToken` (`lib/dal/events.ts`) — the gallery
  token is itself the credential, same pattern as the guest capture token, so there is no host
  ownership predicate on the lookup. The page is the one place that decides access: not found,
  `visibility === "only_me"`, and not-yet-revealed each render their own calm denial before any
  capture is ever loaded; only once access is granted does `listCapturesForGalleryViewer`
  (`lib/dal/captures.ts`) run, minting signed display-resolution URLs for committed,
  non-hidden, non-deleted captures only (the query is the access check, the signed URL is its
  result — same rule as every other media surface). The viewer shows images only, no download
  affordance — bulk/individual download is host-only and is Slice 11. Host dashboard link
  rotation/revocation (`rotateEventToken`/`revokeEventToken`/`rotateGalleryToken`/
  `revokeGalleryToken` in `lib/dal/events.ts`, `LinkRow` client component) is gated on
  `activated_at` — an unactivated (unpaid) event has nothing to rotate into existence (invariant
  7) — and rotation always mints a fresh token via the shared `generateLinkToken()`
  (`lib/auth/link-tokens.ts`, also now used by `scripts/activate-event-dev.ts`), immediately
  invalidating the old URL since every lookup is by exact token match. Copy-link uses
  `window.location.origin` client-side rather than a new base-URL env var.
- **Event join capacity and guest trust cues (Slice 6, product.md §9.5/§4 principle 9, decision
  D13):** see the Current phase section above for the full mechanism description
  (`guest_session_cap`/`guest_session_count` on `events`, `join_guest_session()`, the calm
  "event is full" state, and the trust-cue copy on the join screen).
- **Operator identity model and read-only Operator Console (Slice 7, decision D15, architecture
  §5a/§8b):** migration `20260922010000_operators.sql` adds `operators` (`user_id` references
  `auth.users`, RLS deny-all — same insurance-only rationale as every other table, D4). Operators
  authenticate through the same Supabase Auth as hosts; a row's mere existence is the
  authorization, always read fresh — never a session claim. `lib/dal/operators.ts` holds
  `isOperator`/`grantOperator` with no Next.js import, so it stays callable from
  `pnpm ops:grant-operator` outside a Next.js request; `lib/auth/operator-session.ts` holds the
  request-facing `requireOperator()`/`getAuthenticatedOperator()` (next/navigation, next/headers),
  mirroring the existing split between `lib/dal/events.ts` and `lib/auth/host-session.ts`.
  `requireOperator()` redirects an unauthenticated visitor to `/login?next=/operator` and 404s an
  authenticated non-operator, rather than revealing the Console exists.
  `pnpm ops:grant-operator <email>` (`scripts/grant-operator.ts`) is the only way to grant
  operator status — looks up the Supabase Auth user by email (refuses if none exists; it never
  creates accounts), prints which Supabase project it resolved, requires an interactive "yes"
  (the same confirmation step distinguishes dev from production, since it shows the real target
  URL — pointing it at production means exporting the production service-role key in the shell
  first, not a separate flag), then calls the idempotent `grantOperator`.
  `lib/dal/operator-events.ts` (`listEventsForOperator`, `getOperatorEventDetail`) is a DAL module
  deliberately separate from `lib/dal/events.ts` — no host-ownership predicate, since operator
  visibility is explicitly cross-host — and never selects a capture's `storage_path`/
  `display_path`/`thumbnail_path` or calls anything in `lib/media/storage.ts`: aggregate
  `count(*)`-shaped queries only, so there is no code path that can mint a capture's signed media
  URL from the Console (product.md §5.1.2). `app/(operator)/` (`/operator` list+search,
  `/operator/events/[eventId]` detail) is read-only this slice — no mutation, matching the
  roadmap's scope boundary (manual payment confirmation/refund is Slice 9). Payment state on the
  detail page reads only from `events.activated_at` and says so plainly ("payment records land in
  Slice 8/9") since the `payments` table doesn't exist yet — **superseded by the Slice 8 entry
  below**, the payments table now exists and this page reads it.
  **Regression fix, not new for this slice:** `pnpm dev:activate-event` (Slice 2) and the new
  `pnpm ops:grant-operator` both import modules marked `import "server-only"`; under plain
  `tsx`/`node` (no bundler) that marker package throws on import instead of no-op'ing the way it
  does inside Next's webpack build. Both `package.json` script entries now run
  `tsx --conditions=react-server`, which makes Node's conditional exports resolution pick
  `server-only`'s no-op `react-server` build instead of its default (throwing) one — the same
  condition Next's own server bundle effectively selects. This was a pre-existing defect in
  `dev:activate-event` (it would have thrown on any real invocation), caught while building the
  new script on the identical pattern, not introduced by this slice.
- **Provider payment, shared activation, and event signage (Slice 8, product.md §7.2/§11.3/§15,
  decisions D16/D17, architecture §8/§8a).** Migration `20260922020000_payments.sql` adds the
  source-agnostic `payments` table designed in architecture §4 — only the `source = 'provider'`
  fields are populated this slice; the manual fields are Slice 9. `lib/payments/paymongo-client.ts`
  is a thin fetch-based wrapper (no SDK) around PayMongo v2 Checkout Sessions: creates a session
  with `payment_method_types: ["gcash", "paymaya", "card"]` and `pass_on_fees: false` (so the
  disclosed price is the full amount charged, no separate fee line), and verifies the
  `Paymongo-Signature` header as HMAC-SHA256 of the **raw** request body against
  `PAYMONGO_WEBHOOK_SECRET`, timing-safe compared — confirmed against PayMongo's own go-live
  checklist and Checkout Session quick-start docs (`docs.paymongo.com`), not a third-party
  tutorial. `lib/payments/pricing.ts` holds the single launch price constant (₱999,
  `EVENT_PRICE_CENTAVOS = 99900`) the checkout page, the DAL, and the PayMongo request all read
  from — moving toward the ₱1,490 post-validation target later is a one-constant change.
  `lib/dal/payments.ts` holds `activateEvent(eventId, paymentId)` — the one place
  `event_token`/`gallery_token` are minted, via a single atomic `UPDATE events ... WHERE
  activated_at IS NULL RETURNING *` (decision D16, the same guard pattern as D5/D6/D13) — and
  `startProviderCheckout` (ownership-checked via `getEventForHost`, refuses for an
  already-activated event before ever calling PayMongo) and
  `recordProviderWebhookAndActivate` (matches a verified webhook delivery to its payment row by
  PayMongo checkout session id — never trusts webhook metadata for that — then calls
  `activateEvent`; a duplicate/replayed delivery is harmless because `activateEvent`'s guard, not
  the webhook-id claim step, is the actual source of the "activate exactly once" guarantee).
  `app/api/webhooks/paymongo/route.ts` reads the raw body before any parsing, verifies the
  signature first and rejects with 401 before doing anything else, then dispatches to the DAL.
  Checkout UI: the host dashboard's masthead shows "Pay ₱999 to activate" for a draft event,
  linking to `/events/[eventId]/checkout` (price/fee/total/refundability breakdown built from our
  own price constant, not derived from provider UI, per architecture §8) with a "Continue to
  payment" action (`startCheckoutAction`) that redirects the host's browser to PayMongo's hosted
  checkout URL; the checkout page also carries retry messaging for a cancelled or previously
  incomplete attempt. `success_url`/`cancel_url` are absolute, built server-side via
  `lib/http/base-url.ts` (reads the `host`/`x-forwarded-proto` request headers — the server-side
  equivalent of the `window.location.origin` pattern link-row.tsx already uses client-side).
  Activation itself never happens on the redirect return — only the webhook does that — so the
  post-redirect page shows a "confirming with PayMongo" note keyed off `?checkout=pending` and
  the existing `DashboardPoller` picks up the real state once the webhook lands.
  **Signage** (`lib/media/signage.ts`): four formats (`qr`, `table-card`, `poster`, `digital`),
  each a self-contained SVG with the QR code embedded as a data URI (via the `qrcode` package) —
  deliberately not rasterized through `sharp`, to avoid depending on system fonts being present
  in the serverless runtime for text rendering. Served by the host-authenticated
  `app/(host)/events/[eventId]/signage/[format]/route.ts`, which 404s unless the event is
  activated and has a real `event_token` (invariant 7: nothing to render before payment), and
  builds the encoded capture URL from the same `lib/http/base-url.ts` helper. Every format carries
  the event name, "Scan. You have five frames.", and "No app. No account." — no invitation editor,
  no template choices, matching product.md §11.3's bounded scope.
  **Operator Console read consistency (not new work, a required follow-on):** the Slice 7
  placeholder text ("payment records land in Slice 8/9") on the operator event detail page is now
  stale, since the `payments` table exists. `getOperatorEventDetail` (`lib/dal/operator-events.ts`)
  now also reads the event's latest payment row (still no mutation, still no capture media
  exposure) and the detail page shows the real source/status/amount when one exists — this keeps
  "provider and activation records remain internally consistent," one of this slice's own
  verification requirements, true from the operator's read-only vantage point too.
  **Double-charge safety follow-up (found during the user's own manual verification pass, not a
  pre-planned part of the slice):** the checkout page originally claimed retrying was "safe — it
  won't charge you twice," which was wrong — `activateEvent`'s guard prevents double
  *activation*, not a second real PayMongo charge if a host completes two checkouts while a first
  is still confirming. `lib/payments/pricing.ts` now has `getPendingPaymentState()`/
  `isPaymentLikelyStillConfirming()` (a `PENDING_PAYMENT_GRACE_MINUTES = 10` heuristic, pure and
  `now`-parameterized like `lib/events/lifecycle.ts`'s functions, so it can be called from a
  server component without a literal `Date.now()` in the render body — the lint config flags
  that). While a payment looks like it's still confirming, the dashboard masthead CTA changes
  from "Pay ₱999 to activate" to a de-emphasized "Payment pending confirmation" (still links to
  `/checkout`, never fully blocks the host), and the checkout page swaps its primary button for an
  honest warning ("Pay again anyway (may double-charge)") instead of the retryable-looking default
  styling. This never gates `startProviderCheckout` itself at the DAL level — a host can still
  always retry — it only changes what the UI encourages. Covered by
  `lib/payments/pricing.test.ts`.
  **Webhook signature verification was wrong and rejected every real delivery (found during the
  user's own manual verification — 8 failed retries visible in the PayMongo dashboard, no
  activation happened despite a completed test payment).** The original `verifyWebhookSignature`
  treated the `Paymongo-Signature` header as a bare hex digest and signed only the raw body.
  PayMongo's own docs never state the header's actual layout, so this was built from the general
  "HMAC-SHA256 the raw body" description alone — wrong. The real header is
  `t=<timestamp>,te=<test_signature>,li=<live_signature>`, and the signed string is
  `{timestamp}.{raw_body}`, confirmed against PayMongo's own official Node SDK source
  (`github.com/paymongo/paymongo-node`, `src/services/Webhook.js`,
  `WebhookService.prototype.constructEvent` — a first-party source, not a tutorial), which also
  clarified precedence: compare against `li` when present, else `te`. `verifyWebhookSignature`
  (`lib/payments/paymongo-client.ts`) now matches this exactly, and
  `lib/payments/paymongo-client.test.ts` was rewritten to construct real `t=/te=/li=` headers
  instead of a bare hex string, covering: correct test-mode signature, correct live-mode
  signature, live-mode precedence when both are present, tampered body, missing header,
  malformed header (too few parts), and wrong secret. **This has not yet been re-verified against
  a real PayMongo delivery** — the fix is local, unbuilt-and-undeployed as of this note; the next
  manual verification pass must confirm an actual webhook delivery now succeeds before Slice 8 is
  marked complete.
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
  open/close transitions including the "cannot reopen once the safety-net close has passed" rule,
  and (Slice 5) the gallery viewer excluding hidden/deleted captures while still showing a
  favorited one. `lib/dal/operators.integration.test.ts` (Slice 7) adds: an account with no
  `operators` row is not an operator; granting makes `isOperator` true for that account only;
  granting twice leaves exactly one row (idempotent). `lib/dal/operator-events.integration.test.ts`
  (Slice 7) adds: the event list spans multiple different hosts in one call, not just one; search
  matches by event name, host email, and event id; aggregate guest-session/capture counts are
  correct and scoped to the right event; the detail result never contains a storage path or
  signed-URL-shaped field, and `operator-events.ts` itself has no import of `lib/media/storage`;
  and an operator identity never satisfies the host-ownership predicate on another host's event.
  `lib/dal/events.integration.test.ts` adds: rotating either token immediately
  invalidates the old one and a lookup by it returns null; revoking clears the column so no token
  resolves; rotate/revoke on another host's event is refused and leaves the real tokens
  unchanged; rotate/revoke before activation is refused; and (Slice 6) a concurrent-join storm
  against a small cap never lets `guest_session_count` exceed `guest_session_cap` and the real
  row count matches exactly, a join attempted exactly at capacity is refused and creates no
  `guest_sessions` row, and a guest already joined stays unaffected once the event is at
  capacity. `lib/events/lifecycle.test.ts` adds unit coverage for `isGalleryRevealed()` across
  all three reveal modes, including the exact-instant boundary for `custom`, and for
  `hasReachedGuestCapacity()` below/at/above the cap. `lib/auth/guest-session-token.test.ts` —
  cookie signing round-trip, tamper rejection, cross-event rejection, wrong-secret rejection.
  `lib/dal/payments.integration.test.ts` (Slice 8) adds: a draft event has a null
  `event_token`/`gallery_token` (no distributable link before payment); `activateEvent` called
  twice directly returns identical tokens both times (idempotent under a race); a duplicate/
  replayed webhook delivery (same webhook event id, same checkout session) activates the event
  exactly once and leaves exactly one `payments` row with `provider_status = 'paid'`; a webhook
  for an unrecognized checkout session, and a non-`checkout_session.payment.paid` event type, are
  both ignored and never activate; `startProviderCheckout` refuses (without any network call) for
  another host's event and for an already-activated event; `getLatestPaymentForEvent` is
  ownership-scoped the same way every other host-facing DAL read is. Doesn't exercise the actual
  PayMongo network call — the ownership/already-activated refusals return before reaching it, and
  the webhook-processing path is tested by constructing payment rows directly, the way a real
  checkout would have left them, so the suite runs without needing real PayMongo credentials.
  `lib/payments/paymongo-client.test.ts` (Slice 8, unit) — `verifyWebhookSignature` accepts a
  correctly HMAC-signed body, rejects a tampered body against the original signature, a missing
  header, and a signature computed with the wrong secret; `parseWebhookEventPayload` extracts the
  event id/type/nested checkout session correctly and returns a null session for an unrelated
  event type.

## Verification status

- `pnpm typecheck` — passing.
- `pnpm lint` — passing, no errors or warnings.
- `pnpm build` — passing; `/e/[token]`, `/events/[eventId]`, `/g/[token]`, `/operator`, and
  `/operator/events/[eventId]` register as dynamic routes.
- `pnpm test` (Vitest) — 83/83 passing, including the Slice 5 gallery-viewer/link-rotation, Slice 6
  join-capacity, Slice 7 operator-authorization, and Slice 8 payment/activation integration tests
  above against the real dev database.
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
- **Slice 6 likewise has no device-dependent acceptance criteria** — the capacity mechanism is
  proven at the database level by the integration tests above (concurrent storm, exact-boundary
  refusal, unaffected existing sessions), and the join-screen calm state and trust-cue copy are
  ordinary server-rendered text with no device-specific behavior. Not clicked through in a
  browser for the same reason as Slice 4.
- **Slice 7 likewise has no device-dependent acceptance criteria** — it is a desktop/browser
  internal tool with no camera, upload, or in-app-browser surface. The authorization boundary
  (the part that actually matters — an unauthorized account must not reach the Console) is proven
  by the integration tests above against the real database, not by UI interaction. Not clicked
  through in a browser for the same reason as Slice 4; if convenient, a human sanity check is to
  sign in as a granted operator and confirm `/operator` lists events from more than one host, then
  sign in as an ordinary host and confirm `/operator` 404s.
- **Slice 8 is `awaiting human verification`.** The activation mechanism (idempotency, unpaid
  event exposing no link, webhook-replay safety, ownership boundary) is proven against the real
  database by the integration tests above — that part does not need manual verification. What
  does: the actual round trip through PayMongo's hosted checkout UI and a real webhook delivery,
  which needs the user's own PayMongo test-mode keys and this environment does not run browser
  automation (see the checklist below). `PAYMONGO_SECRET_KEY` and
  `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY` were provided by the user during this slice; `.env.local` was
  not read or modified by the assistant. `PAYMONGO_WEBHOOK_SECRET` still needs to be set once the
  user creates the webhook endpoint (checklist step 1 below) — until then, real webhook delivery
  cannot be verified end-to-end, only the handler's logic (tested above).

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

## Recommended (optional) manual check for Slice 5

Not a blocking exit condition — the roadmap's verification for this slice (gallery link before
reveal grants nothing, only-me visibility denies the link holder, rotated tokens stop working
immediately) is fully covered by the automated tests above, and this slice has no device-specific
acceptance criteria. If convenient, click through once in a browser as a sanity check:

1. On `/events/[eventId]` for an activated event, confirm the capture link and gallery link rows
   appear, "Copy link" copies a working absolute URL, and "Rotate"/"Revoke" update the shown link
   (or clear it) without a full page reload.
2. Set reveal to "Immediately," open the gallery link in a private/incognito window, and confirm
   captures appear. Switch visibility to "Only me" and confirm the same link now denies access.
3. Set reveal back to "After the event" with capture still open, and confirm the gallery link
   denies access until capture is closed.

## Manual verification checklist for Slice 8 exit condition

Not yet run. This is the minimum equivalent checklist — automated tests prove the activation
mechanism itself (idempotency, replay safety, ownership, unpaid-event has no link); these steps
prove the real PayMongo round trip, which needs the user's own test-mode account and cannot be
exercised by this environment (no browser automation).

1. **Register the test-mode webhook endpoint** in the PayMongo Dashboard (Developers → Webhooks,
   test mode) pointed at `https://five-frames.vercel.app/api/webhooks/paymongo`, subscribed to
   `checkout_session.payment.paid` only. Copy the signing secret it shows into `.env.local` and
   the Vercel Preview/Production env vars as `PAYMONGO_WEBHOOK_SECRET`, and set
   `PAYMONGO_SECRET_KEY`/`NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY` there too (already in `.env.local`
   locally, per the user).
   Expected: the endpoint shows as registered and enabled in the PayMongo dashboard.
2. **Full checkout, GCash test payment method** — on a draft event's `/events/[eventId]/checkout`
   page, confirm the price breakdown (₱999, "Included — nothing extra charged" fees, ₱999 total,
   refund policy line) renders, then "Continue to payment," complete a GCash test payment on
   PayMongo's hosted page.
   Expected: redirected back to `/events/[eventId]?checkout=pending` showing "confirming with
   PayMongo"; within a few seconds (webhook delivery), the page (via `DashboardPoller`) flips to
   showing the activated Links and Signage sections, exactly once — no duplicate activation, no
   duplicate `payments` row.
3. **Cancelled checkout** — start checkout again on a still-unpaid event, cancel on PayMongo's
   page instead of paying.
   Expected: redirected to `/events/[eventId]/checkout?checkout=cancelled` showing the
   cancellation notice; the event remains unactivated; "Continue to payment" is retryable without
   any corrupted state.
4. **Card and Maya test payments** — repeat step 2's happy path with PayMongo's test card number
   and with Maya, on two more draft events.
   Expected: same successful activation behavior as GCash.
5. **Signage download** — on the now-activated event from step 2, download all four signage
   formats (Printable QR, Table card, Poster, Digital/phone).
   Expected: each opens as a valid SVG image, encodes the real `/e/[event_token]` capture link
   (scanning the QR opens that link), and shows the event name, "Scan. You have five frames.",
   and "No app. No account."
6. **Another host cannot pay for or view this event's checkout/payment state** — sign in as a
   different host and attempt to open `/events/[eventId]/checkout` for the event from step 2.
   Expected: 404, same as any other host-scoped route for an event that host doesn't own.

Report pass/fail for each item and any error/screenshot. Failures are fixed within this slice per
the defect-to-regression policy before the slice is marked complete.

## Next slice

**Slice 8 — Provider payment, shared activation, and event signage** ([roadmap](./roadmap.md)).
Implemented, automated checks passing (`pnpm typecheck`/`lint`/`build`/`test` all green, 83/83
tests). Status: `awaiting human verification` — see the checklist immediately above. Once that
passes, Slice 8 is complete and **Slice 9 — Manual payment confirmation and refunds through the
Operator Console** ([roadmap](./roadmap.md)) is next; it reuses `activateEvent` unchanged and adds
the two Operator Console mutations the current read-only Console reserves space for.

## Blockers and open items

| Item | Type | Affects |
|---|---|---|
| Public gallery visual redesign (A24-anchored archive/immersive viewer) implemented 2026-09-22, automated checks passing — **awaiting human visual verification**, not yet accepted in design-direction.md | Design pass pending approval | `/g/[token]`, host link-row polish; see checklist in session handoff |
| Operator Console visual redesign (Shopify-admin-anchored list/detail, new `.operator-scope` tokens, reserved-but-inert manual-payment/refund zone) implemented 2026-09-22, automated checks passing — **awaiting human visual verification**, not yet accepted in design-direction.md. No mutation was implemented; Slice 9 still builds the real actions inside the reserved zone. | Design pass pending approval | `/operator`, `/operator/events/[eventId]`; see checklist in session handoff |
| Slice 8 (PayMongo checkout, webhook, signage) implemented 2026-09-22, automated checks passing — **awaiting human verification** of the real PayMongo round trip and webhook delivery (checklist above) | Manual verification pending | `/events/[eventId]/checkout`, `/api/webhooks/paymongo`, signage downloads |
| `PAYMONGO_WEBHOOK_SECRET` not yet set anywhere — the webhook endpoint must be created in the PayMongo dashboard first (checklist step 1) before this can be filled in and real webhook delivery verified | Setup step, part of the checklist above | `.env.local`, Vercel env vars |
| Vercel Production env currently points at the dev Supabase project (see note above) | Known interim state | Must be reconciled before real production payment work |
| Which specific individual(s) actually get the first operator grant, and when — the mechanism (`pnpm ops:grant-operator <email>`) exists as of Slice 7; only who to run it for and who holds the production service-role credential remain open (product.md §19) | Operational business decision | Pre-launch |
| No git remote configured | Setup | Any push/CI work |
| Service role key is the single highest-value secret; RLS does not constrain it | Security constraint | All slices |
| Safety-net close duration (48–72h) and expiry grace period (~30d) | Launch policy, from spec §19 | Slice 12 |
| Refund/retention/deletion legal copy | Business decision, from spec §19 | Pre-launch |
| 250-session / 1,250-capture launch capacity (`guest_session_cap`, now enforced) is a hypothesis to validate via load testing and early real events, not a fixed constant (product.md §9.5, §19; decision D13) | Launch policy, to revisit with real data | Beyond launch |
| Exact demo content/mechanism (bundled sample images vs. visitor's own device photo) | Open, left to design/implementation (product.md §19) | Slice 13 |
| Exact timing/criteria for moving launch price from ₱999 toward the ₱1,490 target | Business decision once early paid-event data exists (product.md §19) | Post-launch |
