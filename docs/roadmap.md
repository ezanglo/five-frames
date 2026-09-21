# FiveFrames — Implementation Roadmap

Vertical slices, each delivering observable capability. Acceptance criteria numbers refer to
[docs/product.md §20](./product.md) as renumbered for the five-photo, no-video MVP.

> **Reconciled 2026-09-22** against the product-spec update covering the pre-purchase demo,
> launch pricing, event capacity, signage, and guest trust cues. Slices 1–5 are unchanged and
> complete. Slices 6–10 below are renumbered to 6–12 to make room for two new slices (capacity
> enforcement, and the public demo); none of them had started, so this is not a reopening of
> completed work.

Ordering logic: the frame-limit mechanism and upload reliability carry the most technical risk,
so they are built and proven early — before payment, using an event activated directly in the
development database. The activation gate itself is real from the first slice, so payment later
plugs into it rather than changing it.

**Device risk is front-loaded.** In-app browser and real-device behavior is validated inside the
first capture slice, not saved for a final QA pass. Discovering there that Messenger's browser
breaks the file picker is a design input; discovering it at the end is a rewrite.

Each slice decides its own implementation details when it starts. This document says **what**,
not **how**.

---

## Slice 1 — Host account and draft event

**Objective:** A host can sign up, sign in, and create and configure a draft event.

- Supabase project provisioned (`ap-southeast-1`), migrations workflow established.
- `hosts`, `events` schema; RLS deny-all enabled.
- DAL skeleton with ownership predicates and `import 'server-only'`.
- Host auth via Supabase Auth; protected `(host)` route group.
- Event configuration: name, date, timezone, host message, reveal timing, visibility, sharing
  toggle, hashtag.

**Criteria:** 18 (partial — ownership scoping exists from the start)
**Verification:** Typecheck, lint. Unit tests on lifecycle state derivation. A second host
account cannot load the first host's event.

---

## Slice 2 — Guest join and photo capture *(highest technical risk)*

**Status: complete.** See [progress.md](./progress.md) for verification results.

**Objective:** A guest opens an event link, enters a display name, and commits photos against a
server-authoritative allowance of five — proven on real devices, including in-app browsers.

- Guest session cookie and `guest_sessions` table.
- `captures` table: `slot_index` 0–4 check constraint, partial unique index on
  `(guest_session_id, slot_index)`, unique index on `(guest_session_id, reserve_key)`.
- Client-generated `reserve_key`, persisted before the first reserve request so it survives a
  reload mid-attempt; duplicate confirms and retries reuse it (decision D6).
- Defined reserve/commit responses for an existing key by status — `pending` returns the same row,
  `committed` returns success, `expired` is terminal and commit on it is refused.
- Reserve → direct upload to Supabase Storage via signed upload URL → commit.
- Capture gate: paid/active/capture-open re-checked on reserve **and** commit.
- Guest UI: 5 photo slots, preview, optional message, explicit confirm.
- Display/thumbnail derivatives; originals untouched.
- Development-seeded active event stands in for payment.

**Early device validation — an exit condition for this slice, not a later task:**
- Camera and photo-library picker on current iPhone Safari and Android Chrome.
- The same flow inside Facebook, Messenger, and Instagram in-app browsers.
- One interrupted upload on a genuinely weak connection.
- HEIC behavior on a real iPhone, answering the spec's open question about conversion.

**Criteria:** 1, 2, 3, 4, 5, 6, 8, 10, 21 (partial), and the in-app-browser portion of 25
**Verification:** Integration tests against real Postgres — concurrent reserve storms, two
concurrent reserves sharing one `reserve_key` consuming exactly one slot, retry after failure
producing exactly one capture, abandoned reservation expiry freeing the slot, a retry arriving
after its reservation expired being reported as lapsed rather than silently taking a second slot,
and commit being refused for a lapsed reservation. These are the tests
that matter most in the project. Plus the device checks above, run by hand.

---

## Slice 3 — Guest's own view and network resilience

**Status: complete.** See [progress.md](./progress.md) for verification results.

**Objective:** A returning guest sees their remaining frames and their own captures, and bad
networks do not cost them frames.

- Private per-session view with download of own captures.
- Retry, resume, and reconnect behavior; calm error states.
- Resumable (TUS) upload path for large files, threshold set from slice 2's real-device findings.
- Calm states for "not open yet" and "capture has ended".

**Criteria:** 3, 6, 7, 16 (guest half)
**Verification:** Interrupted upload leaves the frame available. Reload mid-upload yields a
consistent state — committed or available, never both.

---

## Slice 4 — Host dashboard and moderation

**Objective:** A host sees their event's captures and can moderate them.

- Dashboard: lifecycle state, capture open/close control, session and photo counts.
- Gallery grid with hide, unhide, delete, favorite.
- Moderation reflected in the guest's own view.
- Polling for updates.

**Criteria:** 11 (manual close), 22, 24
**Verification:** Counts correct without realtime. Hidden and deleted captures disappear from
the guest view. Moderation never restores a frame.

---

## Slice 5 — Gallery reveal, gallery link, visibility

**Objective:** The gallery becomes viewable on the host's terms, through a separate link.

- Reveal timing: after-event default and immediate (custom time is MVP-optional).
- Separate `gallery_token` and `(gallery)` route group.
- Visibility: anyone-with-link / only-me.
- Token rotation and revocation for both links.

**Criteria:** 14, 15, 16, 17
**Verification:** Gallery link before reveal grants nothing. Only-me visibility denies the link
holder. Rotated tokens stop working immediately.

**Status: complete.** See [progress.md](./progress.md) for verification results.

---

## Slice 6 — Event join capacity enforcement and guest trust cues

**Objective:** An event cannot grow past its launch-capacity boundary under concurrent joins, and
the guest join screen states the trust cues the product now requires up front.

- `guest_session_cap` / `guest_session_count` columns on `events` (decision D13); the guest-join
  DAL path performs the atomic guarded increment in the same transaction as the `guest_sessions`
  insert, mirroring the reserve/commit pattern already used for frames.
- Calm "this event is currently full" state on the join screen when the cap is reached — not an
  error, and does not affect guests already joined.
- Host-visible session count vs. cap on the dashboard (reads the two new columns alongside the
  existing counts it already shows — no new query shape).
- Guest join screen states, briefly: no app required, no account required, captures follow this
  event's own access rules (product.md §4 principle 9).

**Why this is its own slice:** it is a small, self-contained concurrency mechanism with its own
correctness risk (same class of race the frame mechanism guards against), independent of payment
logic. Landing it before Slice 7 means the join path it touches settles once rather than getting
modified again immediately after payment work lands on the same files.

**Criteria:** 9 (join trust-cue portion), 15
**Verification:** Integration test — concurrent joins at the boundary never push `guest_session_count`
past `guest_session_cap`; a join attempted exactly at capacity is refused and creates no
`guest_sessions` row; guests already joined before the cap was reached are unaffected.

**Status: complete.** See [progress.md](./progress.md) for verification results.

---

## Slice 7 — Payment, activation, and event signage

**Objective:** Payment activates the event, issues the link and printable QR, and the host can
obtain the event's signage set.

- PayMongo Checkout Session with GCash, Maya, cards.
- Price breakdown — event price, fees, total, refundability — shown before redirect. Uses the
  launch price hypothesis (₱999; product.md §15) as the current event price; not hardcoded in a
  way that blocks moving toward the ₱1,490 post-validation target later.
- Webhook-driven activation: `checkout_session.payment.paid`, `Paymongo-Signature` verified,
  idempotent by provider event id.
- Separate test-mode and live-mode webhook endpoints and secrets.
- `event_token` and `gallery_token` issued on activation; printable QR output.
- Event signage (product.md §11.3): printable QR, table card, poster, and digital/phone-screen
  formats, rendered from the same `event_token` issued on activation — each carrying event name,
  a short guest instruction, and "No app. No account." (architecture §8).

**Criteria:** 10, 13, 14, 28
**Dependencies:** PayMongo account with KYC completed.
**Verification:** Unpaid event has no working link. Failed payment leaves the event retryable.
Replayed webhook activates once. Unsigned or wrongly-signed webhook is rejected. All four signage
formats render for an activated event and show the required copy.

---

## Slice 8 — Sharing and share cards

**Objective:** A guest shares a branded card of their own photo, subject to the host's setting.

- Share-card generation: photo plus event name, date, hashtag, message, branding.
- Web Share API with image-download fallback.
- Host sharing toggle respected.

**Criteria:** 22, 23, 24
**Verification:** Pre-reveal share exposes neither the gallery nor any other guest's capture.
Original media unmodified.

---

## Slice 9 — Downloads

**Objective:** The host can retrieve their media.

- Individual capture download via signed URL.
- Bulk download of originals (sequential signed URLs — see decision D11).

**Criteria:** 26
**Verification:** Every committed original is retrievable. Downloads work for a host whose event
has expired but is within the grace period.

---

## Slice 10 — Lifecycle automation and retention

**Objective:** The event closes, expires, and is deleted on schedule without manual work.

- Safety-net automatic capture close (derived; cron materializes for display).
- Expiry at ~12 months, advance warning to the host.
- Grace period with downloads intact, then permanent deletion.
- Vercel Cron jobs; reservation TTL sweep.

**Criteria:** 12 (automatic close)
**Verification:** Capture is refused past the safety-net deadline even with no cron run.
Deletion removes originals and all derivatives from Supabase Storage.

---

## Slice 11 — Public pre-purchase demo

**Objective:** A prospective host can try the five-frame capture mechanic and see a resulting
sample gallery without paying, without an account, and without creating anything real.

- Client-only `(demo)/demo` route (decision D14): sample images or a visitor-picked photo held as
  an in-browser object URL, never uploaded. No DAL call, no DB row, no token minted.
- Locally-rendered sample gallery view reusing the guest capture UI's visual language.
- Everything produced by the demo is unambiguously marked as a demo and cannot function as a real
  capture or gallery link (product.md §7.1).

**Why last before device validation, not earlier:** the demo is independent of every other slice —
it shares no server code path with payment, capacity, or moderation — but it reuses the guest
capture UI's look and feel, so building it after that UI has settled (rather than in parallel with
slices still changing it) avoids rework.

**Criteria:** 16
**Verification:** No network request from the demo route writes to Postgres or Storage (verified
by code inspection / integration test asserting no DAL import in the route). The demo cannot be
distributed as or mistaken for a working event or gallery link.

---

## Slice 12 — Full-flow device and venue-network validation

**Objective:** The complete guest and host flow is proven end to end on real hardware under
realistic conditions.

- Current iPhone Safari, Android Chrome, and Facebook/Messenger/Instagram in-app browsers.
- Weak Wi-Fi, congested mobile data, interrupted uploads, backgrounded browsers.
- Full journey: QR scan → join → five captures → own view → share → host dashboard → gallery.

**Criteria:** 29, 30
**Verification:** Human-run on real devices. Not automated.
**Note:** this is a regression and end-to-end pass, not the first look at device behavior —
slice 2 already validated the capture flow on the same browsers. Its job is to catch what
integration broke, not to discover platform surprises.

---

## MVP-optional (ship only if cheap)

- Realtime dashboard updates. Note that client-side Supabase Realtime is not a drop-in: it would
  cross the no-browser-Supabase-client boundary and require revisiting D4 (see architecture §9).
- Custom reveal time.
- Automated refund execution.
