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
