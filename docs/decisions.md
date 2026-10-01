# FiveFrames — Decision Log

Consequential decisions only. Ordinary engineering choices are not recorded here.
Product decisions live in [docs/product.md](./product.md); how the system is built lives in
[docs/architecture.md](./architecture.md).

Status values: **Proposed** (awaiting user approval) · **Accepted** · **Superseded**

> **Baseline approved 2026-09-21.** D1–D11 are Accepted and are the standing architecture for
> implementation. Revisiting an accepted decision means superseding it with a new entry that
> records what changed and why — not editing it in place.

> Re-baselined 2026-09-21 against the five-photo, no-video specification. The log was renumbered
> rather than amended, because no decision had been accepted at that point. The previous
> video-provider decision is deleted outright, not carried as future infrastructure:
> [product.md §18](./product.md) states the MVP architecture reserves nothing for video.

---

## D1 — Supabase as the primary backend platform

**Status:** Accepted (2026-09-21)
**Context:** The spec requires Postgres-grade consistency for frame limits, host accounts, and
private object storage with direct browser upload. It names Supabase as an obvious candidate but
does not commit to it.
**Decision:** Use Supabase for Postgres, host auth, and photo storage. Region `ap-southeast-1`
(Singapore), the closest to the Philippine market.
**Reasoning:** It covers all three needs with one vendor and one bill, and the alternative —
assembling Neon or RDS plus an auth provider plus S3 — adds integration surface without solving
anything the spec asks for. The lock-in is mostly at the auth layer; Postgres and object storage
are portable.
**Alternatives:** Separate best-of-breed services. Rejected as more moving parts for a product
whose spec explicitly asks for as few as practical.

---

## D2 — PayMongo for payment

**Status:** Accepted (2026-09-21)
**Context:** GCash, Maya, and cards must all work for the Philippine launch. The spec names
PayMongo as plausible but not required.
**Decision:** PayMongo, using hosted Checkout Sessions (`POST /v2/checkout_sessions`) with signed
webhooks.
**Evidence (first-party):** PayMongo's own documentation lists GCash, Maya, GrabPay and ShopeePay
under e-wallets and Visa/Mastercard under cards; documents the Hosted Checkout quick start with
`checkout_session.payment.paid` as the confirmation event; and documents per-endpoint webhook
secrets with a `Paymongo-Signature` header for verification. Webhook endpoints are scoped to test
or live mode separately.
**Reasoning:** Covers all three required methods natively, is a Philippine-domiciled provider with
peso settlement, and the hosted Checkout Session flow keeps card data entirely out of our system.
No concrete problem exists that would justify looking further.
**Dependency:** Requires a PayMongo account with KYC completed — a real-world prerequisite the
code cannot work around.

---

## D3 — Guest sessions are our own signed cookie, not Supabase anonymous auth

**Status:** Accepted (2026-09-21)
**Context:** Guests are anonymous, per-browser, per-event, and never create accounts. Supabase
offers anonymous auth, which would make guests first-class Postgres identities.
**Decision:** Issue our own httpOnly, Secure, SameSite=Lax signed cookie carrying a
`guest_session_id`, backed by a `guest_sessions` row.
**Reasoning:** Anonymous auth would create one throwaway auth user per guest per event —
thousands of rows of permanent identity debt for sessions that are explicitly disposable — and
buys nothing, because guests never query Postgres and never use Supabase Auth. Every read and
write of guest data is mediated by the DAL.
**Boundary, stated precisely:** guests *do* have one direct interaction with Supabase — they
upload bytes straight to Storage, which the spec requires. That happens only under a server-issued
upload authorization scoped to a single object path (D7). It is a per-upload capability, not a
client library and not database access.
**Consequence (important):** guests are not Postgres roles, so RLS cannot express guest
permissions. See D4.

---

## D4 — Authorization lives in a server-side Data Access Layer; RLS is narrow insurance, not a backstop

**Status:** Accepted (2026-09-21)
**Context:** Follows directly from D3.
**Decision:** All data access goes through `lib/dal/` on the server using the service role key.
The browser never receives a Supabase client, never queries Postgres, and never uses Supabase
Auth; its only direct contact with Supabase is uploading bytes to Storage under a server-issued,
path-scoped upload authorization (D7). RLS is enabled with deny-all policies on every table.
**Evidence (first-party):** Supabase documents that the service role key authorizes through a
Postgres role carrying `bypassrls` and therefore **skips RLS entirely**, while the anon/publishable
key maps to the `anon` role, which is subject to RLS — "no data is accessible through the API
when using a publishable key, until you create policies." Its guidance is to never use a secret
key in the browser.
**Reasoning:** One authorization model is safer than two partially-overlapping ones. A split
model — RLS for hosts, DAL for guests — invites the failure where a rule is enforced in one path
and forgotten in the other.
**What deny-all RLS actually buys us — stated accurately:** nothing on our primary path, because
the service role key bypasses it. It is insurance against a *future* mistake: if an anon key is
ever introduced and leaked, or someone adds a client-side Supabase call, that path yields nothing.
An earlier draft of this log claimed RLS meant "a leaked key still yields nothing," which is false
for the one key that matters most.
**Trade-off:** DAL discipline is the security model. Ownership predicates on every event query,
`import 'server-only'` on DAL modules, and protecting the service role key are all load-bearing.

---

## D5 — The five-frame limit is enforced by a database constraint, not application logic

**Status:** Accepted (2026-09-21)
**Context:** Product invariants 1–5 require that a guest session never exceeds five committed
photos, under concurrency, rapid repeated taps, and retries.
**Decision:** A reserve → upload → commit flow, with a check constraint restricting `slot_index`
to 0–4 and a partial unique index on `(guest_session_id, slot_index)` over live statuses.
**Reasoning:** Counting rows in application code and then inserting is a race. Making the limit a
constraint means concurrent requests collide in Postgres and lose, regardless of what the
application code does. The strongest guarantee available is the one that does not depend on
correct code paths.
**Note on the revised allowance:** with video removed there is a single kind of capture, so the
slot key loses its `kind` component and the schema gets simpler — five slots, one index, no
per-kind branching anywhere in the mechanism.
**Alternatives:** Advisory locks (correct but easy to bypass by forgetting to take one);
`SELECT count(*)` then insert (racy); serializable isolation everywhere (heavier, and still
application-dependent).

---

## D6 — The reserve idempotency key is generated by the client before the first request

**Status:** Accepted (2026-09-21)
**Context:** Invariant 3 requires that retrying a submission never produces a duplicate capture.
**Decision:** The client generates a `reserve_key` UUID at the moment the guest taps confirm,
before any network request, and sends it with the first reserve attempt and every retry. A unique
index on `(guest_session_id, reserve_key)` makes reserve idempotent; conflicting inserts return
the existing row.
**Reasoning — this corrects a real defect in the earlier baseline.** That draft had the server
mint the key *during* reserve. Two concurrent requests from one double-tapped confirm button
would then mint two keys, take the row lock in turn, and claim two **different** slots —
consuming two of the guest's five frames for one intended photo. Invariant 1 would still hold
(never more than five) while invariant 3 silently broke, and the product's scarcity mechanic
would be quietly unfair to the guest. Idempotency has to exist before the first request reaches
the server, which means the client has to own the key.
**Semantics:** one `reserve_key` identifies **one capture attempt** and maps to at most one
`captures` row for its lifetime. It is created and persisted before the first network request —
persisted, not held in memory, so it survives a reload or a backgrounded browser. Every duplicate
confirm action and every retry for that attempt reuses it; a different photo is a different
attempt with a fresh key.
**Expired reservations are terminal for their key.** If a retry arrives after the reservation has
lapsed, the server does not revive the row, reassign its slot, or allocate a second slot under the
same key — it reports the attempt as lapsed and the client starts fresh with a new key. Commit is
likewise refused for a lapsed reservation. Without this rule, "the same key came back" would have
an undefined answer precisely in the slow-network case the product has to survive. The guest loses
nothing: the released slot is free, so the fresh attempt takes one and net consumption is still
exactly one frame per photo. Full status table in architecture §6.

---

## D7 — Direct-to-storage photo upload via signed upload URLs, with TUS for large files

**Status:** Accepted (2026-09-21)
**Context:** The spec fixes two requirements: large media uploads go directly to storage rather
than through the application server, and uploads must be resilient to interruption on weak venue
connections. With video removed, this is now the only upload path in the product, so it carries
the whole reliability story.
**Decision:** Mint short-lived signed upload URLs server-side; upload directly from the browser.
Use Supabase Storage's TUS resumable protocol for large files, standard signed upload otherwise.
**Evidence (first-party):** Supabase documents `createSignedUploadUrl` as a way to give users
time-limited upload URLs without exposing primary credentials; documents TUS support for
resumable uploads, recommended above ~6MB; and states the constraints — 6MB fixed chunk size and
`409 Conflict` on concurrent uploads to the same path.
**Two distinct lifetimes, not one:** a `createSignedUploadUrl` token is valid for **2 hours**,
while a TUS resumable upload's created upload URL may remain valid for up to **24 hours** — which
is what lets a long-interrupted resumable upload resume later. The client must not assume the
24-hour figure applies to a signed token. Both are longer than the reservation TTL, so upload
credentials can outlive the reservation; that is safe only because commit is refused for a lapsed
reservation (D6).
**Reasoning:** Satisfies both fixed requirements with the storage provider already chosen in D1,
with no additional vendor. The 409-on-concurrent-path behavior is a bonus: a duplicated retry
fails cleanly instead of racing.
**Deferred:** the exact size threshold between the two paths is set during the capture slice
against real files from real devices, not guessed now.
**Deferred item resolved (Slice 3, 2026-09-21):** Slice 2's real-device testing produced no upload
failures severe enough to force this immediately, so the threshold above is set from Supabase's
own first-party recommendation rather than guessed: resumable uploads above **6MB** — the same
value as the fixed TUS chunk size — standard signed-URL PUT below that. This is an implementation
detail the original decision already anticipated and explicitly deferred, not a change to the
decision itself, so it is recorded here rather than as a new or superseding decision. Client-side
authorization for the TUS path uses the `token` from `createSignedUploadUrl` in the `x-signature`
header, not the anon key or any broader credential — the D3/D4 boundary (no Supabase client or
session token in the browser) holds for the resumable path exactly as it does for the standard
one. **Verified against a real interrupted upload and a real reload on a real device, reported
2026-09-21** — an interruption mid-upload resumed rather than losing the frame, and a page reload
mid-upload resolved to a consistent state. See `docs/progress.md` for the full result.

---

## D8 — Event lifecycle state is derived from timestamps, not a mutable status column

**Status:** Accepted (2026-09-21)
**Context:** Capture must close automatically after a safety-net grace period if the host forgets.
**Decision:** Compute lifecycle state from timestamps at read time. Cron materializes state for
display and sends warnings, but is never consulted for authorization.
**Reasoning:** A status column updated by cron is wrong for as long as the job is late or failed —
and the failure mode is guests capturing after capture should have closed, which violates
product invariant 6. A derived state is correct the instant the deadline elapses.

---

## D9 — Realtime is polling for MVP

**Status:** Accepted (2026-09-21). Superseded in part by D21 (2026-10-01): the dashboard now also
gets a server-mediated SSE signal, with this entry's polling kept as the fallback. The reasoning
below about client-side Supabase Realtime still stands.
**Context:** The spec calls live dashboard updates a quality expectation and explicitly requires
the product to remain correct without them.
**Decision:** Poll the host dashboard on an interval. No realtime transport in MVP.
**Reasoning:** The spec pre-authorizes this fallback, and adding a realtime transport before the
product is validated is speculative infrastructure.
**Not a free upgrade later.** Client-side Supabase Realtime would require shipping a Supabase
client and anon key to the browser and subscribing from there — deliberately crossing the
boundary set in D3/D4 and making RLS load-bearing for the first time, rather than the narrow
insurance D4 describes. Choosing it later means revisiting the security model and writing real
host-read policies, and warrants its own decision. Server-mediated options (shorter polling, or
server-sent events driven by the DAL) preserve the current boundary and should be weighed first.

---

## D10 — Cache Components not enabled for MVP

**Status:** Accepted (2026-09-21)
**Context:** Next.js 16 offers an opt-in caching model (`cacheComponents: true`, `use cache`).
**Decision:** Leave it off.
**Reasoning:** Almost every surface here is request-authoritative — frame counts, event state,
moderation status, signed URLs. A stale render of any of them is a correctness bug rather than a
performance gain. It can be adopted for marketing surfaces later if they justify it.

---

## D11 — Bulk download is client-driven sequential signed URLs for MVP

**Status:** Accepted (2026-09-21)
**Context:** The spec requires bulk download of originals but leaves the mechanism open. A large
wedding can produce well over a thousand photos across several GB.
**Decision:** Issue per-capture signed URLs and have the host dashboard download them
sequentially. No server-side zip in MVP.
**Reasoning:** Streaming a multi-GB archive through a serverless function will hit execution
limits, and building an out-of-band archive job is real infrastructure for a feature whose shape
the spec has not settled. Sequential signed URLs satisfy invariant 11 — the host can always get
their media — without any of that.
**Trade-off:** Noticeably less convenient than a single zip. A server-side archive job is a
recognized follow-up, not a permanent position.

---

## D12 — "After the event" gallery reveal is anchored to capture closing

**Status:** Accepted (2026-09-21)
**Context:** product.md §7.3 defines reveal timing as "after the event (default), immediately, or
a custom reveal time," but the schema has no separate "event end" timestamp distinct from capture
lifecycle — only `capture_opened_at`, `capture_closed_at`, `safety_net_closes_at`, plus the
optional, host-editable `event_date`.
**Decision:** `isGalleryRevealed()` (`lib/events/lifecycle.ts`) treats "after the event" as
revealed once capture has ended — closed manually or via the automatic safety-net close — i.e.
lifecycle state `capture_closed`, `expired`, or `archived`. "Immediate" reveals as soon as the
event is activated; "custom" reveals at `reveal_at`.
**Reasoning:** Capture ending is the point at which the event is functionally over for guests —
the product.md lifecycle table itself pairs "Capture closed / Ended" with "Gallery: per reveal
setting." Anchoring to a separate, unenforced `event_date` field would let the gallery reveal
before capture even opens if a host under-filled that field, which is a plainer read of
invariant 8 (unrevealed gallery never viewable) than the spec text alone resolves.
**Reopen note:** revisit if a future slice adds an explicit "event end" concept independent of
capture (e.g., a multi-day event where capture closes far after the event nominally ends).

---

## D13 — Event join capacity is an atomic counter with a configurable cap, not a hardcoded constant

**Status:** Accepted (2026-09-22)
**Context:** product.md §9.5 adds a launch-scale boundary — up to 250 joined guest sessions per
event (1,250 theoretical captures) — distinct from and in addition to the five-frame per-session
allowance (§9.1). Unlike the five-frame allowance, the spec is explicit that this number is a
**hypothesis to validate**, not a permanent invariant (it is deliberately absent from the §12
invariant list), so it must stay easy to change and must not be enforced the same way as the
frame count.
**Decision:** Add `guest_session_cap` (default 250) and `guest_session_count` to `events`. Joining
increments the counter and enforces the cap in one atomic `UPDATE ... WHERE guest_session_count <
guest_session_cap RETURNING ...`; the `guest_sessions` insert only happens if that update returns
a row, in the same transaction.
**Reasoning:** This reuses the exact concurrency pattern already accepted for the frame mechanism
(D5/D6) — a single atomic statement acts as both the lock and the guard, so two simultaneous joins
racing the last slot cannot both succeed. A `SELECT count(*) ... WHERE` followed by a conditional
insert has the identical race D6's log describes for frames (two concurrent requests both read
"under cap" before either commits), just against `guest_sessions` instead of `captures`.
**Why a column, not a `CHECK` constant:** the five-frame allowance is hardcoded (§12.12) because
it is a real product invariant. This number is explicitly not that — product.md §19 lists it as a
hypothesis "to validate via load testing and early real events." A plain column keeps the launch
value changeable without a schema migration that touches enforcement logic, and costs nothing
structurally even though no per-event override is required yet.
**Scope, stated precisely:** this bounds *new joins* only. It never touches the `captures` table,
never revokes an admitted guest's session, and is invisible to every guest already joined — they
keep their full five-frame allowance. Reaching the cap produces the calm "event is currently full"
state (product.md §9.5, §13), not an error, and does not affect capture, moderation, reveal, or
download for anyone.
**Alternatives:** A partial unique index like the frame mechanism's `slot_index` was rejected —
frames have a small, fixed set of legal index values (0–4) to check membership against; sessions
have no equivalent bounded identity space, so a counter is the natural mechanism, not a unique
index over an unbounded value.

---

## D14 — The public pre-purchase demo is entirely client-side; no server storage, no persisted row

**Status:** Accepted (2026-09-22)
**Context:** product.md §7.1 requires a demo that previews the five-frame capture mechanic before
payment, without ever creating a real event, a real capture/gallery link, or an unbounded storage
path, and without becoming a way to run a real event for free.
**Decision:** The demo is a static, unauthenticated route rendering the five-frame interaction
against bundled sample images or a photo the visitor picks from their own device, held only as an
in-browser object URL. No network call in the demo path writes to Postgres or Storage; there is no
`demo_sessions` table, no server action, no signed upload URL, and no token minted for it.
**Reasoning:** Every alternative that lets a demo touch the server — a nullable `is_demo` flag on
`events`, a separate short-lived table, a rate-limited anonymous-upload path — adds bookkeeping
whose entire job is to keep demo state from leaking into the real event lifecycle (§4) or being
abused for storage. A demo with no server write path satisfies §7.1 by construction: it cannot be
mistaken for a draft event, cannot produce a link because no link-bearing row exists, and cannot
be an upload-abuse vector because there is no upload.
**Trade-off, accepted:** the demo cannot preview gallery reveal or host moderation against real
persisted data — only the capture interaction and a locally-rendered sample gallery. That matches
what §7.1 actually asks the demo to demonstrate ("the core mechanic ... and the resulting gallery
experience"), not a corner cut to get the simpler design.

---

## D15 — Operators are Supabase Auth users gated by an explicit grant table, not a role platform

**Status:** Accepted (2026-09-22)
**Context:** product.md §5/§5.1 adds an internal Operator role, distinct from host privileges,
that must be enforced server-side, must not be confused with host authority merely because both
may use the same auth provider, and must have a production-safe way to be granted without
normalizing direct database editing as the ordinary privilege-management workflow. The spec is
explicit that a general org/RBAC platform is not required.
**Decision:** Operators authenticate through the same Supabase Auth already used for hosts. What
makes an account an operator is a row in a new `operators` table (`user_id` references
`auth.users`), checked server-side by `requireOperator()` on every Console route and mutation —
never a client-supplied claim. Granting operator status is a small authenticated script
(`pnpm ops:grant-operator <email>`), checked into the repo and runnable only by whoever already
holds the service-role credential — the same trust boundary as running a migration — not a
database edit performed ad hoc through a dashboard, and not a self-service admin UI.
**Reasoning:** Reusing Supabase Auth instead of a second identity system is "preserve the existing
host-auth model where practical" taken literally — there is no product or security reason for
operators to need a different login mechanism. Keeping operator status in its own table, rather
than a flag on `hosts` or a Supabase Auth custom claim, keeps host and operator authority
structurally separate even when the same person holds both (product.md is explicit this must be
possible: a host who is separately authorized as an operator still cannot confirm their own
event's payment — see the ownership-conflict check in architecture §5a). A checked-in grant script
satisfies "don't normalize direct DB editing as the workflow" without building the admin UI
product.md explicitly excludes, and matches the launch expectation of one or a very small number
of operators (product.md §19).
**Alternatives considered:** A `role` column on `hosts` (rejected — conflates two authority models
product.md explicitly separates, and would make "a host who is also an operator" awkward to
express); a fully separate auth provider for operators (rejected — no requirement calls for it,
and it would violate "preserve the existing host-auth model where practical" for no benefit); an
in-app operator-management UI (rejected as premature — the RBAC-platform non-goal, and headcount
of ~1 doesn't justify it; revisit only if headcount grows materially post-launch).

---

## D16 — Provider and manual payment converge on one idempotent activation function

**Status:** Accepted (2026-09-22)
**Context:** product.md §7.2 requires provider-confirmed and operator-confirmed manual payments to
both preserve the payment-before-activation invariant (§12.7) and to never double-activate,
regenerate inconsistent links, duplicate payment state, or corrupt lifecycle state under repeated
notifications or repeated confirmation attempts — for either source.
**Decision:** A single `activateEvent(eventId, paymentId)` DAL function, called only after each
caller has independently verified its own trust boundary (webhook signature for provider payments;
`requireOperator()` plus the ownership-conflict check for manual payments — architecture §5a/§8a).
It performs one atomic guarded `UPDATE events ... WHERE activated_at IS NULL RETURNING *`, the
same pattern already accepted for the frame slot mechanism (D5/D6) and event-join capacity (D13).
**Reasoning:** This is the identical class of concurrency problem D13's log already describes,
applied to activation instead of capacity or slots: two independent triggers (a replayed webhook,
a double-clicked Console confirm button, or one of each arriving close together) racing to
activate the same event. A single atomic statement as both the lock and the guard means only one
of them can ever win, regardless of which source triggered it, and the loser's caller sees an
idempotent no-op rather than a corrupted or duplicated state. Two separate activation
implementations — one for PayMongo, one for manual — would each need to reinvent this guard
correctly, and any future third payment source would need a third reimplementation; one shared
function makes drift between paths structurally impossible rather than a matter of code review
discipline.
**Consequence:** `event_token`/`gallery_token` are minted in exactly one place in the codebase,
inside this guarded statement — never anywhere else, for either payment source.

---

## D17 — Manual payment and refund audit trail lives on the payment row itself, not a separate audit log

**Status:** Accepted (2026-09-22)
**Context:** product.md §7.2.1 requires manual payment confirmation and manual refunds to be
auditable (event, amount/currency, method/category, paid-at, confirmed-at, confirming operator,
optional reference/note, refund facts). product.md §5.1 separately states that **view-level**
audit logging (who looked at what) is not required for MVP.
**Decision:** The `payments` table (architecture §4/§8a) carries `source`, the manual fields, and
`confirmed_at`/`confirmed_by`/`refunded_at`/`refunded_by`/notes directly on the row. No separate
`audit_log` table is introduced.
**Reasoning:** The product requirement is specifically about **mutation** auditability (who
confirmed or refunded a payment, and when) — not a general activity log of every read. The
payment row already is a durable, timestamped, attributed record of exactly those mutations; a
parallel audit-log table would duplicate the same facts in a second place for no requirement it
additionally satisfies. This keeps the manual payment model close to "the minimum persistent model
needed," per the scope of this reconciliation, and avoids building accounting-software-shaped
infrastructure the spec explicitly does not ask for.
**Reopen note:** if a future, separately-decided change requires view-level audit logging (who
looked at which event's payment detail), that is new scope requiring its own decision — this one
covers mutation auditability only.

---

## D18 — Lifecycle automation is one daily Vercel Cron route; permanent deletion is storage-first, marker-last

**Status:** Accepted (2026-09-23)
**Context:** product.md §15.2 requires expiry, a grace period, and permanent deletion after it,
none of which anything actively triggers on its own — unlike the rest of the event lifecycle
(decision D8), which is entirely derived from timestamps and needs no scheduled job to be correct.
Permanent deletion is a genuine, irreversible side effect (removing Storage objects and capture
rows), not a read, so *something* has to actually run it.
**Decision:**
- A single Vercel Cron target (`GET /api/cron/lifecycle`, `vercel.json`, daily) is the only
  scheduled mechanism added. It authenticates via `CRON_SECRET` (`Authorization: Bearer`, the
  header Vercel Cron sends automatically once that env var is set) — no new job platform, no
  queue, no separate worker service.
- The route does two independent, idempotent things: (1) a global sweep marking abandoned
  `pending` capture reservations `expired` past their existing TTL — cosmetic, for Operator
  Console accuracy only, never load-bearing (the per-guest-session lazy sweep in
  `reserve_capture()` already guarantees the frame-limit invariant on its own); (2) permanent
  deletion for every event whose `grace_until` has elapsed and whose media hasn't been deleted
  yet, each processed independently so one event's failure can't block another's.
- Permanent deletion order is: delete Storage objects for every capture (original, display,
  thumbnail, share) → hard-delete the `captures` rows → mark `events.media_deleted_at` last, via
  an atomic `WHERE media_deleted_at IS NULL` guard (the same guard pattern as D5/D6/D13/D16). A
  retry after a crash partway through re-lists whatever capture rows are still present and
  reprocesses them; re-deleting an already-removed Storage object is a no-op, not an error, which
  is what makes the sequence safe to rerun from any point of failure without a saga/transaction
  log. Once `media_deleted_at` is set, a repeat call is a pure no-op — matching "never restore
  media after permanent deletion."
- `hosted_until` and `grace_until` are stamped once, inside `activateEvent`, at the activation
  instant (the same "compute once, derive forever after" pattern D8 already uses for the rest of
  the lifecycle) — not left for a later cron-driven "expiry transition" write. `grace_until` is
  computed as `hosted_until + GRACE_PERIOD_DAYS` rather than being independently re-derived later,
  since product.md ties both to fixed durations from the same activation event.
- `safety_net_closes_at` is computed once, inside `openCapture`, anchored to the event's
  configured date (not the capture-open instant) per product.md §7.3, and held fixed across a
  reopen. This closes a real gap: before this slice, no real activation/capture-open code path
  ever set `safety_net_closes_at`/`hosted_until`/`grace_until` at all (only the dev-only
  `activate-event-dev.ts` script did), so the automatic safety-net close, expiry, and grace period
  had never actually fired for a real, provider- or manually-activated event.
- The durations themselves (72h safety net, 365-day hosted access, 30-day grace, 30-day advance
  warning) live in `lib/events/policy.ts`, explicitly documented as launch-policy hypotheses per
  product.md, not invariants like the five-frame limit.
**Reasoning:** product.md explicitly calls these durations "launch policy," not fixed forever, and
explicitly says not to build an elaborate job platform. A single idempotent cron route reusing the
existing atomic-guard pattern needs no new infrastructure concept, stays consistent with every
other lifecycle mechanism already in the codebase, and is trivially safe to rerun on any schedule,
including ad hoc manual retries.
**No external communication channel exists for the required advance-expiry warning.** product.md
requires the host be "warned in advance of expiry" but defines no email/SMS/push delivery
mechanism anywhere, and the roadmap/build instructions for this slice explicitly forbid inventing
one. The warning is therefore in-product only (a banner on the host dashboard, computed the same
derived way as everything else, `getExpiryWarning()` in `lib/events/lifecycle.ts`) — a host who
never opens their dashboard in the 30 days before `hosted_until` won't see it. **This is a real,
recorded launch prerequisite**, not a silent gap: before a genuine production launch, product needs
to decide on an actual outbound channel (most likely transactional email to the host's account
email, since Supabase Auth already has it) and that is new scope for its own slice/decision, not
implied by this one.

---

## D19 — Event Theme & Keepsakes: private theme media, one on-demand keepsake renderer, no persisted keepsakes

**Status:** Accepted (2026-09-30). Extended by D20 (Full Set keepsakes), which applies items 3–4
to a second keepsake family and replaces this entry's cost figure; everything else here stands.
**Context:** product.md §10 (accepted 2026-09-30) adds an optional event theme (one image, one
curated accent color, one optional hashtag), exactly five FiveFrames keepsake styles that
**replace** the single branded share card ("one sharing system, not two"), themed signage, and
host-only previews of all of it — including in Draft, with a placeholder QR (§7.2, §11.3). It
also adds invariant 14 and extends invariant 10. It leaves rendering, caching, theme-image
storage and format limits to architecture (§17). The existing share card (Slice 10) is cached
once per capture at a fixed `…/share` path with no invalidation, which would keep serving stale
branded output after any theme change; it is also fetched *after* the guest's tap, which risks
losing the user gesture `navigator.share` needs on iOS.
**Decision:**
1. **Theme config lives on `events`**: `theme_image_path` (nullable), `accent_color` (a key from a
   curated code registry, default `violet`; never a raw host-supplied value), and the existing
   `hashtag`, now validated server-side (stored without `#`; letters incl. accented, digits,
   underscore; bounded length). No theme table, no revision counter, no design-document model.
2. **The theme image lives in a new private bucket, `event-theme`**, flat per event
   (`{event_id}/{upload_id}…`). The host uploads directly under a server-issued, path-scoped
   signed upload URL (the D7 pattern); the server validates and normalizes it (single-frame
   raster only, pixel cap, auto-orient, metadata stripped, bounded long edge) into one object and
   points `theme_image_path` at it. Every theme write ends by pruning every other object in that
   event's folder, so a replace/remove/crash leaves no durable orphan. It is **public-facing
   presentation, not publicly addressable storage**: every browser read is a short-lived signed
   URL minted after the same access check that governs the surface showing it (owner, valid event
   token, or granted gallery access). Never minted for the Operator Console.
3. **Keepsakes are rendered on demand and never persisted.** One route, authorized per request
   against the requesting guest's own committed, non-hidden capture (invariant 14), the sharing
   toggle, and the event's lifecycle, renders the chosen style from the capture's display
   derivative plus the event's **current** theme and returns image bytes. No storage object, no
   cache row, no path to enumerate or clean up. The existing share-card path **becomes** this
   system: `share_path` and its stored `…/share` objects are retired, not kept alongside it.
4. **Five styles are a closed code registry of JSX templates** restricted to the CSS subset
   `next/og` (Satori) supports. The same template renders server-side for the exported keepsake
   and in the browser (React DOM, scaled) for the guest's five-style picker, the host's Look
   previews, and optionally the demo — one template definition, no screenshots.
5. **Signage stays on-demand SVG** and takes the same theme input. The QR plate is fixed (dark on
   light, untouched quiet zone, nothing inside it). Before activation, previews render the same
   renderer with a static, non-decodable placeholder that carries no URL and is visibly marked as
   a preview; the renderer's QR input is a type that cannot carry both.
6. **D11 is unchanged.** Host and guest original downloads and sequential bulk original download
   are untouched; keepsakes are a separate output with no ZIP or batch path.
**Reasoning:**
- *No persisted keepsakes* removes the stale-branding problem instead of managing it. "A keepsake
  always uses the event theme as it is when the keepsake is made" (§10.2) holds by construction,
  with no invalidation rule for theme image, color, hashtag, name, date or style changes to get
  wrong. It also removes lifecycle-deletion and orphan handling for keepsakes. The cost is one
  bounded render per share/save (at most five captures × five styles per session), which is small
  at launch scale (≤ 250 sessions/event, D13).
- *Content-addressed persisted caching* (key = hash of style + every render input) was the
  runner-up. It is correct but adds per-capture storage objects, prefix listing in D18 deletion,
  and orphaned variants after every theme change, all to save sub-second renders nobody has
  measured as a problem. Because the render inputs are already a closed, deterministic struct,
  adding it later is a contained change if pilot data asks for it.
- *Shared DOM/Satori templates for previews* keep five picker thumbnails off a weak venue network
  (they reuse the display image the guest already has, with no extra round trips) and make host
  previews use the real templates. The alternative, five server renders per picker open, costs
  about five image downloads each time on the worst networks in the product.
- *A separate private bucket* lets Storage itself enforce the theme's smaller size limit and
  format list at upload time, and keeps theme media structurally apart from guest captures, which
  product.md requires to stay out of gallery, counts, downloads and the Console.
- *Pruning the folder* instead of reading the old path and then deleting it is race- and
  crash-tolerant without a lock: whatever isn't the current path is garbage.
**Consequences:**
- The keepsake picker renders the selected style's server bytes when the style is selected, so
  the Share tap calls `navigator.share` with bytes already in hand. This fixes the latent
  gesture-timing risk in today's flow.
- Keepsakes are encoded as JPEG (they are photographic), not resvg's PNG, to keep downloads small
  on venue networks.
- DOM-preview vs. Satori-export parity must be checked visually per style (architecture §7b).
  If parity proves poor, the fallback is small server-rendered previews from the same templates.
  That is reversible and needs no new decision.
- The accent safeguard is a pure function over a color (`deriveAccentRoles`), applied to the
  curated set and unit-tested for contrast. A free custom color (an open design question,
  product.md §19) would reuse it plus a new column. This decision does not model that now.
- D18 permanent deletion gains one step: delete the event's `event-theme` folder with the capture
  objects, before rows and the `media_deleted_at` marker.
**Rejected:** a theme-revision counter (every write path must remember to bump it, and a forgotten
bump is a silent stale output); eager generation of all five styles per capture (up to 25 renders
per session, mostly never used); making `event-theme` a public bucket because the image is shown
publicly (it would make theme media guessable-URL-reachable, which invariant 8 forbids); a
separate share-card path kept next to keepsakes (two sharing systems); minting a temporary real
token for Draft signage previews (a working link before payment, which invariant 7 forbids).

---

## D20 — Full Set keepsakes: a second family in D19's renderer, sources derived server-side, deterministic crops

**Status:** Accepted (2026-09-30), with two clarifications made at approval: the lifecycle
check is guest event access, not the capture window, and the cost figures separate distinct
renders from request volume.
**Context:** product.md §10.2 was amended on 2026-09-30. Keepsakes now come in two families of
exactly five styles each:

- **Single-photo:** unchanged from D19.
- **Full Set:** combines all five committed captures of one guest session in commit order, with
  no guest message.

A Full Set is available only while all five captures are committed and unhidden, and never after
one is deleted. One Full Set style must follow the brandmark's construction: two landscape slots,
two portrait slots and a closing square, with capture 5 in the square. Product leaves several
questions to architecture (product.md §17): how a render proves the five captures, how commit
order is established, output dimensions, how crops work across mixed orientations, and the cost
of five-source renders.

D19 assumed one capture per render and costed "five captures × five styles" per session. That no
longer describes the workload.

**Decision:**

1. **One system, two families.** Both families use one registry (`lib/keepsakes/`), one render
   pipeline, one DAL module, one response contract, one sharing toggle and one preview approach.
   - Registry entries carry `family`. Ids are stable and unique across both families.
   - Canvas is set per family, not per style. The Full Set canvas is a single constant that the
     design amendment chooses, at or below about 2.5 MP.
   - A Full Set entry declares its five slot rectangles. The brandmark geometry lives only in the
     signature style's slots and template, never in the database or the routes.
2. **The server derives the Full Set's sources.** `GET /e/[token]/keepsake/set/[styleId]` takes
   no capture ids and no session id.
   - `getFullSetSources` selects the committed captures of the signed cookie's session **and**
     event, including hidden and deleted rows.
   - The set is eligible only if there are exactly five rows and all are unhidden, undeleted and
     have a display derivative. There is no partial result.
   - The same function sets the UI's availability flag.
   - The Single-photo route becomes `…/keepsake/photo/[captureId]/[styleId]`. Its checks are
     unchanged.
   - Both routes re-confirm their sources after rendering and before responding.
   - The routes' lifecycle check is the existing guest event-access rule: a valid, current event
     token for an event that is not expired/archived, plus the guest's session cookie for that
     event. It is **not** the capture gate. Both families stay available after capture closes,
     like every other guest action on their own committed photos. `isCaptureOpen` applies only to
     reserve and commit.
3. **Order is `(committed_at, slot_index)`, with no schema change.** `committed_at` is written
   once, in the guarded commit update. `slot_index` is unique among a session's committed rows
   (D5). Together they give a total, stable order.
4. **Crops are deterministic and geometric.** A Full Set slot is filled by a cover crop, computed
   by one pure function with CSS `object-position` semantics and a per-template focus (centred,
   biased toward the top when a taller photo fills a wider slot).
   - The server pre-crops the display derivatives with `sharp`, and browser previews apply the
     same rule in CSS.
   - There is no content analysis of any kind.
5. **Still on demand, still never persisted.** D19's reasoning holds for Full Sets.
   - Only the selected style is prepared.
   - Picker thumbnails are DOM renders from thumbnail derivatives the device already holds.
   - Slice 16 carries a concrete measurement gate (architecture §7b). If the Full Set misses it,
     D19's content-addressed runner-up is the fallback for that family only, adopted by a new
     entry.
6. **The Full Set render input has no message field and no per-photo metadata.** The theme image
   stays a separate input and never a slot.
7. **Unchanged:** one sharing system; private source media; originals never modified; keepsakes
   made only by guests from their own session; D11 original downloads; D14 (the demo stays
   client-only, with DOM previews of either family).

**Reasoning:**

- *Deriving the five captures on the server* makes the product rule the query:
  - Client-supplied ids would need a validation step that re-derives the same set anyway, and
    they would open a substitution surface.
  - Selecting hidden and deleted rows too, then requiring five eligible ones, makes "never four,
    never a gap" structural.
  - Deletion is permanent by construction: moderation never changes `status`, so a deleted row
    holds its slot forever. No new state is needed.
- *`(committed_at, slot_index)`* is enough because both columns are immutable once committed and
  the pair is unique within a session. A migration (a sequence column, or a DB-clock default)
  would change nothing observable.
- *Geometric crop, not smart crop:*
  - libvips `attention`/`entropy` and face detection are content-dependent, so the browser preview
    could not reproduce them.
  - Face detection would add ML infrastructure, and product rules out AI in the flow.
  - A fixed, top-biased focus is predictable, testable, and identical in preview and export. Its
    limitation is stated honestly (architecture §7b, §13), and design is asked to avoid layouts
    that need a perfect crop.
- *On demand, still:*
  - Estimated demand: an event has at most 1,250 distinct guest/style combinations (250 sessions
    × 5 styles), which is 6,250 source reads if each is rendered once. Request volume is a
    workload estimate, not a bound: realistically hundreds of Full Set renders, and in a heavy
    scenario (every style requested twice) 2,500 renders and 12,500 source reads.
  - Persisting outputs would reintroduce everything D19 removed — invalidation on theme change,
    D18 cleanup, orphans — plus an extra hazard: a stored Full Set that outlives a hide.
  - Measure first, cache only if needed.
- *Re-confirming after the render* costs one indexed query. It makes a hide that lands during an
  in-flight render take effect, which is the strongest guarantee available without breaking the
  share gesture. Bytes already on the device can't be revoked, and that is recorded rather than
  papered over.

**Consequences:**

- Slice 16 grows a second phase (Full Set) but stays one slice around one renderer (roadmap).
- The Full Set's design (the five compositions, names, preselected style, the canvas, the exact
  brandmark-derived geometry and the crop focus bias) is a prerequisite for Phase B, not for
  Phase A.
- D18 needs no change while outputs stay unpersisted.
- Accepted limitation: a prepared-but-unshared Full Set on the device survives a later hide, for
  as long as the picker stays open.

**Rejected:**

- client-supplied capture ids (a substitution surface, and redundant with server derivation);
- a partial or padded Full Set after a hide or delete (product forbids it);
- a new ordering column or a DB-clock `committed_at` migration (the existing pair is already total
  and stable);
- smart crop, face/subject detection or stored focal points (content-dependent, preview drift, AI
  or editor surface);
- eager rendering of all five Full Set styles when the picker opens (5 × 5 source compositions,
  mostly unused);
- a per-style canvas (arbitrary output sizes with no product need);
- a separate Full Set sharing path or decision system (two sharing systems).

---

## D21 — Live host-dashboard updates are server-mediated SSE over the app's own route, with polling kept as the fallback

**Status:** Accepted (2026-10-01, Slice 18). Supersedes D9's polling-only posture; D9's rejection
of client-side Supabase Realtime is unchanged and restated here.
**Context:** product.md §11.4 wants counts and new captures on the host dashboard to update
within a few seconds, and says correctness must never depend on it (§13, criterion 34). D9 chose
polling for MVP and named server-mediated SSE as the option to weigh first, because browser-side
Supabase Realtime would ship a Supabase client and key to the browser and make RLS load-bearing,
crossing D3/D4. Slice 18 (MVP-optional polish) asked whether SSE works on the current Next.js 16 /
Vercel deployment without a new provider.
**Evidence (first-party, checked 2026-10-01):**
- Vercel: Node.js functions stream responses by default, and "connections close at the
  function's maximum duration"; with Fluid compute the default and Hobby maximum is 300 s (Pro
  800 s). Browsers reconnect SSE on their own. Active CPU is billed only while code runs, not
  while a function waits on I/O. Vercel sends HTTP/2 pings on idle long responses, and recommends
  heartbeat data for HTTP/1.1 clients.
- The project has Fluid compute on with a 300 s default (Vercel project settings, read-only
  check).
- Next.js 16 route handlers can return a `ReadableStream` `Response`, and `maxDuration` is a
  route-segment export (local docs in `node_modules/next/dist/docs/`).
- One Vercel Preview confirmed the stream arrives unbuffered (`text/event-stream`, first event
  while the connection stays open) and that a real guest join updated the dashboard through it.
**Decision:**
1. The browser talks only to FiveFrames. `GET /events/[eventId]/live` is an authenticated Route
   Handler. It needs a verified host session (`getAuthenticatedHost`, the proxy also redirects a
   signed-out request) and the DAL ownership predicate (`getEventForHost`). A malformed id, a
   missing event and another host's event all get the same 404. No browser Supabase client or
   session is introduced; Supabase stays behind the DAL (D3/D4 unchanged).
2. **The stream is an invalidation signal, not data.** It sends only an opaque 16-character hash
   of what the dashboard shows (`getDashboardVersion`). The browser never learns counts, names,
   tokens or ids from it; on a new hash it calls `router.refresh()`, which re-reads everything
   through the DAL. Nothing is counted or derived from messages, so duplicate, replayed, reordered
   or missed messages can cause at most an extra or a later refresh, never a wrong number.
3. **Change detection is server-side polling, stated plainly.** The route re-reads the version
   every 3 s (one ownership-predicated event read plus three `count` queries) and emits only when
   it differs. It is not a database push. The hash covers `events.updated_at` (which moves on
   every event write, including each D13 join increment), the join counter, the derived lifecycle
   state, reveal state, whether capture can reopen (so a safety-net close or a custom reveal time
   passing is noticed with no write), and the committed, hidden and favorited capture counts.
4. **Bounded connections.** Each stream ends itself after 240–270 s (jittered) under a 300 s
   `maxDuration`, sends a comment heartbeat after 25 s of silence, stops when the event is no
   longer the host's, and gives up after three consecutive read failures. EventSource reconnects
   after `retry: 3000`. The client closes the stream while the tab is hidden. After three failed
   attempts without an open, or when the browser closes it for good (non-200), the client stops
   the browser's retry and reopens with a capped backoff (15 s doubling to 5 min).
5. **Polling stays as fallback and reconciliation.** It runs every 8 s (15 s on Photos) while the
   stream isn't delivering, and every 60 s while it is. It pauses while the tab is hidden and
   refreshes once on return or on `online`. Every background refresh first sends a tiny `HEAD`
   probe to the same route and is skipped if the app is unreachable. Next falls back to a full
   browser navigation when a refresh's request fails, which strands an offline tab on the
   browser's error page (found on the Slice 18 Preview).
**Reasoning:**
- It meets §11.4 with nothing new to operate: no pub/sub, no Redis, no Realtime, no new
  provider or secret, and the D4 trust boundary is exactly as before.
- An opaque version plus a server refresh keeps one source of truth (the server render). Pushing
  counts would duplicate dashboard logic in a second place, where it could drift.
- 3 s server reads keep "within a few seconds" at a small, bounded cost: a handful of indexed
  `count(*)` queries per open dashboard, and only for hosts actually looking at one (one owner
  per event). Fluid compute bills idle waiting as I/O, not CPU.
**Alternatives rejected:**
- Browser Supabase Realtime (D9's reasons: it crosses D3/D4 and makes RLS load-bearing).
- Postgres `LISTEN/NOTIFY` from the function: it needs a direct session connection that the
  pooled/serverless path doesn't give, plus a driver. That is more infrastructure for an
  optional feature.
- A hosted pub/sub or Redis for resumable streams: a new provider. It isn't needed, because a
  reconnect starts from the current version.
- Faster polling alone: every tick would render the whole dashboard server-side, which costs more
  than a hash check and is slower to notice changes.
**Consequences:**
- Moderation made in the host's own tab still refreshes through its server action. A change
  made elsewhere is noticed only if it changes a counted value. A hide and an unhide of two
  different photos between two reads can cancel out; the 60 s reconciliation poll corrects it.
- Signing out is enforced on the next connection (≤ 270 s). An already-open stream carries only
  opaque hashes, so this exposes nothing.
- Functions currently run in `iad1` against Singapore Postgres, so each read crosses the Pacific.
  The Preview measured about 7.5 s from a join to the updated dashboard (about 3.7 s locally).
  The existing region follow-up (docs/progress.md) would bring it down; nothing here depends on
  it.
- Correctness never depends on SSE delivery (criterion 34): with the stream blocked, the
  dashboard still converged by polling.


## D22 — Revealed-gallery layouts: three host-chosen, CSS-only arrangements of one unchanged photo list

**Status:** Accepted (2026-10-01, gallery-layout slice).
**Context:** The revealed gallery was a fixed square grid. The product now treats it as the
finished event result, browsed by scrolling (product.md §7.5), and the host chooses how it is
arranged: Masonry, Rows or Grid. The choice must change presentation only. Masonry and Rows show
each photo in its own shape, which needs its aspect ratio before the image loads, and captures
didn't store dimensions.
**Decision:**
1. **Storage.** `events.gallery_layout text not null default 'masonry'`, checked to
   `masonry | rows | grid`. The column default gives existing events Masonry, and
   `resolveGalleryLayout` renders anything unreadable as Masonry. The host sets it only in
   Settings · Event & gallery; Create doesn't show it, and its saves leave it untouched (absent
   field = unchanged). The DAL refuses any other value. No generic settings blob and no
   page-builder model.
2. **Dimensions.** `captures.display_width` / `display_height` (nullable) record the display
   derivative's own pixel size, written at commit from the derivative the server just produced
   (`generateDerivatives` returns it). Older captures are filled by the idempotent
   `pnpm ops:backfill-display-dimensions --apply`, which reads only display derivatives and writes
   only null columns. A capture without dimensions renders as a square tile, never as an error.
3. **One list, any layout.** `listCapturesForGalleryViewer` is unchanged in scope, filters and
   order, and doesn't take the layout. The page reads the layout only after its existing access
   decision. The viewer, signed-URL minting (one display-derivative URL per capture, as before),
   "Show more" and moderation are shared by all three.
4. **CSS geometry, no measuring script.** `components/ff/gallery-layout.tsx`
   (`GalleryLayoutList`) renders one flat `<ul>` in the gallery's own order, sized by container
   queries on its own width (tiers <560 / 560–879 / ≥880 px, mirrored in
   `lib/gallery/layouts.ts`):
   - Masonry: greedy shortest-column placement (`placeMasonry`), precomputed for 2/3/4 columns as
     CSS variables in column-width units, then absolutely positioned. It is exact for any width,
     prefix-stable (Show more never moves a tile) and keeps DOM/focus order chronological.
   - Rows: flex-wrap with each tile's grow and basis proportional to its aspect ratio, so a row
     shares one height and fills the width. A filler keeps the last row at natural size.
   - Grid: equal squares.
   Tile shapes are clamped to 1:3–3:1, so an extreme panorama never becomes a sliver; the viewer
   always shows the whole photo.
5. **The marketing site renders its gallery samples through the same component**, so it can only
   show arrangements the product produces.
**Alternatives rejected:**
- CSS multi-column masonry: column-major order (photo 1 and photo 251 side by side in a large
  gallery, focus order down column 1 first), and appending reshuffles columns.
- Grid row-span masonry: needs thousands of implicit grid lines for a full 1,250-photo event,
  beyond some engines' limits, and quantizes heights.
- A JS layout library or measuring on the client: a hydration-time reflow or flash, and a new
  dependency, for something CSS can do from stored dimensions.
- Measuring dimensions lazily on the public gallery route: heavy work and writes on a public
  read path. Commit already decodes the image.
- Serving thumbnails via `srcset`: doubles the signing calls per render, and 400 px thumbnails
  are soft in a two-column phone Masonry. Kept for a later performance pass if needed.
**Consequences:**
- Commit now writes two more columns in its existing update. Slot allocation, idempotency,
  expiry and the frame mechanism are unchanged.
- Justified rows vary in height when a wide photo doesn't fit the line and the line's photos
  stretch to fill it. Row targets (140 / 150 / 200 px) are tuned so that's occasional.
- Production rollout: apply migration 20261001000000 (additive, safe before or after code), then
  run the backfill. Until the backfill runs, older captures show as squares in Masonry and Rows.
