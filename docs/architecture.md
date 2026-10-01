# FiveFrames — Architecture

Companion to [docs/product.md](./product.md), which remains the authoritative product specification.
This document covers **how** the product is built. It does not restate product requirements.

Status: **approved baseline** — five-photo, no-video MVP. Ready for implementation.
Last updated: 2026-10-01 (Slice 18, decision D21: live host-dashboard updates over the app's own
server-mediated SSE route, with polling kept as the fallback, and no browser Supabase client — §9,
§10; the public demo shows both keepsake families with the shared templates — §6b. Earlier:
2026-09-30, Full Set keepsakes, decision D20: a second keepsake family of five
styles in the same registry and renderer; the server derives a session's five eligible captures
in `(committed_at, slot_index)` order; deterministic geometric cover crops; one family canvas
chosen by design; still on demand and never persisted — §7b, §10, §11, §13. Earlier the same day:
Event Theme & Keepsakes, decision D19: theme config on `events`, a
private `event-theme` bucket, keepsakes rendered on demand from a closed five-style registry and
never persisted (replacing share cards and `share_path`), themed signage with a placeholder-QR
Draft preview — §4, §7a–§7c, §10. Slices 15–17 (§7a–§7c) are implemented. Earlier: Slice 12 lifecycle automation and retention, D18.)

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
| Payment | PayMongo Checkout Sessions + signed webhooks | Built — Slice 8 (provider path only; manual is Slice 9) |
| Image derivatives | `sharp` in server routes | Built — Slice 2 (display + thumbnail on commit); also normalizes the theme image (D19, planned) |
| Composed images (keepsakes) | `next/og` `ImageResponse` (Satori + resvg), then `sharp` → JPEG | Built — Slice 16: both keepsake families (D19, D20); the Slice 10 share card is retired |
| Signage | Self-contained SVG strings + `qrcode` | Built — Slice 8; theming and Draft preview planned (D19) |
| Scheduled work | Vercel Cron | Built — Slice 12 (`GET /api/cron/lifecycle`, daily, `vercel.json`) |
| Tests | Vitest (unit + integration against real Postgres) | Installed and in use since Slice 1 |

Remaining rows not yet built are provisioned/installed in the slice that first needs them.

---

## 3. Application structure

```
app/
  (host)/                 Host dashboard — Supabase Auth session required
                          (events/[eventId]/live: the dashboard's SSE signal, §9)
  (operator)/             Operator Console — Supabase Auth session + operator grant required (§5a)
  (guest)/e/[token]/      Guest capture — event token in path, guest cookie for session;
                          keepsake route lives under it (§7b)
  (gallery)/g/[token]/    Gallery viewer — gallery token in path
  (demo)/demo/            Public pre-purchase demo — client-only, no DAL calls (§6b, D14)
  api/
    webhooks/paymongo/    Signed webhook → activation
    cron/lifecycle/       Vercel Cron target — reservation sweep + permanent deletion (D18)
lib/
  db/                     Schema types, query helpers
  dal/                    Data Access Layer — the ONLY place that touches the database
                          (lifecycle.ts: system-authoritative, no ownership predicate, D18)
  auth/                   Host session, guest session, operator authorization, token verification
  media/                  Storage paths, signed URLs, derivative generation, signage, QR
  theme/                  Curated accent registry + deriveAccentRoles (contrast safeguard) (D19)
  keepsakes/              The keepsake registry (two families of five styles) and its JSX
                          templates, shared by the server renderer and browser previews;
                          replaces media/share-card (D19, D20)
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
- **`operators`** — internal grant table, not a role platform (§5a, D15). `user_id` references
  the same `auth.users` a host session is issued against; a row's mere existence is the
  authorization.
- **`events`** — owner, name, date, timezone, host message, lifecycle timestamps, config
  (reveal mode, visibility, sharing enabled), theme (`theme_image_path`, `accent_color`,
  `hashtag` — §7a, D19), `event_token`, `gallery_token`,
  `activated_at`, `capture_opened_at`, `capture_closed_at`, `safety_net_closes_at`,
  `hosted_until`, `grace_until`, `media_deleted_at` (Slice 12, D18 — the durable "permanent
  deletion actually completed" marker, distinct from `grace_until` merely having elapsed),
  `guest_session_cap`, `guest_session_count` (§6a, D13).
- **`guest_sessions`** — `event_id`, display name, created/last-seen. One row per browser
  session per event.
- **`captures`** — `guest_session_id`, `event_id`, `slot_index` (0–4), `reserve_key`, `status`,
  `message`, storage keys, moderation flags (`hidden_at`, `deleted_at`, `favorited_at`),
  `committed_at`. There is no `kind` column: every capture is a photo. `committed_at` is written
  once, when the row becomes `committed`, and never rewritten; with `slot_index` it gives a
  session's committed captures a total, stable order (Full Set photo order, §7b). `share_path` (Slice 10's
  share-card cache) is **retired** by D19: keepsakes are not persisted, so nothing replaces it
  (§7b). No code reads or writes it; its drop migration waits on a deployment order (§7b
  "Migration from share cards").
- **`payments`** — one row per event, source-agnostic (§8, D16). Not yet built (Slice 7/8 land
  it), so it is designed to carry provider and manual payment together from the start rather than
  retrofitted:
  - `source` — `'provider' | 'manual'`.
  - Provider fields (nullable, `source = 'provider'` only): PayMongo checkout session id,
    amounts, fee breakdown, provider status, webhook delivery id (idempotency).
  - Manual fields (nullable, `source = 'manual'` only): `manual_method`
    (`'cash' | 'bank_transfer' | 'other'`), `amount`, `currency`, `paid_at`, `confirmed_at`,
    `confirmed_by` (references `operators.user_id`), `reference_note` (product.md §7.2.1).
  - Refund fields (either source): `refunded_at`, `refunded_by` (references `operators.user_id`
    for a manual refund; null for a provider refund executed through PayMongo's own dashboard),
    `refund_note`.
  - The row itself **is** the audit record product.md §7.2.1 and invariant 13 require — no
    separate audit-log table. product.md §5.1 is explicit that view-level audit logging is not
    required for MVP; only the mutations (confirm, refund) need a durable trace, and
    `confirmed_by`/`refunded_by` plus their timestamps already provide it.

### Lifecycle state is derived, not stored as a mutable enum

Event state is computed from timestamps (`activated_at`, `capture_opened_at`,
`capture_closed_at`, `safety_net_closes_at`, `hosted_until`, `grace_until`) rather than kept
in a status column that a cron job must remember to update. The safety-net close is therefore
correct **the instant it elapses**, even if no job has run. Cron (Slice 12, D18) is never
load-bearing for lifecycle-state derivation or authorization — it exists only for the one
genuinely irreversible side effect nothing else triggers (permanent deletion of an event's media
once its grace period has elapsed) plus a cosmetic global reservation-TTL sweep. There is no
outbound email/SMS in this codebase; the required advance-expiry warning is in-product only (see
D18's recorded launch prerequisite).

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

### 5a. Operators

product.md §5/§5.1 adds a third identity: an internal FiveFrames operator, authorized to inspect
operational state across all events and confirm manual payments/refunds through the Operator
Console. See decision D15 for the full reasoning; this section states the resulting shape.

**Operators authenticate through the same Supabase Auth used for hosts** — there is no separate
credential system. What makes an account an operator is a row in a small `operators` table
(`user_id` referencing `auth.users`), checked server-side; nothing about signing in as a host
implies operator status, and nothing about being an operator implies a `hosts` row exists for
that account. A single person can hold both roles (e.g. the founder), but the two are checked
independently — `lib/dal/operators.ts` exposes a `requireOperator()` used by every Console route
and mutation, structurally parallel to how `lib/dal/events.ts` already scopes every host query by
ownership. There is no session claim, JWT custom claim, or client-supplied flag that asserts
operator status — it is always a fresh DAL read of the `operators` table for the authenticated
user id, the same discipline §5/§10 already apply to host ownership.

**Becoming an operator is an explicit, out-of-band grant, not a workflow inside the product.**
FiveFrames expects one or a very small number of operators at launch (product.md §19). Rather than
building operator management UI — which would be exactly the "general RBAC/organization-management
product" product.md explicitly excludes — granting operator status is a small authenticated script
(`pnpm ops:grant-operator <email>`), parallel to the existing `scripts/activate-event-dev.ts`
pattern: checked into the repo, reviewable, and runnable only by whoever already holds the
service-role credential (the same trust boundary as running a migration). This satisfies "don't
normalize direct database editing as the ordinary privilege-management workflow" without building
an admin UI that MVP does not need. If operator headcount grows materially post-launch, a real
management UI is a future, separately-decided addition — not something this architecture reserves
space for now.

**Ownership-conflict check.** product.md is explicit that an operator cannot confirm a manual
payment or refund for an event they themselves own. Because operators and hosts share the same
underlying `auth.users` identity, this is a single equality check in the DAL mutation:
`event.host_id !== operatorUserId`, refused otherwise. No separate "conflict of interest" table or
flag is needed — the check is structural, not a policy that must be remembered.

**RLS treatment matches hosts and guests:** deny-all, bypassed entirely by the service-role key the
DAL uses (§10). The `operators` table carries no data an anon key should ever reach either way.

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

## 6a. Event capacity enforcement

[product.md §9.5](./product.md#9-frames-commitment-and-limits) adds a second, independent limit:
up to **250 joined guest sessions per event** (a launch hypothesis to validate, not a product
invariant like the five-frame allowance — it is not in the §12 invariant list and must stay easy
to change). It bounds how large one flat-price event can grow; it does not touch the per-session
frame mechanism in §6 at all.

**Decision (D13): an atomic counter on the `events` row, guarded in the same statement that
increments it — not a count-then-insert check, and not a hardcoded constant.**

```sql
ALTER TABLE events
  ADD COLUMN guest_session_cap integer NOT NULL DEFAULT 250,
  ADD COLUMN guest_session_count integer NOT NULL DEFAULT 0;
```

`guest_session_cap` is a plain column, not a `CHECK` constant — the launch value (250) lives in
one place the product can revise without a schema change, unlike the five-frame allowance, which
is deliberately hardcoded (§12.12) because it *is* a permanent invariant. Making the cap a column
rather than a code constant also means a future per-event override costs nothing structurally,
even though nothing in the product spec asks for that yet.

Joining reuses the exact concurrency pattern already accepted for frames (D5/D6): a single atomic
`UPDATE` acts as the row lock and the guard together, so two simultaneous joins racing the last
slot cannot both succeed — the same class of bug D6's decision log describes for a
count-then-insert frame reservation applies identically here.

```sql
UPDATE events
  SET guest_session_count = guest_session_count + 1
  WHERE id = $event_id AND guest_session_count < guest_session_cap
  RETURNING guest_session_count;
-- zero rows returned ⇒ at capacity; the guest_sessions insert is skipped entirely.
```

The `guest_sessions` insert happens in the same transaction, only after this `UPDATE` returns a
row. A guest who fails to join because the event is at capacity never gets a session row, so
nothing needs to be rolled back or reconciled.

**Reaching the cap only affects new joins.** It never touches `captures`, never revokes an
already-issued `guest_sessions` row, and is invisible to every guest already admitted — they keep
their full five-frame allowance exactly as before. A guest who fails the capacity check sees the
calm "this event is currently full" state (product.md §9.5, §13), not an error.

**Host visibility:** the dashboard (§11.2) reads `guest_session_count` /`guest_session_cap`
alongside the existing session/photo counts it already shows — no new query shape, just two more
columns on a row it already loads.

---

## 6b. Public pre-purchase demo

[product.md §7.1](./product.md#71-pre-purchase-demo) requires a demo that previews the capture
mechanic without ever creating a real event, issuing a real link, or opening an unbounded storage
path.

**Decision (D14): the demo is entirely client-side.** It is a static route
(`app/(demo)/demo/page.tsx`) that runs the five-frame interaction against sample images bundled
in the repo, or a photo the visitor picks from their own device held only as an in-memory
`ObjectURL` in the browser. **No network request in the demo path writes to Postgres or Storage.**
There is no `demo_sessions` table, no server action, no signed upload URL, and no token of any
kind minted for it.

**Reasoning:** every other way to satisfy "no real event, no real link, no unbounded storage"
still requires *some* server-side bookkeeping to keep demo state separate from real state —
a nullable `is_demo` flag on `events`, a separate short-lived table, a rate limiter on anonymous
uploads. All of that is surface the spec doesn't need: a demo that never talks to the server
can't leak into the real event lifecycle table (§4), can't be mistaken for a draft event, and
can't be abused for unbounded storage, because there is no storage path to abuse. This is the
simplest architecture that satisfies §7.1 outright rather than needing a policy to enforce it.
**Consequence:** the demo cannot demonstrate the gallery-reveal or host-moderation surfaces
against real persisted data — only the guest capture interaction and a locally-rendered sample
gallery. That is exactly the scope §7.1 asks for ("the core mechanic: capturing into five frames
and seeing the resulting gallery experience"), not a limitation to work around.

**Keepsakes in the demo (built in Slice 18, product.md §7.1 MVP-optional).** The demo renders
both keepsake families from the shared registry and templates in the browser (§7b "Previews"),
as two separate choices ("One photo" / "All five"), with one fixed sample look
(`lib/demo/keepsakes.ts`: a sample name, date and hashtag, a curated accent key and a bundled
theme illustration). "One photo" uses the visitor's latest kept demo shot (its in-memory object
URL, revoked by the demo's existing lifecycle) or a bundled sample. "All five" always uses the
five bundled samples, so it never becomes something to work toward. It is preview only: no
share or save, no export, no server render. D14 is unchanged: no server call, no keepsake route,
no theme upload, no signage, no QR. `lib/demo/route-isolation.test.ts` and
`lib/demo/keepsakes.test.tsx` enforce this.

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

**Implemented (Slice 3):** the client picks standard signed-URL PUT below 6MB, TUS at or above it
— Supabase's own recommended threshold, and the same value as the fixed chunk size (D7). The TUS
path authenticates with the `token` from `createSignedUploadUrl` via the `x-signature` header, so
the browser still never receives the anon key or a broader credential (D3/D4). `tus-js-client`'s
default fingerprint-based resume means a re-selected file continues from its last successful
chunk rather than restarting, including across a reload — this is the mechanism, beyond the
reserve/commit gate, that makes "connection drops mid-upload" cheap for large files.

### Derivatives

- The original is stored untouched in a private bucket.
- **Display** and **thumbnail** derivatives are generated server-side with `sharp` after commit
  and written as separate objects. **The original is never modified** (invariant 10).
- **Keepsakes** (§7b) are further derived outputs, rendered on demand from display derivatives
  (one for a Single-photo keepsake, five for a Full Set) and never stored. They replace Slice
  10's share cards. Never a mutation of the original.
- **HEIC/HEIF (measured in Slice 15, 2026-09-30; supersedes the earlier "accepted on upload"
  assumption):** raw HEIC/HEIF is **not supported in MVP** (product.md §14). The standard,
  deployment-compatible prebuilt `sharp` 0.35 / libvips 8.18 reads a HEIF header and decodes
  AV1-coded HEIF, but has no HEVC decoder, so a genuine iPhone HEIC
  (`test/fixtures/theme-sample.heic`) fails to decode. The Slice 2 real-iPhone pass that was
  recorded as "HEIC works" was in fact a JPEG: iOS Safari converted the photo it handed to the
  `accept="image/*"` picker (every committed capture in dev is JPEG/PNG). So directly supported
  raw formats are JPEG, PNG and static WebP; an iPhone photo works when the browser or platform
  delivers it already converted to JPEG, which isn't guaranteed on every platform. No client-side
  conversion or custom image stack is added for MVP. The theme image refuses HEIC/HEIF up front
  (§7a). The capture path still accepts a raw HEIC upload and then fails at derivative
  processing (commit fails, no frame consumed); an early rejection there is a tracked maintenance
  follow-up (docs/progress.md).

### Private delivery

No media is reachable at a stable public URL (invariant 8). Photos are served through short-lived
Supabase Storage signed URLs, minted by the DAL only after an access check. Signed URL generation
is the *result* of authorization, never a substitute for it.

---

## 7a. Event theme

product.md §10.1; decision D19. One theme per event, entirely optional. It is a few columns on
the row the app already loads, not a new entity.

### Representation

| Column | Meaning | Default / unset |
|---|---|---|
| `theme_image_path` | Key of the normalized theme image in the `event-theme` bucket | `null` → default no-image treatment |
| `accent_color` | A key into the curated registry in `lib/theme/` (e.g. `violet`) | `violet` |
| `hashtag` | Existing column; stored without `#` | `null` → omitted everywhere, with no gap left |

- **Accent colors are keys, not colors.** The registry maps each key to a human label (shown in UI,
  never the raw key) and a base color. `deriveAccentRoles(color)` computes the applied shades
  (text on light, text on dark, button fill + button text, tint). It is a pure function, and a unit
  test asserts every curated key clears WCAG AA against the surfaces it is used on. That test is
  the contrast safeguard (product.md §10.1). An unknown stored key renders as `violet`, so a
  palette change can never break a render. A free custom color (open design question) would add a
  validated column and reuse the same function; nothing is reserved for it now.
- **Hashtag** is validated in the DAL on every write: optional leading `#` stripped; letters
  (including accented), digits and underscore only; no spaces; at most 30 characters (a design
  pass may tune this bound, but it stays one server-side constant). Existing free-text values are
  normalized, or cleared if invalid, by the Slice 15 migration.
- **Guest screens get the accent as scoped CSS custom properties** set server-side on the guest
  shell from `deriveAccentRoles` output. Host chrome and the Operator Console never receive them.
  No host-entered string is ever interpolated into CSS.
- **What counts as a theme change for outputs:** image, accent, hashtag, plus the event name and
  date that outputs also show. Because nothing themed is persisted (§7b, §7c), no invalidation
  step exists. The next render reads the current row.

### Theme image storage and upload

- **Bucket:** a new private bucket, `event-theme` (`public = false`), created by migration. Its
  own `file_size_limit` (**15 MB**) and `allowed_mime_types` (`image/jpeg`, `image/png`,
  `image/webp`; HEIC/HEIF removed by the forward migration `20260930010000`) are enforced by
  Storage at upload time. Kept separate
  from `captures` so theme media can never be mistaken for, counted with, or downloaded as a
  capture (product.md §10.1).
- **Layout:** flat, one folder per event: `{event_id}/{upload_id}.upload` (the raw upload, transient)
  and `{event_id}/{upload_id}.{jpg|png}` (the normalized image). `upload_id` is a server-generated
  UUID. The browser never chooses a path.
- **Flow (host-authenticated, ownership-scoped, only while settings are editable):**
  1. *Begin*: server action mints a signed upload URL for a fresh `…/{upload_id}.upload` path (the
     D7 mechanism). Theme files are small enough that the standard signed PUT is the normal path.
     The existing TUS-above-6 MB client helper may be reused unchanged.
  2. *Commit*: the server verifies the object exists, then normalizes it with `sharp`. It refuses
     HEIC/HEIF from its header before decoding, then decodes, rejects anything with more than one
     frame/page (animated WebP/PNG) or over a ~40-megapixel decode cap, rejects a shortest edge
     under 600 px, auto-orients, strips all metadata (EXIF/GPS never reaches a guest), and
     resizes to a ≤ 2400 px long edge. Output is
     JPEG, or PNG only when the source has transparency.
  3. *Swap*: one ownership-predicated `UPDATE events SET theme_image_path = $new`.
  4. *Prune*: list the event's folder and delete every object other than the current
     `theme_image_path`. This includes the raw upload and any previous image.
  - *Remove* = set `theme_image_path = null`, then prune (deletes everything in the folder).
  - Any failure before step 3 leaves the previous image in place (product.md §13). Leftovers from a
    crash or a concurrent upload are just "not current" objects, and the next prune removes them.
    No lock or saga is needed.
- **Formats (product.md §10.1/§14):** JPEG, PNG and static WebP, identified from the file's own
  header, never by the declared type. **Not accepted:** raw HEIC/HEIF (see §7 "HEIC/HEIF";
  refused in the browser pre-check by type or name, at *Begin* by declared type, by Storage's
  MIME list, and at *Commit* by header, each with "choose or export it as JPG, PNG or WebP" and
  the previous image kept), SVG (script-capable markup, never ingested), GIF, animated images,
  PDF/multi-page, RAW, video. Recommended source:
  ≥ 1600 px on the long edge so the poster format prints cleanly. Whether to warn below that is a
  design copy question.

### Delivery: public-facing, not publicly addressable

The theme image is *meant* to be seen by guests, on signage, and on shared keepsakes. That makes it
**public-facing presentation**. It is still **not publicly addressable storage**: the bucket is
private, the path is a random UUID, and no stable URL exists. Browser reads are short-lived signed
URLs minted by the DAL **after the surface's own access check**:

| Surface | Access check before a signed URL is minted |
|---|---|
| Host event pages and Look previews | Host ownership predicate (any lifecycle state, incl. Draft) |
| Guest event screens (`/e/[token]`) | Valid, current `event_token` (so it is only reachable after activation, and a rotated or revoked token stops it) |
| Gallery pages (`/g/[token]`) | Only in the branch where gallery access is actually granted. The locked/"only me" branch never loads it (criterion 43) |
| Keepsake and signage renderers | None to the browser; the server reads bytes with the service client |
| Operator Console | **Never.** No operator DAL function selects or signs it |

A signed URL copied out of a page expires on the existing short TTL. Replacing or removing the
image deletes the object on prune, so a URL minted earlier stops resolving then, not just at
expiry.

### Lifecycle

Theme edits are allowed in exactly the states where other event settings are editable, and never
change payment, activation, tokens or lifecycle state. A refund leaves the theme as configuration.
**Permanent deletion (D18)** gains one step in its storage-first order: delete the capture objects
**and** every object in the event's `event-theme` folder → hard-delete `captures` rows → set
`media_deleted_at` (and clear `theme_image_path`) under the existing atomic guard. Re-running it
after a partial failure is still a no-op-safe sweep.

---

## 7b. Keepsakes (one sharing system, two families)

product.md §10.2–§10.3, invariants 10 and 14; decisions D19 and D20. A keepsake is Slice 10's
share card generalized, and **it replaces that code path**. There is one sharing system. It has
two families:

| Family | Source | Styles | Route |
|---|---|---|---|
| Single-photo | One committed capture, chosen by the guest | 5 | `GET /e/[token]/keepsake/photo/[captureId]/[styleId]` |
| Full Set | The requesting session's five committed captures, **derived by the server** | 5 | `GET /e/[token]/keepsake/set/[styleId]` |

Both families use the same registry, render pipeline, DAL module (`lib/dal/keepsakes.ts`),
response contract, sharing toggle and preview approach. They differ only in how the source photos
are resolved and in the shape of the render input.

### Style registry

`lib/keepsakes/` holds one closed registry: two families, each with exactly five entries.

```
Single-photo entry: { family: "single",  id, label, Template }
Full Set entry:     { family: "fullSet", id, label, slots: [SlotRect × 5], Template }
```

- **`id`** is a stable string, unique across **both** families, so a style id identifies its
  family. A route refuses an id that belongs to the other family. Product-facing code never lists
  the ten together (product.md §10.2).
- **Canvas is set per family, not per style.** `SINGLE_CANVAS` is 1080 × 1350, set by the design
  pass. `FULL_SET_CANVAS` is one fixed size shared by all five Full Set styles. The `/design-app`
  amendment chooses it. No canvas is ever set per event or per guest. The Full Set canvas stays
  at or below about 2.5 megapixels, so a Full Set's render cost and output size stay close to a
  Single-photo keepsake's.
- **A Full Set entry declares its five slot rectangles** in canvas pixels, in canonical order. The
  template draws `photos[i]` in `slots[i]` and puts nothing else in a slot. The server pre-crop and
  the browser preview (below) read the same rectangles.
- There is one preselected-style constant per family.
- Unit tests assert that each family has exactly five entries and that ids are unique across both
  families. For every Full Set entry, they assert five in-bounds, non-overlapping slots.
- There is no template language, no host or guest template data, and no per-event style
  configuration (product.md §10.4). Styles are ordinary code, reviewed like code.

**The signature Full Set style** (product.md §10.2.2) is one entry of this registry. It has two
landscape slots, two portrait slots and a closing square, with no four corners meeting, and slot 5
is the square. That geometry lives only in the entry's slot rectangles and template. It may derive
from the construction in `lib/brand/logo.ts`, and it gets the same kind of geometry test that
`logo.test.ts` applies to the symbol. Nothing about it is stored in the database, and the routes
know nothing about it.

Each `Template` is a pure JSX component limited to the CSS subset Satori supports (flexbox,
absolute positioning, borders, radius, `object-fit`/`object-position`, bundled fonts). It renders
identically in two places:

- **Server, for the exported keepsake:** `ImageResponse` (Satori + resvg) at the family canvas,
  then `sharp` → JPEG (quality ~88, no metadata). Photographic output as JPEG is roughly 5–10×
  smaller than resvg's PNG, which matters on venue networks.
- **Browser, for previews:** the same component, rendered by React DOM inside a fixed-size box
  scaled to fit (see "Previews" below).

### Render inputs: closed structs

```
KeepsakeContext = {                                // shared by both families
  event: { name, date|null, hashtag|null }         // date: parts derived from event_date only
  theme: { accent: AccentRoles, image: { src }|null }
}
SingleKeepsakeInput = KeepsakeContext & {
  style: SingleStyleId
  photo: { src, width, height }                    // the capture's display derivative
  message: string|null                             // the capture's committed message
}
FullSetKeepsakeInput = KeepsakeContext & {
  style: FullSetStyleId
  photos: [SlotPhoto, SlotPhoto, SlotPhoto, SlotPhoto, SlotPhoto]  // canonical order, cropped to slot
}
SlotPhoto = { src }
```

As built (Slice 16, `lib/keepsakes/context.ts`): images are `src` strings — a data URI of bytes the
server has already prepared, or a signed/bundled URL in a DOM preview — so one template serves
both targets. `date` is a small struct (`label`, `stamp`, `day`, `monthYear`, `weekday`) because
the styles print the same event date in different forms (Booth's `18.10.2026`, Journal's numeral);
it is still event information only. Exact-key tests pin every shape.

One context builder copies only these fields from the event row. It never copies the guest display
name, the welcome message, tokens, links, counts, timezone, lifecycle, payment or host data. A unit
test asserts the exact keys of each builder's output (invariant 14, product.md §10.2 "never
contains").

- **The Full Set input has no message field**, so no guest message can reach a Full Set template.
  It has no per-photo metadata either: a `SlotPhoto` is pixels and dimensions only, with no
  timestamp, id or capture reference.
- Each template decides whether it shows `dateLabel`. Showing the date is optional per template.
- The theme image is a separate field and never an element of `photos`. A template therefore has
  no way to put it in a capture slot, and it is never a sixth source image.
- No QR or URL can appear, because none is an input.
- Text reaches Satori as React text nodes, never as parsed markup, so HTML injection through the
  event name, message or hashtag is structurally impossible.
- Templates truncate text to their layout bounds and must degrade cleanly on glyphs the bundled
  fonts lack.

### Full Set sources and order

The DAL function `getFullSetSources(eventId, guestSessionId)` is the **only** way to obtain a Full
Set's photos. It never accepts capture ids from the client.

- **Selection:** every `committed` capture where `guest_session_id = $session AND event_id =
  $event`, **including hidden and deleted rows**, ordered by `committed_at, slot_index`. Both
  predicates always apply, so no capture from another session or another event can appear.
- **Eligibility:** the set is eligible only if exactly five rows come back and every row has
  `hidden_at IS NULL`, `deleted_at IS NULL` and a display derivative. Otherwise the result is "not
  available". There is no partial result, so nothing downstream can build a four-photo Full Set or
  fill a gap.
- **Order is `(committed_at ASC, slot_index ASC)`:**
  - `committed_at` is set exactly once, in the guarded `pending → committed` update (§6), and never
    rewritten. Moderation only writes `hidden_at`, `deleted_at` and `favorited_at`.
  - `slot_index` is unique among one session's committed rows (the D5 partial unique index), so it
    breaks any timestamp tie. The order is total, and it is stable across reloads, hide/unhide and
    time.
  - **No schema change is needed.**
  - The order never uses upload-start order, `created_at`, storage paths or anything the client
    sends. Position 5, the fifth committed capture, is the closing square in the signature style.
- **Hidden vs. deleted needs no extra state:**
  - Moderation never changes `status` (§6), so a deleted capture stays a committed row and keeps
    holding its slot. A session with a deleted capture can never again have five visible committed
    captures, so its Full Set is **permanently** unavailable by construction. No flag has to be
    maintained, and the frame is not restored.
  - A hidden capture blocks the Full Set only while `hidden_at` is set. Unhiding restores
    eligibility, with the same five captures in the same order.
- **The same function drives availability in the UI:** it plus `sharing_enabled` sets the flag on
  the guest's own view and completion screen, so the page and the route cannot disagree. Where the
  flag is false, the Full Set is **absent** from the page, not shown disabled (product.md §10.2.2).

### Crop and orientation

- **Sources are the display derivatives** (≤ 1600 px JPEG). They were auto-oriented from EXIF with
  `sharp().rotate()` at commit and carry no metadata, so their stored dimensions are the true
  upright ones. Originals are never read or written.
- **Single-photo:** unchanged. The photo is contained, never stretched, and never cropped more than
  modestly (the design pass's rule).
- **Full Set:** each slot is filled by a **cover crop** of its photo. The photo is scaled uniformly
  until it covers the slot, and the overflow is trimmed. Nothing is ever stretched.
  - The crop is a pure function, `coverCrop(photoW, photoH, slotW, slotH, focus)`, with CSS
    `object-position` semantics: on each axis, the trimmed amount is split `focus : (1 − focus)`.
  - **The focus is a template constant, not a per-photo value.** Horizontally it is centred.
    Vertically it is centred, except when a taller photo is cropped into a wider slot. Then the
    focus is biased toward the top, because people's heads usually sit in the upper part of a
    portrait frame. The exact bias is tuned in design.
  - That is the whole strategy: deterministic, orientation-aware, testable, and with no image
    analysis.
- **No AI and no content analysis.** There is no face or subject detection, and not libvips'
  `attention`/`entropy` smart crop either. Those are content-dependent, the browser preview cannot
  reproduce them (so preview and export would disagree), and they can lock onto a bright
  background. No per-capture focal point is stored, because nobody is allowed to set one
  (product.md §10.5).
- **Honest limitation:** a geometric crop doesn't know where the people are.
  - A portrait photo in a landscape slot keeps only part of its height. That is about 50% of a 3:4
    portrait in a 3:2 slot, and about 35% at the brandmark's literal 76:36 frame ratio.
  - A subject that isn't near the focus can be cut off.
  - Design reduces this by avoiding extreme slot ratios and compositions that depend on a perfect
    crop. Only content analysis could remove it, and MVP excludes that.
- **Server:** before composition, `sharp` crops each source to its `coverCrop` rectangle and
  resizes it to the slot's pixel box (`extract` + `resize`). Satori/resvg then embed five
  slot-sized images, not five 1600 px ones.
- **Browser:** the same template draws the uncropped image with `object-fit: cover` and the same
  `object-position`. By definition, that is the same crop.
- A unit test checks `coverCrop` against the CSS rule for portrait, landscape and square inputs in
  every slot shape, and checks that the same inputs always produce the same rectangles.

### Request, authorization, response

Both routes are Route Handlers under `/e/[token]/keepsake/`. They are side-effect free, so they
are GETs and need no CSRF token.

- The Full Set URL contains no guest session id and no capture ids. The session comes from the
  signed guest cookie, and the captures come from `getFullSetSources`.
- The client sends only the event token (already in the path), its cookie, and the selected style.

Every request re-checks, in the DAL:

1. **guest event access holds**: `event_token` resolves (via the existing `getEventByToken`) to an
   event whose lifecycle is not expired/archived. A rotated, revoked or refund-cleared token
   therefore resolves to nothing;
2. the signed guest cookie holds a session for **this** event;
3. `sharing_enabled` is true;
4. `styleId` is in the registry **for this route's family**;
5. the sources resolve:
   - **Single-photo:** the capture matches `(id, guest_session_id, event_id)`, is `committed`, is
     not hidden or deleted, and has a display derivative;
   - **Full Set:** `getFullSetSources` returns an eligible set.

**Check 1 is guest access, not the capture gate.** It never calls `isCaptureOpen` and never
requires the capture window to be open. Keepsakes of either family work while capture is open,
before it opens again, and after it closes, for as long as the guest can still reach their own
captures under the existing token and session rules (product.md §10.2). The paid/active/open
capture gate belongs only to reserve and commit (§6).

The server then renders and **re-confirms before it responds**. One indexed query checks that the
source capture ids are still committed, not hidden and not deleted. If a host's hide lands while a
render is in flight, the guest gets not-found, not the bytes. The check is cheap and shared by
both families.

Responses:

- A failure of check 1, 2, 4 or 5, or of the re-confirm, returns the same generic not-found. There
  is no oracle for probing other guests' capture ids or eligibility, as today.
- A failure of check 3 returns "sharing disabled".
- Neither route loads another session's captures or consults gallery visibility. Both work
  identically before and after reveal without exposing either.

A successful response is `image/jpeg` with `Cache-Control: private, no-store` and the filename
`fiveframes-{event-slug}-{style}.jpg` (no guest name).

- `?download=1` adds `Content-Disposition: attachment` for the **save** action, so saving works by
  plain navigation in in-app browsers where blob downloads are unreliable.
- Otherwise, **share vs. save** is a client concern over the same bytes.

**Prepare before the Share tap (both families).**

- The client fetches **only the selected style's** bytes, when that style is selected. That
  includes the preselected style when the picker opens.
- Changing style aborts the previous fetch (`AbortController`) and prepares the newly selected
  style.
- The Share tap calls `navigator.share({ files })` with the bytes already in hand, inside the user
  gesture. Save is the fallback wherever the share sheet is unavailable.
- Other styles are never rendered speculatively.

**What a prepared file can and can't do.**

- Authorization is evaluated when the server renders and re-confirmed just before it responds.
  Once the bytes reach the guest's device, they cannot be revoked.
- Suppose the host hides one of the five after a Full Set was prepared but before the guest taps
  Share. The tap shares the bytes the device already holds. Re-checking at tap time would put a
  network round trip inside the gesture `navigator.share` needs, which defeats the reason for
  preparing.
- The exposure is bounded to one open picker:
  - prepared bytes live only in memory and are dropped when the picker closes;
  - they are never written to Cache Storage, IndexedDB or a service worker;
  - every new selection, save navigation or reopen is re-authorized against current state.
- This is the same boundary as product.md §10.3's "exported keepsakes can't be recalled" (an
  accepted risk). The architecture claims no revocation beyond it.

### Previews

Picker thumbnails and host Look previews are the real templates rendered by React DOM (§7c). They
are never server renders.

- **Guest, Single-photo:** the previews use the capture's image, which the own view has already
  loaded.
- **Guest, Full Set:** the five style thumbnails use the **thumbnail derivatives** of the five
  captures, which the own view already holds. All five style thumbnails share the same five URLs,
  so the browser loads each image once. A larger preview stage may use the display derivatives.
  Opening the Full Set picker therefore costs one server render (the preselected style's export),
  not 5 × 5 compositions.
- **Host Look:** both families, drawn on bundled sample photos with the event's theme, in every
  editable state. The Full Set needs five samples of mixed orientation, including a portrait
  photo that lands in a landscape slot. No guest data and no token are involved.
- **Demo (D14):** DOM previews of either family, with a fixed sample theme and sample or in-memory
  local photos, and no server call. If the demo ever offers a save, it rasterizes in the browser
  and marks the image as a demo sample. It never calls the keepsake routes.
- **Parity:** DOM vs. Satori output is checked visually per style, for both families, in Slice 16.
  - The Full Set's crops can't drift, because both paths use `coverCrop`'s rule.
  - If parity is poor, the fallback is small server-rendered previews from the same templates.
    That is reversible and needs no new decision.
  - For the Full Set, that fallback reads five sources per thumbnail, so it is a last resort there.

### Caching and invalidation

**Nothing is persisted, for either family.** Every export renders from the current event row,
theme and capture rows (product.md §10.2).

- Changing the theme image, accent, hashtag, name, date or a style design can never leave a stale
  branded output on the server.
- A hide, unhide or delete takes effect on the next request with no invalidation step.
- Deleting a source capture needs no keepsake cleanup, because there is nothing to clean up.
- Exported keepsakes on guests' devices are out of reach by product decision (§10.3, accepted
  risk).
- Browser previews use the theme loaded when the picker opens. The export always reflects the
  server's current state.
- The server may keep an in-memory, per-instance cache of theme image bytes keyed by
  `theme_image_path`. Paths are immutable (each upload gets a new UUID), so that cache is correct
  without invalidation.

### Cost and performance shape

| Per render | Single-photo | Full Set |
|---|---|---|
| Source reads | 1 display derivative (~0.2–0.5 MB) | 5 display derivatives (~1–2.5 MB), fetched in parallel |
| Server work | Decode, compose, JPEG | 5 × (decode, crop, resize), compose, JPEG |
| Decoded pixels in memory | A few MB | A few tens of MB (five 1600 px sources before cropping), plus the canvas |
| Theme image | Per-instance cache | Same |
| Output | One canvas JPEG | One canvas JPEG |

These are estimates, not measurements.

**Demand per guest who opens a picker:**

- previews: 0 renders;
- opening the picker: 1 render (the preselected style);
- each further style selected: 1 render;
- Share: 0 renders (the bytes are already held);
- Save: 1 render (the `?download=1` navigation);
- a repeat visit: the same again, because nothing is cached.

Renders happen only on demand, never eagerly, and a Full Set is offered only to sessions that
already have five eligible captures.

Unique renders and request volume are separate numbers:

- **Distinct guest/style combinations** (the bounded quantity): 250 sessions (D13) × 5 Full Set
  styles = **1,250** per event. If each is rendered exactly once, that is **6,250 source-image
  reads**. It is also the most a render cache could ever hold per event.
- **Request volume** is not bounded by that number. Because nothing is cached, every selection,
  save or revisit is a new render. Neither of the following is a ceiling; they are workload
  estimates:
  - *Realistic:* some sessions reach five captures, and each makes a few requests. That is
    hundreds of Full Set renders, or low thousands of source reads.
  - *Heavy:* every session requests every Full Set style twice (say, selecting it and then saving
    it). That is 2,500 renders and 12,500 source reads.
- Both are small at launch scale. **D19's on-demand, never-persisted strategy therefore holds for
  both families** (D20). Ordinary fair use covers abusive repetition (§10).

**Slice 16 measurement gate.** Measure on a Vercel preview against the development storage, cold
and warm:

- Full Set render p95, using five 1600 px sources plus a 2400 px theme image: target ≤ 2.5 s
  warm and ≤ 5 s cold;
- peak function memory: at most half the configured function memory;
- Full Set JPEG size: ≤ ~800 KB;
- Single-photo: D19's existing target (p95 well under ~2 s, output a few hundred KB).

In the pilot, also record: renders per guest per family, the share of sessions that reach five
captures, and storage egress per event.

**If the Full Set misses the gate** after ordinary tuning (slot-sized pre-crop, parallel reads,
JPEG quality), the fallback is D19's recorded runner-up, applied to the Full Set family only:
content-addressed persisted output.

- The key is a hash of the style, the template version, the five capture ids with their display
  paths, and every event and theme field in the input.
- Authorization and the re-confirm still run on every request before stored bytes are served.
- D18 deletion must remove those objects.
- Adopting the fallback needs a new decision entry. Nothing is reserved for it now.

### Failure semantics

| Situation | Outcome |
|---|---|
| Fewer than five committed captures | No Full Set anywhere in the UI; the route returns generic not-found |
| One of the five hidden | Same, until the capture is unhidden; then available again, in the same order |
| One of the five deleted | Same, permanently for that session; no frame restored |
| Missing cookie/session, bad token, expired lifecycle, or failed re-confirm | Generic not-found |
| Sharing off | "Sharing disabled" |
| Unknown style id, or an id from the other family | Generic not-found |
| A source's bytes missing or undecodable | Retryable server error ("couldn't prepare, try again"). Never a partial Full Set, and never a substituted image |
| Theme image object missing or undecodable | Render with the style's no-image treatment (every style must already look complete without one) and log it |
| Satori/resvg/`sharp` error or timeout | Retryable server error |

**The routes write nothing: no row and no object.** So no failure can consume a frame, change a
capture's state, or touch an original.

### As built (Slice 16)

- **Every image is prepared for the exact box its template draws it in**: the Single-photo window,
  each Full Set slot, and each style's theme-image box (`THEME_IMAGE_BOXES`), all via `coverCrop`
  and `sharp`. So `object-fit`/`object-position` never matter on export, and the DOM preview's CSS
  crop is the same crop.
- **Two targets, one template.** A few concerns serialize differently for Satori and the browser
  (`lib/keepsakes/templates/target.ts`, `parts.tsx`): line clamping, single-line ellipsis, fonts
  (the same TTFs reach the DOM through `next/font/local`), and large drop shadows. Shadows are CSS
  in the preview and a pre-blurred bitmap on export (the same σ = blur/2 rule), because resvg's
  Gaussian blurs were the dominant render cost; parity is unchanged.
- The renderer reads its bundled TTFs from disk; `next.config.ts` traces them into the keepsake
  routes.
- Each render logs one structured `keepsake.render` line (family, style, outcome, ms, KB, sampled
  peak RSS), with no guest, capture or event identifiers.
- The Slice 16 gate was met on a Vercel Preview co-located with the database (measurements in
  docs/progress.md). The on-demand, never-persisted strategy stands for both families.

### Migration from share cards

- `lib/media/share-card.tsx` → `lib/keepsakes/` (its layout may become one of the Single-photo
  styles; that is the design pass's call). `lib/dal/share-cards.ts` → `lib/dal/keepsakes.ts`, with
  the same ownership predicate plus the expiry and style checks, and `getFullSetSources`. The
  `getShareCard` server action (base64 data URL) → the two Route Handlers above.
  `use-share-capture.ts` → the picker flow.
- `captures.share_path` is retired. Stop reading and writing it. An idempotent cleanup deletes the
  existing `…/share` objects and nulls the column. Then a forward migration drops the column, and
  D18 deletion stops listing it. Until the drop, deletion keeps handling it.
- **As built:** the new code neither reads nor writes `share_path`, and D18 no longer lists it.
  `pnpm ops:retire-share-cards [--apply]` deletes `…/share` objects, deriving each path from the
  capture's `storage_path`, so it needs no column and reruns as a no-op. Migration
  `20260930020000_retire_share_cards.sql` drops the column. **Deployment order:** the column must
  outlive any deployment still running the old code against that database. (1) Deploy code that no
  longer uses `share_path` everywhere that database is served. (2) Rerun the cleanup with
  `--apply`, which catches any cards old code made in between. (3) Only then apply the migration.
- `events.sharing_enabled` is unchanged. It now governs making, sharing and saving keepsakes of
  both families (product.md §10.3), and it never affects original downloads.

---

## 7c. Signage and previews

product.md §10.1, §11.3; decision D19. Extends the Slice 8 signage renderer (`lib/media/signage.ts`):
four formats of self-contained SVG, rendered on demand, never persisted.

### Themed signage

`renderEventSignageSvg(format, input)` takes `{ eventName, hashtag, accent: AccentRoles,
themeImage: bytes|null, qr }`. The theme image is embedded as a base64 data URI of the normalized
JPEG/PNG (no external reference), on the formats and in the regions the design pass assigns. Every
interpolated string goes through the existing `escapeXml`. The accent comes only from the registry.

**The QR plate is fixed, not themed:**

- modules always `INK` on a white plate; accent never used inside the plate;
- the plate's padding is ≥ 4 modules (the quiet zone) at every format size, and nothing (image,
  tint, mark, bracket) is drawn inside the plate rectangle;
- no logo is inserted into the modules; error-correction level stays fixed;
- the encoded value is always `{origin}/e/{event_token}`, built server-side. There is no input for
  a host-chosen destination.

A unit test per format asserts plate color, quiet-zone size, and that no other element's bounds
intersect the plate. Human print-and-scan checks cover the rest (roadmap Slice 17).

### The QR input is a discriminated type

```
qr = { kind: "live", captureUrl }   // constructible only from an activated event with event_token
   | { kind: "preview" }            // carries no URL at all
```

`preview` renders a **static, bundled, non-decodable placeholder** the same size as a real QR. It is
a fixed module pattern that is deliberately not a valid QR symbol, so no scanner resolves it, plus a
visible "Preview — not a working code" mark. It is never derived from any event field, token or URL,
and no temporary or real token is ever minted for it. That is the trust boundary: a preview
contains nothing that can admit anyone, even if it is screenshotted.

### Routes and gating

| Output | Who | When | Response |
|---|---|---|---|
| Signage **download** (existing `/events/[id]/signage/[format]`) | Owning host | Only with `activated_at` and `event_token` (unchanged) | `attachment` SVG, `live` QR |
| Signage **preview** | Owning host | Any editable state | Inline only (no download affordance). `preview` QR before activation, `live` QR after |

The preview is rendered server-side by the production renderer (inline in the Look page or a
sibling inline route; an implementation choice). It is never a separate mock-up.

### What the Look page previews, and with what

| Preview | Rendered by |
|---|---|
| Guest screens | The real guest shell components, with sample content and the event's theme, inside a scaled frame on a host-authenticated page. No token and no guest DAL call, so nothing a guest could reach is created |
| Keepsake styles, both families (five Single-photo, five Full Set) | The real keepsake templates in the DOM (§7b), with bundled sample photos (portrait + landscape; five mixed-orientation samples for the Full Set) |
| Four signage formats | The real signage renderer, server-side (above) |

Nothing here is a screenshot, so previews cannot drift from production output except through
DOM/Satori rendering differences, which each style's visual check covers.

### As built (Slice 17)

- **One renderer, pure geometry plus a writer.** `lib/media/signage-layout.ts` turns the closed
  input into rectangles and text lines, and `lib/media/signage.ts` draws exactly that. The tests
  check scannability as geometry: plate, ≥ 4-module padding, nothing intersecting it. They also
  decode the rasterized output with a real QR decoder.
- **Text is outlined** from the bundled brand TTFs (`opentype.js`), like the lockup. A signage
  file therefore needs no fonts to print or display, the long-name rules measure the real glyphs,
  and host text reaches the SVG as path data. Only glyphs the fonts lack (emoji, CJK) are written
  as `<text>`, and those are escaped, as is the `<title>`.
- **Preview route:** `/events/[id]/signage/[format]/preview`. It is owner-only, requires an
  editable state, is inline only, and sends `no-store` and a sandboxing CSP. It is the same
  renderer, with the host's unsaved accent and hashtag applied after the same validation a save
  uses. The theme image is embedded at ≤ 1200 px instead of the download's full size; the crop is
  identical.
- The plate is sized for a 29-module symbol, the smallest a capture URL can produce. Longer URLs
  keep the format's QR size, and their quiet zone only grows.

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
separate endpoints with separate secrets. Provider refunds are handled manually through the
PayMongo dashboard for MVP; the application exposes the request and reflects the resulting state
(spec §15.1).

### 8a. Manual payment and the shared activation path

product.md §7.2 adds a second path to the same activated state: an authorized operator confirming
a supplier-assisted/manual payment through the Operator Console, instead of PayMongo's webhook.
Both paths must converge on identical activation behavior (decision D16) — no separate "manual
activation" code path that could drift from the provider one.

**One idempotent `activateEvent(eventId, paymentId)` DAL function, called from two trust
boundaries:**

- The PayMongo webhook handler calls it after verifying the `Paymongo-Signature` header and
  recording the delivery idempotently by provider event id (unchanged from §8 above).
- An Operator Console server action calls it after `requireOperator()` succeeds and the
  ownership-conflict check (§5a) passes, immediately after writing the manual payment's
  `confirmed_at`/`confirmed_by` onto the `payments` row.

Both call sites hand `activateEvent` a `payments.id` — it never activates on its own inference of
"payment looks confirmed," only on an explicit, already-authorized caller telling it a specific
payment row is confirmed.

**The atomic guard is the same pattern as D13, applied to activation instead of capacity:**

```sql
UPDATE events
  SET activated_at = now(), event_token = $token, gallery_token = $gallery_token
  WHERE id = $event_id AND activated_at IS NULL
  RETURNING *;
-- zero rows returned ⇒ already activated; treat as an idempotent success, not an error.
```

A replayed PayMongo webhook and a double-clicked "confirm" button in the Console both hit this
same `WHERE activated_at IS NULL` guard, so neither can double-activate, regenerate tokens, or
corrupt lifecycle state — the exact property invariant 7 and product.md's shared-activation
requirement ask for. Because `event_token`/`gallery_token` are only ever minted inside this one
guarded statement, there is no path — provider or manual — that issues a second, inconsistent
pair of links for the same event.

**Manual refunds** follow the mirror shape: an operator-authorized server action (again gated by
`requireOperator()` and the ownership-conflict check) writes `refunded_at`/`refunded_by` on the
`payments` row and clears `activated_at`-derived link availability the same way a provider refund
already does (spec §15.1) — both refund paths converge on the same "return the event to unpaid,
disable its links" behavior, not two separate implementations.

### 8b. Operator Console

product.md §5.1 requires a small internal tool for read-mostly operational visibility plus the two
privileged mutations above. It lives at `app/(operator)/`, gated by `requireOperator()` on every
route and every server action — never by page-level UI hiding alone.

- **Event list/search and detail** read the same `events`/`payments`/`guest_sessions`/`captures`
  rows the host dashboard already reads, but **without a host-ownership predicate** — operator
  visibility is explicitly cross-host (product.md §5.1). This is a separate DAL module
  (`lib/dal/operator-events.ts`) rather than reusing the host-scoped queries, so the "no ownership
  predicate" case is never accidentally reachable from a host-facing code path, and vice versa.
- **Aggregate counts only, never guest media.** The Console queries `count(*)`-shaped aggregates
  over `captures` (per product.md §5.1.2) and never selects or signs a URL for an individual
  capture's storage object. There is no DAL function an operator route could call to obtain a
  capture's signed image URL — the capability simply does not exist on that code path, rather than
  being hidden by the UI.
  - This is a good-faith design boundary, not a claim of technical exfiltration-proofing: the
    Console runs on the same service-role-keyed DAL as everything else, so the boundary is "this
    module never mints media URLs," not a separate credential that literally cannot. That is the
    same honest framing §10 already applies to RLS.
- **Confirm manual payment / record manual refund** are the only mutations the Console exposes
  (§8a). Every other field the Console displays is read-only from this surface — editing an
  event's configuration, moderating captures, or changing ownership all remain host-only or
  unavailable entirely (product.md §5.1.2), so the Console cannot become the "god mode" admin tool
  product.md explicitly excludes.

**Event signage (product.md §11.3)** is rendered from the event's `event_token`. Downloads exist
only after activation. Theming and host-only Draft previews with a placeholder QR are covered in
§7c.

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

**Server-mediated SSE, with polling as the fallback (decision D21, superseding D9's polling-only
posture).** Realtime is a quality expectation, not a correctness dependency (product.md §11.4).

```
Browser (EventSource) ──▶ GET /events/[eventId]/live ──▶ DAL getDashboardVersion ──▶ Postgres
        ▲                    host session + ownership       (every 3 s, server-side)
        └── "version changed" ──▶ router.refresh() ──▶ server components re-read via the DAL
```

- **The browser talks only to this app.** The route requires a verified host session and the DAL
  ownership predicate. A malformed id, a missing event and another host's event all get the same
  404. No Supabase client, key or session reaches the browser (§3, D3/D4).
- **The stream carries an opaque version hash, not dashboard data.** On a new hash, the client
  refreshes the page, and every number is re-read on the server. Nothing is counted from
  messages, so duplicate or missed messages can't corrupt what the host sees.
- **Change detection is server-side polling.** The route re-reads the version every 3 s and
  emits only on a change. The version covers the event row (`updated_at` moves on every write,
  including joins), the derived lifecycle and reveal state (so time-based transitions with no
  write are noticed), and committed, hidden and favorited capture counts.
- **Bounded:** each stream ends itself after 240–270 s, under `maxDuration = 300` (Vercel Fluid
  compute's default). EventSource reconnects after 3 s. Heartbeat comments are sent after 25 s of
  silence. The client closes the stream while the tab is hidden, and backs off (15 s → 5 min)
  after repeated failed attempts or a non-200 answer.
- **Polling stays underneath:** every 8 s (15 s on Photos) while the stream isn't delivering, and
  every 60 s as reconciliation while it is. It pauses while hidden, and refreshes on return or
  `online`. Every background refresh is gated on a tiny `HEAD` probe to the same route. A failed
  refresh request makes Next fall back to a full browser navigation, which would leave an
  offline tab on the browser's error page.
- **Supabase Realtime is still not a drop-in.** Client-side Realtime would ship a Supabase client
  and key to the browser and make RLS load-bearing (§10). That remains a security-model revision
  requiring its own decision. D21 deliberately avoids it.

---

## 10. Security and privacy model

| Control | Where it lives |
|---|---|
| Host owns event | DAL ownership predicate on every event query |
| Operator authorization | `requireOperator()` reads the `operators` table for the authenticated Supabase Auth user on every Console route/action (§5a); never a client-asserted role |
| Operator/host conflict of interest | DAL equality check (`event.host_id !== operatorUserId`) on manual-payment confirm and manual-refund mutations (§5a) |
| Guest scoped to one event | Signed cookie bound to `guest_session_id` + `event_id` |
| Capture gate | Server-side re-check of paid/active/open on **reserve and commit**, not just page render |
| Media privacy | Short-lived signed URLs minted after an access check; private buckets (`captures`, `event-theme`) |
| Theme image | Private bucket; signed URL only after the surface's own check (§7a table); never for the Operator Console; server-chosen paths; SVG never accepted |
| Keepsake isolation | Per-request check of own committed, non-hidden capture (Single-photo) or the server-derived five eligible captures of the cookie's own session (Full Set), + sharing toggle + lifecycle, re-confirmed before responding (§7b); closed render inputs (no display name, links, tokens; no message in a Full Set) |
| Signage / preview QR | Live QR only from an activated event's token; Draft previews use the URL-less `preview` type (§7c) |
| Live dashboard stream | Host session + DAL ownership predicate on connect, ownership re-read on every server tick; sends only an opaque version hash; no browser Supabase client (§9, D21) |
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

### Keepsake, theme and preview threat model

The Single-photo route takes a capture id and authorizes it against the requesting guest's own
session. The Full Set route takes no capture ids at all: the server derives the five from the
cookie's session. Neither loads another session's captures or consults gallery visibility, so
making a keepsake before reveal cannot leak the gallery (invariant 14, criteria 29 and 56). The paths this
feature adds, and what closes each one:

| Threat | Mitigation |
|---|---|
| Reading another event's theme image | Private bucket, UUID path, signed URLs only after owner/token/granted-gallery check; the locked gallery never loads it |
| Keepsake of another guest's, hidden, or another event's photo | DAL predicate on `(capture id, guest session, event)` + committed/not hidden/not deleted, re-checked every request; generic not-found |
| Full Set mixing sessions or events, or substituting another guest's photo | No client-supplied capture ids; `getFullSetSources` selects by both `guest_session_id` (from the signed cookie) and `event_id`, and requires exactly five eligible rows, with no partial result |
| Stale Full Set after a hide | Eligibility re-derived from current rows on every request and re-confirmed after the render, before responding. Bytes already on the guest's device can't be revoked (bounded to one open picker, §7b) |
| Bypassing the sharing toggle | Checked server-side in the route, not only by hiding the button |
| Enumerating cached derivatives | None exist — keepsakes and signage are never persisted |
| Stale signed URLs | Existing short TTL; replace/remove prunes the object, so old URLs die then |
| Private data leaking into a keepsake | Closed `KeepsakeInput` (no display name, tokens, links, counts, host data); JPEG re-encode carries no metadata; theme image EXIF stripped at ingest |
| Preview becoming real access | URL-less `preview` QR type; no temporary token; preview responses are inline-only and host-owned |
| Cross-host theme edits | Ownership predicate on every theme mutation; server-generated upload path; commit verifies the path is under that event's folder |
| Text injection into images | Satori takes React text nodes (no markup parsing); SVG interpolation always via `escapeXml`; hashtag charset-validated; accent is a registry key, never raw CSS |
| Hostile image files | SVG never accepted; decode-pixel cap; single-frame check; Storage-enforced size/MIME limits |
| Render-endpoint abuse | Bounded work per request (a Full Set reads five sources, so about 5× a Single-photo render's I/O), cookie + capture authorization; no dedicated limiter in MVP (product.md allows ordinary fair use). Watch pilot logs and add a simple per-session limit if needed |

---

## 11. Testing strategy

Weighted toward the invariants, not toward coverage percentage.

- **Integration tests against a real Postgres** (Supabase local or a dev branch) for the frame
  mechanism: concurrent reserve storms, duplicate reserve requests sharing one `reserve_key`,
  retry-after-failure, abandoned reservation expiry, moderation-does-not-restore-a-frame. These
  are the tests that matter most.
- **Unit tests** for lifecycle state derivation, token handling, and access decisions.
- **Event Theme & Keepsakes** (D19): the registry has exactly five styles; the `KeepsakeInput`
  builder never includes display name, links or tokens; every curated accent clears contrast;
  hashtag validation; signage QR plate/quiet-zone/no-overlap per format; the `preview` QR carries no
  URL and does not decode; integration tests for keepsake authorization (other guest, hidden,
  deleted, sharing off, expired event) and for theme replace/remove leaving exactly one object and
  deletion (D18) emptying the theme folder; originals are byte-identical after keepsakes are made.
  Each style is rendered to image for portrait/landscape/square, with and without theme image,
  hashtag and message, then human-inspected against its DOM preview.
- **Full Set keepsakes** (D20): exactly five Full Set styles, and style ids are unique across both
  families; every Full Set entry has five in-bounds, non-overlapping slots; the signature style has
  two landscape, two portrait and one square slot, with slot 5 square and no four corners meeting;
  `coverCrop` is deterministic and matches CSS `object-position` semantics; the Full Set input has
  no message field and none of the forbidden keys. Integration against real Postgres: fewer than
  five committed captures, one hidden, one deleted, another session's or event's captures, sharing
  off, an expired event, and a Single-photo style id on the set route are all refused; hide →
  refused, unhide → the same five in the same order; order is stable under equal `committed_at`
  (falls back to `slot_index`); a hide between render and response returns not-found; no row or
  object is written and no frame is consumed. Each Full Set style is rendered for all-portrait,
  all-landscape and mixed sets, with and without theme image and hashtag, then human-inspected
  against its DOM preview.
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

**Function region (found in Slice 16):** the Vercel project runs functions in its default US East
region (`iad1`) while Supabase is in `ap-southeast-1`, so every query and storage read crosses the
Pacific. Function placement should be reconciled with the database region before real production
traffic (a deployment-configuration step, recorded in docs/progress.md).

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
| HEIC conversion needed and expensive or lossy | Photo pipeline rework | Materialized in Slice 15: the prebuilt `sharp` can't decode HEVC HEIC. MVP accepts JPEG/PNG/WebP directly and relies on browser conversion where it happens (§7 "HEIC/HEIF"); no client conversion or custom image stack. Originals stay untouched; the derivative path is isolated behind `lib/media/` |
| Venue network worse than resumable upload can absorb | Guests lose captures | Reservation TTL guarantees no permanently lost frame; measure real failure rates during capture-slice device testing |
| Service role key exposure | Total data compromise — RLS does not stop it (§10) | Server-only modules, no `NEXT_PUBLIC_` secrets, key never referenced outside `lib/dal/` and `lib/auth/` |
| PayMongo merchant onboarding requires completed KYC | Blocks payment slice, not development | Capture slices are built before payment; activation is gated by `activated_at`, seeded directly in dev |
| Bulk download of a full event exceeds serverless limits | Host cannot get their media conveniently | MVP ships sequential signed-URL downloads; server-side archive is a known follow-up |
| Keepsake render latency/cost higher than assumed (Single-photo target: p95 well under ~2 s, output a few hundred KB; Full Set gate in §7b: p95 ≤ 2.5 s warm, ≤ 5 s cold, ≤ ~800 KB) | Slow share/save on venue networks | Slice 16 measurement gate (§7b). If the Full Set misses it after tuning, add content-addressed persistence for that family (D19's runner-up) via a new decision; the render input is already deterministic |
| Geometric Full Set crops cut people out (a portrait photo in a landscape slot keeps about half its height, or less at extreme ratios) | Full Sets look careless | Deterministic cover crop with a top-biased focus (§7b); design avoids extreme slot ratios and compositions that need a perfect crop; human review of mixed-orientation renders in Slice 16. No content analysis in MVP |
| DOM preview ≠ Satori export for a style | Guest/host sees one thing, gets another | Satori-subset CSS only; per-style visual parity check in Slice 16; fallback to small server-rendered previews from the same templates |
| iOS/in-app browsers reject `navigator.share` after async work, or block blob saves | Share/save fails for some guests | Bytes fetched on style selection, before the Share tap; `?download=1` navigation for save; verified on real devices in Slice 16 |
| Theme image degrades signage scannability | Guests can't join | Fixed QR plate outside theming; per-format geometry tests; human print-and-scan in Slice 17 |
