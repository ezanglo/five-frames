# FiveFrames — Project Guide

A mobile-first web app for capturing shared moments at any live event — weddings, birthdays,
parties, reunions, trips, company gatherings, and other shared occasions. Each guest gets exactly
five photos. That scarcity is the product, not a storage limit. **There is no video feature** —
it is post-MVP, and the architecture reserves nothing for it.

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
13. Privileged operator mutations (confirming a manual payment, recording a manual refund) are
    server-authoritative and auditable, and happen only through the Operator Console — never a
    host-declared, ad hoc, or undocumented action.

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
- **Event join capacity (launch hypothesis of 250 sessions/event) is an atomic counter**, not a
  count-then-insert check (decision D13). Do not add a code path that reads
  `guest_session_count` and then inserts a `guest_sessions` row in a separate statement — that is
  the exact race D6 already documents for frames, applied to sessions instead. Unlike the 5-photo
  allowance, this cap is a configurable column (`guest_session_cap`), not a hardcoded constant —
  it is a hypothesis to validate, not a permanent invariant like §12 above.
- **The public pre-purchase demo never touches the DAL, Postgres, or Storage** (decision D14). It
  is a client-only route; no server action, no signed upload URL, no persisted row, no token. If a
  demo feature seems to need server-side state, that is a signal the feature belongs in the real
  event flow, not the demo.
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
- **Operator status is a DAL check (`requireOperator()`), never a client-supplied claim.** Grant it
  only via the checked-in `pnpm ops:grant-operator` script — never a direct database edit as the
  ordinary workflow, and never an in-app self-service flow (decision D15).
- **An operator cannot confirm a manual payment or refund for an event they own.** Enforce this as
  a DAL equality check (`event.host_id !== operatorUserId`) on those two mutations, not a UI-only
  restriction (architecture §5a).
- **Provider and manual payment activate through one shared `activateEvent` function**, guarded by
  a single atomic `WHERE activated_at IS NULL` update (decision D16) — the same pattern as the
  frame slot mechanism and event-join capacity. Never write a second, payment-source-specific
  activation code path.
- **Manual-payment mutations (confirm, refund) happen only through the Operator Console.** Do not
  add a host-facing route, generic admin endpoint, or script that performs them in production.
- **The Operator Console shows aggregate counts, never individual guest media.** Do not add a DAL
  function an operator route could use to obtain a capture's signed image URL.
- Schema changes are forward migrations in `supabase/migrations/`. No dashboard edits.

## Recurring implementation gotchas in this stack

- **Event-local datetimes go through `lib/events/timezone.ts`.** An event has its own configured
  IANA timezone, independent of the server's or the browser's. Never feed a bare
  `<input type="datetime-local">` value into `new Date(string)` — that parses it in the server
  process's own timezone, not the event's, and silently stores the wrong instant. Convert with
  `zonedDateTimeLocalToUtcIso` on save and `utcIsoToZonedDateTimeLocal` on display, both ways,
  every time such a field round-trips through the UI.
- **Supabase Auth on this project requires email confirmation** (project default). `signUp()`
  returns success with no `error` even when no session is issued — check `data.session`, not just
  `error`, and tell the user to confirm their email rather than redirecting into a session that
  doesn't exist yet.
- **shadcn/base-ui `Select` needs an `items` map** (`{ value, label }` array or record) passed to
  `Select.Root` for `SelectValue` to render the human-readable label. Without it, the trigger
  displays the raw stored value (e.g. `after_event`) instead of the label — the `<SelectItem>`
  children alone aren't enough.

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
concurrency, duplicate reserves sharing one key, retries, and reservation expiry. The same applies
to changes touching event-join capacity (D13) or event activation (D16) — both use the identical
atomic-guard pattern and need a concurrency test proving the guard actually holds.

### Browser automation boundary

Browser automation is allowed for automated functional, responsive, and objective visual
verification when an active validation Skill such as `/e2e-validate` explicitly calls for it.
Browser automation may use Chromium/WebKit/etc. to exercise deployed application behavior, but
browser emulation must never be represented as proof of physical-device or native-platform
behavior.

Browser automation does NOT count as verification of:

- physical iPhone or Android device behavior;
- native camera/photo-picker behavior;
- native iOS/Android share sheets;
- actual Facebook, Messenger, or Instagram embedded browsers;
- physical printed-QR scanning;
- genuine venue Wi-Fi/mobile-network conditions.

Those remain human/real-device verification (roadmap slices 2 and 14) unless actually exercised
through an approved real-device testing system.

Automated E2E results may reduce the manual checklist by proving application-level behavior, but
they must not replace product acceptance criteria that explicitly require real devices or
real-world conditions.

Never claim:

- WebKit emulation = real iPhone Safari;
- mobile Chromium emulation = real Android Chrome;
- user-agent emulation = a real in-app browser;
- network throttling = real venue-network validation.

## Authority boundaries

- Never edit `docs/product.md` without an explicit request. If architecture conflicts with it,
  surface the conflict rather than quietly changing the product.
- For consequential claims about an external provider's capabilities, cite first-party
  documentation. Third-party comparison articles are not evidence for a decision.
- Do not provision infrastructure, enable paid plans, or create external resources without asking.
- Do not deploy to production, run production migrations, or change production configuration.
- Never put secrets in documentation, and never prefix a secret with `NEXT_PUBLIC_`.
