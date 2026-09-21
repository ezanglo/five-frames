# FiveFrames — Architecture

Companion to [docs/product.md](./product.md), which remains the authoritative product specification.
This document covers **how** the product is built. It does not restate product requirements.

Status: **approved baseline** — five-photo, no-video MVP. Ready for implementation.
Last updated: 2026-09-21

---

## 1. Overview

A single Next.js application on Vercel, backed by Supabase (Postgres, host auth, object storage).
PayMongo handles payment. **There is no video pipeline and no video service**: the MVP is photos
only, and per [product.md §18](./product.md) the architecture reserves nothing for a future video
feature.

```
                    ┌──────────────────────────────┐
  Guest (mobile web)│                              │ Host (web dashboard)
        │           │   Next.js 16 on Vercel       │        │
        │           │   ├─ Server Components       │        │
        └──────────▶│   ├─ Server Actions          │◀───────┘
                    │   ├─ Route Handlers (webhooks)│
                    │   └─ Data Access Layer (DAL) │
                    └───────────────┬──────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ Supabase (ap-southeast-1)     │
                    │ ├─ Postgres (source of truth) │
                    │ ├─ Auth     (hosts only)      │
                    │ └─ Storage  (photos)          │
                    └───────────────────────────────┘
                                    ▲
                                    │  direct browser upload
                                    │  (signed upload URL —
   Guest browser ───────────────────┘   never proxied through Vercel)

   PayMongo ── Checkout Session ──▶ host browser
   PayMongo ── signed webhook ────▶ /api/webhooks/paymongo ──▶ activate event
```

**One application, not microservices.** The product is a single coherent workload with modest
traffic concentrated into event-day bursts. Splitting it would add operational surface without
solving any requirement in the spec.

---

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.3.4 (App Router), React 19 | Already scaffolded |
| Language | TypeScript, strict | Already configured |
| UI | Tailwind v4, shadcn/ui (`base-nova`), Base UI, lucide | Already scaffolded |
| Hosting | Vercel | Spec preference; Cron and webhook endpoints included |
| Database | Supabase Postgres, region `ap-southeast-1` | Provisioned (Slice 1): `five-frames-dev` |
| Host auth | Supabase Auth (email + password, magic link) | Email + password live (Slice 1); magic link not yet wired up |
| Guest identity | Own signed httpOnly cookie + `guest_sessions` row | Built — Slice 2 |
| Photo storage | Supabase Storage, private buckets | Built — Slice 2 (bucket `captures`) |
| Payment | PayMongo Checkout Sessions + signed webhooks | Not yet built — Slice 6 |
| Image derivatives | `sharp` in server routes | Built — Slice 2 (display + thumbnail on commit) |
| Scheduled work | Vercel Cron | Not yet built — Slice 9 |
| Tests | Vitest (unit + integration against real Postgres) | Installed and in use since Slice 1 |

Remaining rows not yet built are provisioned/installed in the slice that first needs them.

---

## 3. Application structure

```
app/
  (host)/                 Host dashboard — Supabase Auth session required
  (guest)/e/[token]/      Guest capture — event token in path, guest cookie for session
  (gallery)/g/[token]/    Gallery viewer — gallery token in path
  api/
    webhooks/paymongo/    Signed webhook → activation
    cron/                 Vercel Cron targets
lib/
  db/                     Schema types, query helpers
  dal/                    Data Access Layer — the ONLY place that touches the database
  auth/                   Host session, guest session, token verification
  media/                  Storage paths, signed URLs, derivative generation, share cards
proxy.ts                  (if needed) — Next 16 renamed middleware to Proxy
supabase/migrations/      SQL migrations, source of truth for schema
```

### Server/client boundary

- **Everything authoritative runs on the server.** Client components handle camera pickers,
  upload progress, and optimistic UI only.
- **The browser never holds a Supabase client.** No Supabase key of any kind is shipped to the
  browser, and no browser ever queries Postgres or uses Supabase Auth. All data access goes
  through the DAL on the server. See §5 for why, and §10 for exactly which credential does what.
- **The one exception is the storage upload itself**, and it is narrow: the browser uploads bytes
  directly to Supabase Storage using a short-lived upload authorization the server issued for one
  specific object path. That is a capability handed out per upload, not a client library and not
  database access.
- Mutations use Server Actions; webhooks and cron use Route Handlers.
- Next 16 async APIs: `cookies()`, `headers()`, and route `params` are awaited.

### Caching

Cache Components (`cacheComponents: true`) is **not** enabled for MVP. Nearly every surface in
this product is request-authoritative — frame counts, event state, moderation status — and a
stale render is a correctness bug, not a performance win. Marketing pages can be cached later
if they justify it.

---

## 4. Data model

Schema lives in `supabase/migrations/`. The shape that matters architecturally:

- **`hosts`** — mirrors Supabase Auth users.
- **`events`** — owner, name, date, timezone, host message, lifecycle timestamps, config
  (reveal mode, visibility, sharing enabled, hashtag), `event_token`, `gallery_token`,
  `activated_at`, `capture_opened_at`, `capture_closed_at`, `safety_net_closes_at`,
  `hosted_until`, `grace_until`.
- **`guest_sessions`** — `event_id`, display name, created/last-seen. One row per browser
  session per event.
- **`captures`** — `guest_session_id`, `event_id`, `slot_index` (0–4), `reserve_key`, `status`,
  `message`, storage keys, moderation flags (`hidden_at`, `deleted_at`, `favorited_at`),
  `committed_at`. There is no `kind` column: every capture is a photo.
- **`payments`** — PayMongo checkout session id, amounts, fee breakdown, status. Webhook
  deliveries recorded idempotently by provider event id.

### Lifecycle state is derived, not stored as a mutable enum

Event state is computed from timestamps (`activated_at`, `capture_opened_at`,
`capture_closed_at`, `safety_net_closes_at`, `hosted_until`, `grace_until`) rather than kept
in a status column that a cron job must remember to update. The safety-net close is therefore
correct **the instant it elapses**, even if no job has run. Cron only materializes derived
state for display and sends warning emails; it is never load-bearing for authorization.

---

## 5. Identity and authorization

### Hosts

Supabase Auth. Every DAL function that touches an event takes the authenticated host id and
scopes the query by ownership. There is no code path that loads an event for a host without
an ownership predicate (product invariant 9).

### Guests

A guest session is an **httpOnly, Secure, SameSite=Lax signed cookie** scoped to one event,
carrying the `guest_session_id`, backed by a `guest_sessions` row. Supabase anonymous auth was
rejected: it would fill the auth schema with one throwaway user per guest per event, and it
provides nothing we need. Guests never query Postgres and never use Supabase Auth — every read
and write of their data is mediated by the DAL. Their only direct contact with Supabase is
uploading bytes to Storage, and only under a server-issued upload authorization scoped to a
single object path (§7).

**Consequence:** guests are not Postgres roles, so **RLS cannot express guest permissions.**
Authorization lives in the DAL. See §10 for what RLS does and does not protect here — the
honest answer matters, and it is narrower than "RLS is our backstop".

### Link tokens

`event_token` and `gallery_token` are 128 bits of CSPRNG randomness, base62-encoded, unique-indexed.
Rotation replaces the token, which immediately invalidates the old URL. Possession of the gallery
token is the credential for "anyone with the link" visibility; it grants nothing when visibility
is "only me" or the gallery is unrevealed.

---

## 6. The frame-limit mechanism

This is the load-bearing piece of the product. Product invariants 1–5 all resolve here.
The allowance is **exactly five photos per guest session** — one kind of capture, five slots.

### Reserve → upload → commit

1. **Reserve.** The client generates a `reserve_key` *before* it issues the request (see below),
   then the server, in one transaction, takes a row lock on the `guest_sessions` row, re-checks
   that the event is paid/active/capture-open, and inserts a `captures` row with
   `status='pending'` and the lowest free `slot_index`. It returns the capture id and a signed
   upload target.
2. **Upload.** The browser uploads **directly** to Supabase Storage. Nothing streams through Vercel.
3. **Commit.** The server verifies the object actually exists and is a valid image, then sets
   `status='committed'`.

Statuses are `pending`, `committed`, and `expired`. There is no processing state, because there
is no transcoding: a photo is safely accepted the moment the upload is verified.

### Idempotency starts before the first reserve, not at commit

This is the subtle part, and the earlier draft of this document got it wrong. If the server
minted the idempotency key *during* reserve, two concurrent reserve requests from one
double-tapped confirm button would each mint a key, each take a lock in turn, and each claim a
**different** slot — consuming two of the guest's five frames for one intended photo. Invariant
1 would hold (never more than five) while invariant 3 quietly broke.

So the **client generates a `reserve_key` (a UUID) at the moment the guest taps confirm**, before
any network request. Reserve is then idempotent at the database:

```sql
CREATE UNIQUE INDEX captures_reserve_key_unique
  ON captures (guest_session_id, reserve_key);
```

Insert is `ON CONFLICT (guest_session_id, reserve_key) DO NOTHING`; on conflict the server
re-reads and returns the existing row.

#### What a `reserve_key` means, exactly

**One `reserve_key` identifies one capture attempt, and maps to at most one `captures` row for
its lifetime.** Precisely:

- It is created and persisted **before the first network request** for that attempt — persisted,
  not held in memory, so it survives a reload or a backgrounded browser mid-attempt.
- Every duplicate confirm action and every retry belonging to that same attempt **reuses the same
  key.** A double tap, an automatic retry after a timeout, and a manual "try again" on the same
  chosen photo are all the same attempt.
- A **different photo is a different attempt** and gets a fresh key.
- The client discards the key once the attempt reaches a terminal state (committed, or lapsed per
  below). It is never reused afterwards.

#### When the same `reserve_key` returns

The reservation may already have lapsed by the time a retry arrives, so the answer has to be
defined rather than left to chance. On reserve, the server keys off the existing row's status:

| Existing row | Response |
|---|---|
| `pending` | Return that same row — same slot, same upload target. A pure idempotent no-op. |
| `committed` | Return the committed capture as success. Covers the case where the server committed but the response never reached the client. |
| `expired` | **Terminal for this key.** The server does not revive the row, does not move it to a different slot, and never allocates a second slot under the same key. It tells the client the attempt lapsed; the client starts a fresh attempt with a **new** key. |

An expired row keeps its `slot_index` value but falls outside the partial unique index below, so
it no longer occupies the slot — a fresh attempt is free to take that same index. The row is
retained as a record of the lapsed attempt, not as a claim on a frame.

Commit follows the same rule: committing an `expired` capture is **refused**, because that row's
slot was already released and honouring it would either exceed the allowance or resurrect a freed
slot. Committing an already-`committed` capture is an idempotent success.

The guest loses nothing when an attempt lapses — the released slot is free, so the fresh attempt
takes one and the net consumption is still exactly one frame per photo. Making `expired` terminal
keeps the rule simple enough to hold under concurrency: a key maps to one row, a row owns one
slot, and neither ever moves.

A genuinely new photo carries a new key and correctly takes a new slot.

### The constraint that bounds the allowance

```sql
ALTER TABLE captures ADD CONSTRAINT captures_slot_range
  CHECK (slot_index BETWEEN 0 AND 4);

CREATE UNIQUE INDEX captures_slot_unique
  ON captures (guest_session_id, slot_index)
  WHERE status IN ('pending', 'committed');
```

A guest session cannot hold more than five live captures because there are only five legal slot
indices and each can be occupied once. **The limit is a database constraint, not application
logic** — it holds under concurrency and racing requests without depending on correct code paths
(invariants 1, 5). The row lock picks the lowest free slot; the unique index is the backstop that
makes a lost race fail loudly rather than over-allocate, and the transaction retries with the next
free slot.

Together: the unique slot index bounds the allowance, and the unique reserve key ensures one
guest intention consumes exactly one slot (invariant 3).

### Freeing a frame

A slot is released only when the system never safely accepted the media (invariants 2, 4):

- **Abandoned or failed upload** — `pending` rows past a TTL (~30 min) move to `expired`.
  Swept by cron, and also evaluated lazily on the next reserve for the same session so a guest
  is never blocked waiting on a job.

Host moderation (`hidden_at`, `deleted_at`) **never** changes `status` and therefore never
returns a frame. There is no guest-initiated path to any of these transitions.

---

## 7. Media handling

### Upload

Photos upload **directly from the browser to Supabase Storage**, never proxied through Vercel
(spec §14). The server mints a time-limited signed upload URL via `createSignedUploadUrl`, which
Supabase documents as a way to let end users upload without exposing privileged credentials.

The spec requires uploads to be resilient to interruption. Supabase Storage implements the **TUS
protocol for resumable uploads**, which is the path for large files; standard signed uploads
cover typical phone photos. First-party constraints that shape the client:

- Resumable chunks are fixed at 6MB.
- A **`createSignedUploadUrl` token is valid for 2 hours.** A **TUS resumable upload's created
  upload URL may remain valid for up to 24 hours**, which is what allows a long-interrupted
  resumable upload to be picked up again later. These two lifetimes are different and the client
  must not assume the longer one applies to a signed token.
- Concurrent uploads to the same path return `409 Conflict` — a helpful property here, since a
  duplicated retry to an already-uploading path fails cleanly rather than racing.

Both lifetimes are longer than the reservation TTL in §6, so a client can still hold usable upload
credentials after its reservation has lapsed. That is safe, but only because **commit is refused
for a lapsed reservation** (§6): such an upload lands in storage as an orphaned object and is
removed by the same sweep that expires reservations. Upload authorization proves only "you may
write these bytes to this path" — it never implies the slot is still yours.

Which of the two paths a given photo takes is an implementation detail for the capture slice,
decided against real file sizes from real devices rather than guessed now.

### Derivatives

- The original is stored untouched in a private bucket.
- **Display** and **thumbnail** derivatives are generated server-side with `sharp` after commit
  and written as separate objects. **The original is never modified** (invariant 10).
- **Share cards** are generated on demand and cached as a derivative — a new image containing the
  photo plus event name, date, hashtag, message, and branding. Never a mutation of the original.
- **HEIC/HEIF:** accepted on upload; whether conversion is required on current target devices is
  an open question in the spec and is validated in the capture slice, not designed up front.

### Private delivery

No media is reachable at a stable public URL (invariant 8). Photos are served through short-lived
Supabase Storage signed URLs, minted by the DAL only after an access check. Signed URL generation
is the *result* of authorization, never a substitute for it.

---

## 8. Payment

PayMongo Checkout Sessions (`POST /v2/checkout_sessions`). The host is shown the price breakdown
— event price, processing fees, total, refundability — from our own records before redirect, not
derived from provider UI.

Activation is **webhook-driven, never redirect-driven**: the `checkout_session.payment.paid` event
arrives at `/api/webhooks/paymongo`, where the handler verifies the `Paymongo-Signature` header
against the endpoint's signing secret, records the delivery idempotently by provider event id,
sets `activated_at`, and issues `event_token` and `gallery_token`. A host who closes the browser
mid-redirect still gets an activated event; a forged redirect activates nothing (invariant 7).

PayMongo webhook endpoints are scoped to test or live mode, so preview and production register
separate endpoints with separate secrets. Refunds are handled manually through the PayMongo
dashboard for MVP; the application exposes the request and reflects the resulting state (spec §15.1).

---

## 9. Reliability

Venue conditions are assumed hostile. The design choices that follow from that:

- **Resumable or safely restartable uploads** — TUS for large files, signed upload URLs otherwise.
- **Idempotency from the first request** — the client-generated `reserve_key` means a retry, a
  double tap, or a request that timed out after the server committed it all collapse onto one slot.
- **Reservation TTL** — an abandoned upload cannot permanently strand a frame.
- **No client-side source of truth** — remaining frames are always read from the server. A stale
  or lying client cannot exceed the allowance.
- **Server-state reconciliation on return** — a guest reopening the app sees whatever the server
  says; there is no local queue to reconcile, so "committed or not, never both" is trivially true.

### Realtime

**Polling for MVP.** The host dashboard refreshes counts and new captures on an interval. The
spec explicitly makes realtime a quality expectation, not a correctness dependency, so adding
a realtime transport before the product is validated would be speculative infrastructure.
**Supabase Realtime would not be a drop-in addition.** Client-side Realtime means shipping a
Supabase client and an anon key to the browser and subscribing from there — which deliberately
crosses the boundary set in §5 and decision D4, and would make RLS load-bearing for the first
time rather than the narrow insurance it currently is (§10). Adopting it is a revision of the
security model, requiring real RLS policies for host reads and a new decision, not a switch to
flip. A server-mediated alternative (polling at a shorter interval, or server-sent events driven
by the DAL) keeps the current boundary intact and should be weighed first.

---

## 10. Security and privacy model

| Control | Where it lives |
|---|---|
| Host owns event | DAL ownership predicate on every event query |
| Guest scoped to one event | Signed cookie bound to `guest_session_id` + `event_id` |
| Capture gate | Server-side re-check of paid/active/open on **reserve and commit**, not just page render |
| Media privacy | Short-lived signed URLs minted after an access check; private buckets |
| Link secrecy | 128-bit tokens, unique-indexed, rotatable |
| Secrets | Server-only env vars, read only in `lib/dal/` and `lib/auth/`; no secret is ever `NEXT_PUBLIC_` |
| Server-only enforcement | `import 'server-only'` on DAL modules |

### What RLS does and does not protect

Being precise here matters, because the convenient version of this claim is false.

Supabase ships two classes of credential, and they behave differently:

- The **anon / publishable key** maps to the `anon` Postgres role, which **is** subject to RLS.
  With RLS enabled and no permissive policies, that key reaches no table data.
- The **service role / secret key** maps to a role carrying the `bypassrls` attribute. It
  **ignores RLS entirely.** Supabase's own guidance is to use it only for server-side work and
  never to expose it to a browser.

Our DAL uses the service role key. **RLS therefore protects nothing on our primary access path** —
every row the DAL touches is reachable regardless of policy. Enabling deny-all RLS is still
worth doing, but for one specific reason: it means that if an anon key is ever introduced and
leaked, or a client-side Supabase call is added by mistake, that path yields nothing. It is
insurance against a future error, not a check on the code we are writing.

The practical consequence: **DAL discipline is the security model.** Ownership predicates and
`import 'server-only'` are load-bearing, and the service role key is the single most sensitive
secret in the system.

### Pre-reveal share isolation

The share-card endpoint takes a capture id and authorizes it against the requesting guest's own
session. It never loads sibling captures and never consults gallery visibility, so generating a
share card before reveal cannot leak the gallery (spec §10, acceptance criterion 19).

---

## 11. Testing strategy

Weighted toward the invariants, not toward coverage percentage.

- **Integration tests against a real Postgres** (Supabase local or a dev branch) for the frame
  mechanism: concurrent reserve storms, duplicate reserve requests sharing one `reserve_key`,
  retry-after-failure, abandoned reservation expiry, moderation-does-not-restore-a-frame. These
  are the tests that matter most.
- **Unit tests** for lifecycle state derivation, token handling, and access decisions.
- **`pnpm typecheck` and `pnpm lint`** on every change.
- **Manual device validation** on real iPhone and Android hardware, including in-app browsers,
  starting in the first capture slice rather than at final QA (see roadmap). It is human-run and
  is not automated.

---

## 12. Deployment and environments

- **Production:** Vercel project + Supabase production project (`ap-southeast-1`).
- **Preview:** Vercel preview deployments against a Supabase development project. Real managed
  infrastructure rather than local replicas, so behavior matches production — with PayMongo
  test-mode keys and a test-mode webhook endpoint.
- **Local:** `next dev` against the development Supabase project. Supabase local is used where
  deterministic integration tests need it.
- Schema changes are migrations in `supabase/migrations/`, applied forward. No ad-hoc dashboard edits.

The development Supabase project (`five-frames-dev`) is provisioned (Slice 1). Vercel, production
Supabase, and PayMongo are not yet provisioned — each happens in the slice that first requires it.

### Observability

Vercel logs plus structured server-side logging on the capture lifecycle (reserve, upload
outcome, commit, expiry reason) — cheap, and the only way to see what venue networks are
actually doing to uploads. Error tracking (Sentry or similar) is added when there is real
traffic to track, not before.

---

## 13. Technical risks

| Risk | Impact | Response |
|---|---|---|
| In-app browsers (FB/Messenger/IG) restrict camera, file picker, or direct storage upload | Core guest flow broken for a large share of PH users | Validated inside the first capture slice, on real devices, as an exit condition — not deferred to final QA |
| HEIC conversion needed and expensive or lossy | Photo pipeline rework | Accept originals untouched regardless; derivative path is isolated behind `lib/media/` |
| Venue network worse than resumable upload can absorb | Guests lose captures | Reservation TTL guarantees no permanently lost frame; measure real failure rates during capture-slice device testing |
| Service role key exposure | Total data compromise — RLS does not stop it (§10) | Server-only modules, no `NEXT_PUBLIC_` secrets, key never referenced outside `lib/dal/` and `lib/auth/` |
| PayMongo merchant onboarding requires completed KYC | Blocks payment slice, not development | Capture slices are built before payment; activation is gated by `activated_at`, seeded directly in dev |
| Bulk download of a full event exceeds serverless limits | Host cannot get their media conveniently | MVP ships sequential signed-URL downloads; server-side archive is a known follow-up |
