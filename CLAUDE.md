# FiveFrames — Project Guide

A mobile-first web app for weddings. Each guest gets exactly five photos. That scarcity is the
product, not a storage limit. **There is no video feature** — it is post-MVP, and the
architecture reserves nothing for it.

## Where things are defined

| What | Where | Authority |
|---|---|---|
| Product requirements, scope, non-goals | [docs/product.md](docs/product.md) | **Authoritative.** Do not edit without an explicit request. |
| How the system is built | [docs/architecture.md](docs/architecture.md) | |
| Consequential decisions and their reasoning | [docs/decisions.md](docs/decisions.md) | |
| Implementation sequence | [docs/roadmap.md](docs/roadmap.md) | |
| Current state, blockers | [docs/progress.md](docs/progress.md) | Keep updated as slices land. |
| Next.js version rules | [AGENTS.md](AGENTS.md) | |

Put information in its one home and cross-reference. Do not copy it between files.

## Next.js

This is Next.js 16.3.4 — it differs from older conventions. **Read the relevant guide in
`node_modules/next/dist/docs/` before writing framework code.** Notably: middleware is now
`proxy.ts`; `cookies()`, `headers()`, and route `params` are async; Cache Components is opt-in
and we leave it off (decision D10).

## Invariants that must never break

These come from [docs/product.md §12](docs/product.md). Changing behavior here is a product
change, not a refactor.

1. A guest session can never hold more than 5 committed photos — under concurrency, rapid taps,
   or retries.
2. A frame is consumed only when the system safely accepted the media. Failed, abandoned, or
   timed-out uploads never permanently consume one.
3. Retries are idempotent. Never two captures from one submission.
4. Commitment is final for the guest. Host moderation never restores a frame.
5. Limits are enforced server-side. Client state is never the source of truth.
6. Capture is possible only while the event is paid, active, and explicitly opened by the host.
7. Payment must succeed before any event link or QR exists.
8. Media is never at a guessable public URL; an unrevealed gallery is never viewable.
9. A host can only reach events they own.
10. Original media is never modified. Derivatives are additional files.
11. The host can download their media at any point before permanent deletion.
12. The frame count (5 photos) is a constant. Never configurable, purchasable, or extendable.

## Engineering constraints

- **All data access goes through `lib/dal/`** with `import 'server-only'`. The browser never gets
  a Supabase client, never queries Postgres, and never uses Supabase Auth. The one permitted
  direct guest↔Supabase interaction is uploading bytes to Storage under a server-issued,
  path-scoped upload authorization — a per-upload capability, not database access.
- **Know what RLS does here.** The service role key our DAL uses **bypasses RLS entirely** — it
  is not a backstop on our code. Deny-all RLS exists only so that a future leaked anon key or a
  stray client-side call yields nothing. DAL discipline is the security model, and the service
  role key is the most sensitive secret in the system (architecture §10, decision D4).
- **Every event query carries an ownership or token predicate.** There is no "load event by id"
  without one.
- **Frame limits are database constraints**, not application counting (decision D5). Do not add
  a code path that counts rows and then inserts.
- **The reserve idempotency key comes from the client**, generated and persisted before the first
  request so it survives a reload (decision D6). Never mint it server-side on arrival — that lets
  one double-tapped confirm consume two of the guest's five frames. One `reserve_key` = one
  capture attempt = at most one row; duplicate confirms and retries reuse it, a different photo
  gets a fresh one.
- **An expired reservation is terminal for its key.** Never revive the row, reassign its slot, or
  allocate a second slot under the same key, and refuse commit for a lapsed reservation. The
  client starts a fresh attempt with a new key (architecture §6).
- **Re-check the capture gate on both reserve and commit**, not just at page render.
- **Photo uploads go directly to storage** via signed upload URLs, never proxied through the app
  server, and must be resumable or safely restartable.
- **Signed URLs are the result of an access check, never a substitute for one.**
- Schema changes are forward migrations in `supabase/migrations/`. No dashboard edits.

## Product-behavior rules that are easy to violate in code

- Never add engagement mechanics: no streaks, badges, progress nags, or "you still have 3 left".
  Remaining frames may be shown quietly and factually. Unused frames are a success.
- Never imply frame limits are per person. They are per browser session, and copy must say so.
- The sharing toggle governs FiveFrames' own sharing features only. Copy must not claim it stops
  a guest sharing media already on their device.
- No AI anywhere in the guest capture flow.

## Verification

Run before considering a change done:

```
pnpm typecheck
pnpm lint
```

Frame-mechanism changes additionally require integration tests against a real Postgres covering
concurrency, duplicate reserves sharing one key, retries, and reservation expiry. Real-device and
in-app-browser testing is human-run (roadmap slices 2 and 10) — do not attempt browser automation
for it.

## Authority boundaries

- Never edit `docs/product.md` without an explicit request. If architecture conflicts with it,
  surface the conflict rather than quietly changing the product.
- For consequential claims about an external provider's capabilities, cite first-party
  documentation. Third-party comparison articles are not evidence for a decision.
- Do not provision infrastructure, enable paid plans, or create external resources without asking.
- Do not deploy to production, run production migrations, or change production configuration.
- Never put secrets in documentation, and never prefix a secret with `NEXT_PUBLIC_`.
