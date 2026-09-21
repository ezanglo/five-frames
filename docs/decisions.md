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

**Status:** Accepted (2026-09-21)
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
