# FiveFrames — Progress

Last updated: 2026-09-23 (Slice 8 complete; payment/activation/signage design pass awaiting human visual verification)

This file is current project state for a fresh implementation session, not a session log.
History and reasoning live in [docs/decisions.md](./decisions.md) (consequential decisions) and
git history (everything else). Update this file by rewriting it to match current reality, not by
appending narrative.

## Current phase

**Slices 1–8: complete.** Slice 8 (provider payment, shared activation, event signage) finished
end-to-end verification 2026-09-22, across two passes. First pass: the user completed real
PayMongo test-mode checkouts against the deployed app, and the real webhook deliveries, payment
records, and activation were inspected directly in the dev database — a wrong webhook signature
format and misleading double-charge copy were found and fixed. That verification also surfaced a
real double-payment case (two distinct real PayMongo checkout sessions for one event both reached
"paid") — `activateEvent` correctly activated the event only once, but the host could still be
charged twice by the provider, a genuine payment-correctness defect, not a UI-copy issue. Second
pass fixed the root cause (see "Regression protection" below): an unpaid event can now have at
most one active PayMongo Checkout Session at a time, enforced at the database level, with reuse,
provider-request idempotency, explicit session expiry on replacement, and defensive
`paid_duplicate` flagging for the residual case where a genuinely distinct payment still lands
after activation. Redeployed and re-verified against a fresh real PayMongo test-mode checkout,
confirmed via direct database inspection: exactly one payment row, `provider_status = "paid"`,
`events.activating_payment_id` pointing at that same payment, `capture_opened_at` still null.
Nothing about Slices 1–7 changed in this pass.

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
- **Roadmap** ([roadmap.md](./roadmap.md)) — Slices 1–8 complete; Slice 9 (manual payment/refunds
  through the Operator Console) is next.
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
  fields are populated this slice; the manual fields are Slice 9. Migration
  `20260922030000_payment_session_integrity.sql` (added during this slice's own real-verification
  pass, see "Regression protection" below) adds `payments.checkout_url`,
  `events.activating_payment_id`, the `payments_one_active_provider_checkout_idx` partial unique
  index, and the `begin_provider_checkout()` Postgres function.
  `lib/payments/paymongo-client.ts` is a thin fetch-based wrapper (no SDK) around PayMongo's
  Checkout Sessions API: creates a session (`POST /v2/checkout_sessions`, `payment_method_types:
  ["gcash", "paymaya", "card"]`, `pass_on_fees: false` so the disclosed price is the full amount
  charged with no separate fee line, an `Idempotency-Key` per PayMongo's own supported mechanism),
  reads a session's live status (`GET /v1/checkout_sessions/{id}`) and explicitly expires one
  (`POST /v1/checkout_sessions/{id}/expire`), and verifies the `Paymongo-Signature` header as
  HMAC-SHA256 of `{timestamp}.{raw_body}` (not the raw body alone — the header is
  `t=<timestamp>,te=<test_sig>,li=<live_sig>`, confirmed against PayMongo's own official Node SDK
  source, not prose docs — see "Regression protection") against `PAYMONGO_WEBHOOK_SECRET`,
  timing-safe compared. `lib/payments/pricing.ts` holds the single launch price constant (₱999,
  `EVENT_PRICE_CENTAVOS = 99900`) the checkout page, the DAL, and the PayMongo request all read
  from, plus `hasPendingProviderPayment()` for the checkout-page/dashboard's informational
  "payment in progress" copy.
  `lib/dal/payments.ts` holds `activateEvent(eventId, paymentId)` — the one place
  `event_token`/`gallery_token` are minted, via a single atomic `UPDATE events ... WHERE
  activated_at IS NULL RETURNING *` that also stamps `activating_payment_id` in the same statement
  (decision D16, the same guard pattern as D5/D6/D13), returning `activatedByThisCall` so a caller
  can tell "I activated it" from "someone else already did," and best-effort superseding any other
  still-`pending` provider session for the event once activation happens — and `startProviderCheckout`
  (ownership-checked via `getEventForHost`; calls `begin_provider_checkout()` to atomically reuse an
  existing pending session, create a fresh one, or refuse for an already-activated event, then
  re-verifies a reused session's live PayMongo status before handing it back, replacing it if
  PayMongo itself reports it expired) and `recordProviderWebhookAndActivate` (matches a verified
  webhook delivery to its payment row by PayMongo checkout session id — never trusts webhook
  metadata for that — then calls `activateEvent`; flags a genuinely distinct payment that reaches
  "paid" after a different payment already activated the event as `provider_status =
  "paid_duplicate"` rather than silently accepting it, surfaced in the Operator Console for manual
  refund follow-up per product.md §15.1, no automatic refund invented). A duplicate/replayed
  delivery for the *same* payment is harmless because `activateEvent`'s atomic guard, not the
  webhook-id claim step, is the actual source of the "activate exactly once" guarantee.
  `app/api/webhooks/paymongo/route.ts` reads the raw body before any parsing, verifies the
  signature first and rejects with 401 before doing anything else, then dispatches to the DAL.
  Checkout UI: the host dashboard's masthead shows "Pay ₱999 to activate" for a draft event (or a
  de-emphasized "Payment pending confirmation" while one's already in progress — informational
  only, never a warning, since continuing always resolves to the same reused session), linking to
  `/events/[eventId]/checkout` (price/fee/total/refundability breakdown built from our own price
  constant, not derived from provider UI, per architecture §8) with a "Continue to payment" action
  (`startCheckoutAction`) that redirects the host's browser to PayMongo's hosted checkout URL — the
  same URL whether this is a fresh attempt or a reuse of an in-progress one; the checkout page also
  carries retry messaging for a cancelled attempt. `success_url`/`cancel_url` are absolute, built
  server-side via `lib/http/base-url.ts` (reads the `host`/`x-forwarded-proto` request headers —
  the server-side equivalent of the `window.location.origin` pattern link-row.tsx already uses
  client-side). Activation itself never happens on the redirect return — only the webhook does
  that, and `cancel_url` is understood as only a browser redirect, never a session cancellation —
  so the post-redirect page shows a "confirming with PayMongo" note keyed off `?checkout=pending`
  and the existing `DashboardPoller` picks up the real state once the webhook lands.
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
  now reads **every** payment row for the event, not just the latest (still no mutation, still no
  capture media exposure), and the detail page lists each one's source/status/amount, with a
  distinct callout when any is `paid_duplicate` (added during the same-slice root-cause fix below)
  — this keeps "provider and activation records remain internally consistent," one of this
  slice's own verification requirements, true from the operator's read-only vantage point too.
  **Double-charge UI copy (superseded — see the root-cause fix under "Regression protection"
  below):** an earlier response to the double-payment defect added a time-based "may
  double-charge" warning to the checkout page instead of fixing why a second live session could
  exist at all. Once the actual root cause was fixed (an event can now have at most one active
  Checkout Session, so retrying always reuses it rather than risking a second charge), that
  warning was removed as no longer accurate — replaced by `hasPendingProviderPayment()`, a plain
  informational "payment in progress" state with no time heuristic.
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
  twice directly is idempotent under a race, returns identical tokens both times, and reports
  `activatedByThisCall` correctly for the winner vs. the no-op; a duplicate/replayed webhook
  delivery (same webhook event id, same checkout session) activates the event exactly once and
  leaves exactly one `payments` row with `provider_status = 'paid'`; a webhook for an unrecognized
  checkout session, and a non-`checkout_session.payment.paid` event type, are both ignored and
  never activate; `startProviderCheckout` refuses (without any network call) for another host's
  event and for an already-activated event; `getLatestPaymentForEvent` is ownership-scoped the
  same way every other host-facing DAL read is. **Added during this slice's real-verification
  pass (root-cause fix for the double-payment defect, see "Regression protection"):** a repeated
  `begin_provider_checkout` call reuses the same pending payment/session; 8 concurrent calls for
  one event produce exactly one winner and exactly one `pending` provider payment row; the
  function refuses to create a new session once activated; two live `pending` provider payment
  rows for one event are refused outright by the new unique index; activation supersedes a
  still-pending sibling provider session; a genuinely distinct payment reaching "paid" after a
  different payment already activated the event is recorded `paid_duplicate`, not silently
  accepted, with exactly-once activation still holding. Doesn't exercise the actual PayMongo
  network call for session creation — the ownership/already-activated/concurrency paths are all
  provable at the database level, and the webhook-processing path is tested by constructing
  payment rows directly, the way a real checkout would have left them — so the suite runs without
  needing real PayMongo credentials (the one exception, `expireCheckoutSession`'s best-effort call
  inside the supersede test, is caught and harmless either way, with or without credentials
  configured).
  `lib/payments/paymongo-client.test.ts` (Slice 8, unit) — `verifyWebhookSignature` accepts a
  correctly signed `t=/te=/li=` header in both test- and live-mode form, prefers live-mode when
  both are present, rejects a tampered body, a missing header, a malformed header, and a signature
  computed with the wrong secret; `parseWebhookEventPayload` extracts the event id/type/nested
  checkout session correctly and returns a null session for an unrelated event type.
  `lib/payments/pricing.test.ts` (Slice 8, unit) — `hasPendingProviderPayment()` across no
  payment / paid / pending. `lib/media/signage.test.ts` (Slice 8, unit) — all four formats carry
  the required product.md §11.3 copy, the QR embeds the real per-event capture link (not a
  placeholder), XML-unsafe characters in the event name are escaped, and each format has a
  distinct layout.

## Verification status

- `pnpm typecheck` — passing.
- `pnpm lint` — passing, no errors or warnings.
- `pnpm build` — passing; `/e/[token]`, `/events/[eventId]`, `/g/[token]`, `/operator`, and
  `/operator/events/[eventId]` register as dynamic routes.
- `pnpm test` (Vitest) — 95/95 passing, including the Slice 5 gallery-viewer/link-rotation, Slice 6
  join-capacity, Slice 7 operator-authorization, and Slice 8 payment/activation/signage integration
  and unit tests above against the real dev database.
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
- **Slice 8 real end-to-end verification — passed, 2026-09-22.** The user completed real PayMongo
  test-mode checkouts against the deployed app (`https://five-frames.vercel.app`) and registered
  the test-mode webhook (`checkout_session.payment.paid` → `/api/webhooks/paymongo`). This
  environment does not run browser automation, so the assistant could not drive the checkout UI
  itself; instead, the resulting database state was inspected directly (read-only) in the dev
  Postgres project to confirm the real flow actually worked, not just the simulated integration
  tests. What was observed for event `Ezia's Birthday`:
  - Three real checkout sessions existed for the event. One (`cs_c77f...`) stayed `pending` —
    an abandoned/incomplete attempt that correctly never activated anything and left no token.
  - Two (`cs_fd21...`, `cs_7fd7...`) reached `provider_status = "paid"`, each with a distinct real
    `provider_webhook_event_id` from PayMongo and a real `fee_amount` (2498 centavos) parsed out
    of the webhook payload — confirming `verifyWebhookSignature` accepted a real delivery,
    `parseWebhookEventPayload` correctly read the real envelope shape, and the payment row was
    persisted with real provider data, not placeholder values.
  - This was a genuine **double payment** (two distinct real charges for one event, not a replay
    of one) — `activateEvent`'s guard correctly activated the event only once (`activated_at`,
    `event_token`, `gallery_token` held a single, consistent value across both webhook
    deliveries), but the host could still have been charged twice by the provider, since nothing
    yet stopped a second live Checkout Session from existing. This is the payment-correctness
    defect fixed in the second verification pass below — see "Regression protection."
  - `capture_opened_at` was still `null` on the activated event — payment activates the event but
    does not open guest capture (product.md §7.3), confirmed against real data, not just derived
    logic.
  - The activation timestamp (13:00:20) was clearly after the matching webhook delivery's
    `updated_at` (13:00:19), not immediately after the browser's checkout redirect — consistent
    with activation being webhook-driven, never redirect-driven (architecture §8); nothing in the
    redirect/return code path touches the database at all, so this is also a structural guarantee,
    not just a timing coincidence.
  - Real fee data and PayMongo's real event/checkout-session id formats validated an assumption
    that had been unverifiable from documentation alone (PayMongo's docs never fully specified the
    webhook envelope or the `Paymongo-Signature` header format — see the regression note below).
- **Slice 8 root-cause fix, redeployed and re-verified against a fresh real PayMongo checkout —
  passed, 2026-09-22.** After the one-active-session mechanism (migration
  `20260922030000_payment_session_integrity.sql`, see "Regression protection" below) was
  implemented and the automated suite passed, the app was redeployed to
  `https://five-frames.vercel.app` (`vercel deploy --prod`) and the user completed one more real
  PayMongo test-mode checkout, for a new event ("Matty's Birthday"). The resulting database state
  was inspected directly: exactly **one** `payments` row for the event, `provider_status =
  "paid"`, a real webhook event id and fee amount; `events.activating_payment_id` pointed at that
  same payment's id (the new column, confirming the new mechanism actually engaged for this real
  checkout, not just in tests); `capture_opened_at` still `null`. No second checkout session or
  payment row was created for this event at any point. This confirms the fix holds against the
  real provider, not just the simulated integration suite.

## Regression protection added for human-found defects

One defect was caught by the integration tests themselves during implementation, before reaching
a human: the first version of `commitCapture` only checked the `status` column for "expired," but
that column is only updated lazily inside `reserve_capture()`, so a reservation whose TTL had
lapsed without a subsequent reserve call could still pass commit's gate. Fixed by having
`commitCapture` check `expires_at` directly against the current time, not just `status`. Covered
by "refuses to commit a lapsed reservation" in `lib/dal/captures.integration.test.ts`. No defects
were found during human verification for Slices 1–7.

**Slice 8, found during the user's own manual verification pass (two real defects):**

1. **Webhook signature verification rejected every real delivery.** The original
   `verifyWebhookSignature` (`lib/payments/paymongo-client.ts`) treated the `Paymongo-Signature`
   header as a bare hex digest and HMAC-signed only the raw body — built from PayMongo's docs
   describing the general "HMAC-SHA256 the raw body" idea, which never states the header's actual
   layout. The user's PayMongo dashboard showed 8 failed delivery retries and no activation
   despite a completed test payment. **Root cause, confirmed against PayMongo's own official
   Node SDK source** (`github.com/paymongo/paymongo-node`, `src/services/Webhook.js`,
   `WebhookService.prototype.constructEvent` — a first-party source, not a tutorial): the header
   is actually `t=<timestamp>,te=<test_signature>,li=<live_signature>`, and the signed string is
   `{timestamp}.{raw_body}`, comparing against `li` when present else `te`. Fixed to match exactly.
   **Failure class:** a provider-integration detail inferred from prose documentation instead of
   an authoritative schema/source, for a security-relevant check (signature verification) — this
   class is worth watching for in any future provider webhook integration, not just PayMongo.
   **Regression coverage:** `lib/payments/paymongo-client.test.ts` was rewritten to construct real
   `t=/te=/li=` headers (previously it constructed a bare hex string, which would have kept
   passing against the old, wrong implementation without ever catching this) and covers correct
   test-mode signature, correct live-mode signature, live-mode precedence when both are present,
   tampered body, missing header, malformed header, and wrong secret. **Confirmed fixed against a
   real PayMongo delivery** — see "Verification status" above.
2. **An unpaid event could have more than one live, payable PayMongo Checkout Session — a real
   payment-correctness defect, not a UI-copy issue.** The user's own real PayMongo test-mode
   verification produced two distinct Checkout Sessions for one event, both successfully paid.
   `activateEvent`'s guard correctly activated the event only once, but the host could still be
   charged twice by the provider — the initial response to this (checkout-page copy claiming
   retrying was "safe — it won't charge you twice," and a UI-only "may double-charge" warning) was
   a band-aid on the symptom, explicitly superseded by the root-cause fix below once the user
   called that out.
   **Root cause:** nothing prevented `startProviderCheckout` from creating a second live session
   for an event that already had one still `pending`, and the `cancel_url` a host's browser
   redirects to on "Cancel" is only a browser redirect — it never expires the session at
   PayMongo, so an abandoned or cancelled attempt's session stayed genuinely payable.
   **Fix (migration `20260922030000_payment_session_integrity.sql`):** an unpaid event can now
   have at most one active (`pending`) provider Checkout Session, enforced at the database level
   via `payments_one_active_provider_checkout_idx` (a partial unique index on `payments(event_id)
   where source = 'provider' and provider_status = 'pending'` — the same DB-enforced-limit
   philosophy as the frame-slot and guest-capacity guards, D5/D6/D13) plus a new
   `begin_provider_checkout()` Postgres function (same row-lock-then-decide shape as
   `reserve_capture()`) that atomically decides, per event, whether a `startProviderCheckout` call
   reserves a fresh session or must reuse the existing one — serializing concurrent tabs/
   double-clicks so only one caller ever creates a real PayMongo session. Reuse re-verifies the
   session's live status with PayMongo directly (`getCheckoutSessionStatus`) rather than assuming
   a `pending` row stays payable indefinitely (PayMongo's docs don't state whether sessions
   auto-expire); a genuinely expired session is explicitly expired via PayMongo's own `/expire`
   endpoint and superseded, then replaced. Checkout-session creation also carries an
   `Idempotency-Key` (PayMongo's own supported mechanism, `docs.paymongo.com/reference/
   idempotent-requests`) as a second, independent layer against a network-retry creating a
   duplicate session. Once an event activates, `activateEvent` stamps `events.
   activating_payment_id` in the same atomic statement (race-free) and best-effort supersedes any
   other still-`pending` provider session for that event via the same expire endpoint — "no new
   checkout may be created once paid, and any obsolete one is expired where practical," the exact
   behavior requested. A second, genuinely distinct payment that still reaches "paid" after
   activation (the residual case the DB constraint can't reach — e.g. a cross-source race once
   Slice 9's manual-payment path exists) is recorded as `payments.provider_status =
   "paid_duplicate"`, not silently treated as a second normal success, and surfaced in the
   Operator Console (every payment row for the event, not just the latest) for manual refund
   follow-up per product.md §15.1 — no automatic refund is invented, matching the product spec.
   **Failure class:** an external side-effect (a real charge) triggered by a retryable action
   needs the *retry itself* to be structurally incapable of duplicating the side effect — a UI
   warning discouraging the retry is not a substitute, because the human (or a script, or an
   impatient double-click) can always do it anyway. Worth watching for in any flow that lets a
   user retry an action which triggers a real-world side effect at a third party (a charge, an
   email send, an SMS, an external webhook fired).
   **Regression coverage (`lib/dal/payments.integration.test.ts`, all against the real dev
   database):** a repeated `begin_provider_checkout` call reuses the same pending payment/session
   rather than creating a second; 8 concurrent calls for the same event produce exactly one
   winner and exactly one `pending` provider payment row; the function refuses to create a new
   session once the event is activated; two live `pending` provider payment rows for one event
   are refused outright by the unique index (proving the old incident is now structurally
   impossible); activation supersedes a still-pending sibling provider session; and a genuinely
   distinct payment reaching "paid" after a different payment already activated the event is
   recorded `paid_duplicate`, not silently accepted, with the exactly-once-activation guarantee
   still holding. `lib/payments/pricing.ts` was simplified — the time-based "likely still
   confirming" heuristic (and its warning copy) was removed entirely now that duplicate sessions
   are structurally prevented, replaced by a plain `hasPendingProviderPayment()` used only for
   informational ("payment in progress") UI, covered by `lib/payments/pricing.test.ts`.
   **Confirmed fixed against a real PayMongo delivery** after redeploying — see "Verification
   status" above for the fresh real checkout observed directly in the database (one payment row,
   `provider_status = "paid"`, `activating_payment_id` pointing at that same payment).

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

## Slice 8 exit-condition verification — result, 2026-09-22

The user completed real PayMongo test-mode checkouts against the deployed app and registered the
test-mode webhook; the assistant then inspected the resulting database state directly (this
environment does not run browser automation, so it could not drive the checkout UI itself). What
was directly confirmed against real data vs. what rests on automated tests / structural code
guarantees, honestly separated:

**Directly confirmed against real PayMongo test-mode data (not simulated):**
- Webhook registered and enabled, subscribed to `checkout_session.payment.paid`, pointed at
  `/api/webhooks/paymongo`.
- A real checkout completed, a real webhook delivered, the signature verified successfully (after
  the format fix above), the payment row persisted with real provider data (checkout session id,
  webhook event id, fee amount), and the event activated exactly once — including under a genuine
  double-payment case (see "Verification status" above for the full account).
- Activation only happens once the webhook lands, never at the browser redirect — confirmed by the
  real timestamps, not just code inspection.
- `capture_opened_at` stayed `null` after activation — payment activates the event, never opens
  capture.

**Covered by automated tests and structural code guarantees, not separately clicked through in a
browser this pass** — the same tier already accepted for Slices 4/6/7 (ordinary web UI/authorization
behavior with no camera/device-dependent surface, so automated coverage is sufficient without a
manual click-through):
- Cancelled/incomplete checkout leaves the event inactive and retryable: the cancel route makes no
  database writes at all (code-structural guarantee), and the real abandoned `pending` payment row
  observed above never activated anything, consistent with this.
- All four signage formats render the required copy and the real per-event capture link: proven
  by the new `lib/media/signage.test.ts`, not opened in a browser.
- Another host cannot pay for or view this event's checkout: proven by
  `lib/dal/payments.integration.test.ts`'s ownership tests (`startProviderCheckout`/
  `getLatestPaymentForEvent` both refuse for a non-owning host) against the real database.

No other failures were found in what was verified. Three real defects surfaced across this real
verification (wrong webhook signature format, a genuine double-live-Checkout-Session
payment-correctness defect, and the double-charge UI copy that was an inadequate first response
to it) are recorded under "Regression protection" above, all fixed at the root cause, covered by
new automated tests, and confirmed fixed against real subsequent PayMongo deliveries — including a
second real checkout after the root-cause fix specifically to re-verify it.

## Next slice

**Slice 8 — Provider payment, shared activation, and event signage: complete.** Automated checks
passing (`pnpm typecheck`/`lint`/`build`/`test` all green, 95/95 tests) and real end-to-end
verification passed 2026-09-22 (see "Verification status" and the exit-condition section above).

**Slice 9 — Manual payment confirmation and refunds through the Operator Console**
([roadmap](./roadmap.md)) is next; it reuses `activateEvent` unchanged and adds the two Operator
Console mutations the current read-only Console reserves space for. Not started.

## Blockers and open items

| Item | Type | Affects |
|---|---|---|
| Public gallery visual redesign (A24-anchored archive/immersive viewer) implemented 2026-09-22, automated checks passing — **awaiting human visual verification**, not yet accepted in design-direction.md | Design pass pending approval | `/g/[token]`, host link-row polish; see checklist in session handoff |
| Operator Console visual redesign (Shopify-admin-anchored list/detail, new `.operator-scope` tokens, reserved-but-inert manual-payment/refund zone) implemented 2026-09-22, automated checks passing — **awaiting human visual verification**, not yet accepted in design-direction.md. No mutation was implemented; Slice 9 still builds the real actions inside the reserved zone. | Design pass pending approval | `/operator`, `/operator/events/[eventId]`; see checklist in session handoff |
| Payment/activation/signage visual redesign (checkout "what you get" panel, state-differentiated payment banners, post-activation "capture stays closed" reassurance, signage rebuilt with the host palette and a viewfinder-corner photo-object motif) implemented 2026-09-23, automated checks passing (`typecheck`/`lint`/`test`/`build` all green) — **awaiting human visual verification**, not yet accepted in design-direction.md. No payment semantics, pricing, or activation logic changed. | Design pass pending approval | `/events/[eventId]/checkout`, `/events/[eventId]`, `/events/[eventId]/signage/[format]`; see checklist in session handoff |
| Vercel Production env currently points at the dev Supabase project (see note above) | Known interim state | Must be reconciled before real production payment work |
| Which specific individual(s) actually get the first operator grant, and when — the mechanism (`pnpm ops:grant-operator <email>`) exists as of Slice 7; only who to run it for and who holds the production service-role credential remain open (product.md §19) | Operational business decision | Pre-launch |
| No git remote configured | Setup | Any push/CI work |
| Service role key is the single highest-value secret; RLS does not constrain it | Security constraint | All slices |
| Safety-net close duration (48–72h) and expiry grace period (~30d) | Launch policy, from spec §19 | Slice 12 |
| Refund/retention/deletion legal copy | Business decision, from spec §19 | Pre-launch |
| 250-session / 1,250-capture launch capacity (`guest_session_cap`, now enforced) is a hypothesis to validate via load testing and early real events, not a fixed constant (product.md §9.5, §19; decision D13) | Launch policy, to revisit with real data | Beyond launch |
| Exact demo content/mechanism (bundled sample images vs. visitor's own device photo) | Open, left to design/implementation (product.md §19) | Slice 13 |
| Exact timing/criteria for moving launch price from ₱999 toward the ₱1,490 target | Business decision once early paid-event data exists (product.md §19) | Post-launch |
