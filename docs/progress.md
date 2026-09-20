# FiveFrames — Progress

Last updated: 2026-09-21

This file is current project state for a fresh implementation session, not a session log.
History and reasoning live in [docs/decisions.md](./decisions.md) (consequential decisions) and
git history (everything else). Update this file by rewriting it to match current reality, not by
appending narrative.

## Current phase

**Slice 1 — Host account and draft event: complete.**

A host can sign up (email confirmation required by this Supabase project), sign in, and is
gated out of `/dashboard` and `/events/*` until authenticated. From the dashboard a host can
create a draft event and configure it (name, date, timezone, host message, reveal timing
including a custom time, gallery visibility, sharing toggle, hashtag), with values round-tripping
correctly through the event's own timezone. `hosts`/`events` schema is live with deny-all RLS,
verified against the real anon key. A second host cannot read or write the first host's event —
covered by an integration test against the real dev database.

Manual verification (checklist below) passed — reported 2026-09-21.

## What exists

- **Decisions D1–D11** ([decisions.md](./decisions.md)) — all **Accepted**, standing architecture.
- **Roadmap** ([roadmap.md](./roadmap.md)) — 10 vertical slices; Slice 1 done, Slice 2 next.
- **Supabase project** `five-frames-dev` (ref `lrheuifbgbplekxnljfv`, region `ap-southeast-1`, org
  `five-frames`). Migrations workflow live in `supabase/migrations/`, applied with
  `supabase db push --linked`. `.env.local` holds the URL/publishable/secret keys locally
  (gitignored); `.env.example` documents the variable names.
- **Schema:** `hosts` (auto-synced from `auth.users` via trigger), `events` (owner, name, date,
  timezone, host message, reveal mode/time, visibility, sharing toggle, hashtag, lifecycle
  timestamps, nullable `event_token`/`gallery_token` — populated starting Slice 6, per invariant
  7). RLS enabled, deny-all, on both tables (decision D4) — confirmed live: anon key gets an empty
  result on `select` and a `42501` rejection on `insert`; service-role DAL round-trips normally.
  `supabase db advisors` is clean.
- **Auth:** `lib/supabase/server.ts` (cookie-bound auth client), `lib/supabase/service-client.ts`
  (service-role, DAL-only), `lib/supabase/proxy.ts` + `proxy.ts` (Next 16 proxy; session refresh +
  route gating via `getClaims()`), `lib/auth/host-session.ts`, `lib/auth/actions.ts`
  (`signUp`/`signIn`/`signOut` Server Actions). The browser never receives a Supabase client.
- **DAL:** `lib/dal/events.ts` — every function takes `hostId` and scopes its query by it
  (invariant 9); no function loads an event without that predicate.
- **Derived state:** `lib/events/lifecycle.ts` — `deriveEventLifecycleState` per decision D8.
  `pending_payment` is intentionally absent until Slice 6 adds the `payments` table.
- **Timezone handling:** `lib/events/timezone.ts` — converts `<input type="datetime-local">`
  values through an event's own IANA timezone, both directions, DST-aware (`Intl`, no added
  dependency). Any datetime field tied to an event's timezone must go through this, not a bare
  `new Date(string)` (see `CLAUDE.md`).
- **UI:** `app/(host)/` (protected dashboard + event editor), `app/login/`, `app/signup/`
  (public). shadcn components added: `card`, `input`, `label`, `select`, `switch`, `textarea`.
- **Testing:** Vitest installed and in use (`pnpm test`) — unit tests
  (`lib/events/lifecycle.test.ts`, `lib/events/timezone.test.ts`) and integration tests against
  the real linked dev Postgres (`lib/dal/events.integration.test.ts`).
- **Not yet built** (later slices, by design): payment, `event_token`/`gallery_token` issuance,
  guest sessions, captures, gallery reveal. The `events` columns Slice 6 will populate already
  exist (per architecture §4) but nothing writes to them yet.

## Verification status

- `pnpm typecheck` — passing.
- `pnpm test` (Vitest) — 15/15 passing (lifecycle derivation, event ownership isolation against
  real Postgres, timezone conversion).
- `pnpm lint` — passing (fixed 2026-09-21; see below). 1 pre-existing warning
  (`app/layout.tsx`: unused `Geist` import), no errors.
- Manual RLS check against the live dev project (anon key: denied read+write) — passed.
- Human manual verification of the Slice 1 checklist — **passed, reported 2026-09-21.**

**Lint toolchain fix (2026-09-21):** `pnpm lint` previously crashed on every file
(`TypeError: contextOrFilename.getFilename is not a function`). Root cause: `eslint@10.11.0`
removed the deprecated `context.getFilename()` API that `eslint-plugin-react@7.37.5` (the latest
release, pulled in by `eslint-config-next@16.3.4`) still calls internally — no newer
`eslint-plugin-react` exists yet with a fix. Resolved by pinning `eslint` to `^9` (installed
`9.39.5`, the last major before the removal), which `eslint-config-next` already supports
(`peerDependencies: "eslint": ">=9.0.0"`). No other dependencies changed.

## Regression protection added for human-found defects

Three defects surfaced during manual verification and were fixed at the root cause. Protection
is a mix of automated tests and documented guards — not all three got a test:

1. **Signup gave no feedback when email confirmation was required.** Fixed by checking
   `data.session` instead of assuming success means "signed in." **No automated regression test**
   — this is a UI branch on provider response shape, not something covered by the current test
   setup; guarded only by the code itself and the note in `CLAUDE.md`.
2. **Reveal-mode/visibility dropdowns showed the raw enum value instead of the label.** Fixed by
   passing an `items` map to `Select.Root`. **No automated regression test** — protected by a
   documented gotcha in `CLAUDE.md` ("Recurring implementation gotchas in this stack") so the same
   mistake isn't repeated the next time a `Select` is added.
3. **Custom reveal time drifted after save+reload** (timezone conversion used the server
   process's timezone instead of the event's, and display didn't convert at all). Fixed with
   `lib/events/timezone.ts`. **Automated regression tests added** —
   `lib/events/timezone.test.ts`, including the exact reported Asia/Manila midnight case and a
   DST-crossing case.

Cross-project lessons from these three were promoted to `~/.claude/rules/application-quality.md`;
the defect-to-regression handling process itself was added to the global build-app skill
(`~/.claude/skills/build-app/SKILL.md` §32), for future sessions. None of this touched
`docs/product.md`.

## Next slice

**Slice 2 — Guest join and photo capture** ([roadmap](./roadmap.md)) — highest technical risk.
Not started. Needs, when it begins: `guest_sessions` and `captures` tables (client-generated
`reserve_key`, partial unique slot index per D5/D6), direct-to-Storage signed uploads, and early
real-device validation (iPhone Safari, Android Chrome, FB/Messenger/IG in-app browsers, one
interrupted upload, HEIC behavior) as an exit condition, not a later pass.

## Blockers and open items

| Item | Type | Affects |
|---|---|---|
| PayMongo account with KYC completed | External prerequisite | Slice 6 |
| No git remote configured | Setup | Any push/CI work |
| In-app browser (FB/Messenger/IG) camera and upload behavior unproven | Technical risk | Validated as an exit condition of slice 2 |
| Service role key is the single highest-value secret; RLS does not constrain it | Security constraint | All slices |
| Safety-net close duration (48–72h) and expiry grace period (~30d) | Launch policy, from spec §19 | Slice 9 |
| HEIC conversion necessity on current devices | Open, from spec §19 | Answered during slice 2 device testing |
| Refund/retention/deletion legal copy | Business decision, from spec §19 | Pre-launch |
