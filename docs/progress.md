# FiveFrames — Progress

Last updated: 2026-09-30 (brand identity v1.0 applied — see "Brand identity rollout" below. Before that, marketing motion polish — see "Marketing motion polish". Before that: contracted UI/UX designer handoff implemented across the whole app —
`awaiting human visual approval`, see "UI/UX redesign — contracted designer handoff" below. Slice
14 — full-flow real-device and venue-condition validation — is still `awaiting human
verification`; its checklist predates the redesign, so run it against the redesigned UI. Earlier
note: a focused `/e2e-validate` pass found two defects (host downloads navigating instead of
saving; a refunded payment misclassified as an unresolved duplicate), both repaired — see
"Regression protection added for human-found defects" → "Slice 14". Same day, follow-up pass:
the Operator Console, branded share card, 404/error pages and app icons moved onto the design
system too — nothing in the app still uses the retired look.)

This file is current project state for a fresh implementation session, not a session log.
History and reasoning live in [docs/decisions.md](./decisions.md) (consequential decisions) and
git history (everything else). Update this file by rewriting it to match current reality, not by
appending narrative.

## Brand identity rollout (2026-09-30): `awaiting human visual approval`

The new logo (`docs/design-direction.md` → "Brand identity") replaces the text-only wordmark and
the old app icon everywhere the brand appears. Design only; no product behavior change.

- **Source:** `lib/brand/logo.ts` (symbol, 16px pixel drawing, outlined wordmark, lockup, tones);
  `components/ff/brand-mark.tsx` (`BrandMark`, `BrandLockup`).
- **Applied to:** every header via `Wordmark` (marketing, auth, host, guest, Operator, demo,
  404/error); the marketing mockups (photo header, table card, host dashboard); the Open Graph
  image; the guest share card's foot; the top of all four signage formats (whose QR is now
  rendered at 2× for print, and whose table card QR is 236px, down from 260, to make room); and
  `app/icon.svg` (adaptive ink/white), `app/favicon.ico` (violet tile, 16/32) and
  `app/apple-icon.png` (180, full-bleed violet).
- **Verification:** `pnpm typecheck` ✔ · `pnpm lint` ✔ · `pnpm test` 202/202 ✔ (new
  `lib/brand/logo.test.ts`: exactly five frames, no overlaps, 2 landscape/2 portrait/1 square,
  whole-pixel favicon; `signage.test.ts`: every format carries the outlined lockup). Signage,
  share card and OG image were rendered to PNG and inspected. No browser pass was run.
- **Human sign-off needed:** the lockup's size and alignment in each header (with and without
  the Host/Operator tag), the tab icon in light and dark browser themes, the iOS home-screen
  icon, and one printed table card.

## Marketing motion polish (2026-09-30): `awaiting human visual approval`

Restrained motion system for the public marketing site (`docs/design-direction.md` → "Marketing
motion"). Marketing only; no product behavior, copy/IA, app screen or demo change.

- **Hero (`/`):** the desktop phone mockups are replaced by "five prints": one guest's five kept
  frames (numbered 1–5, portrait/square/landscape) as printed photos on a shallow surface. They
  settle in back to front on load, respond to a real mouse with a few px of depth parallax, and
  gather/straighten slightly as the hero scrolls away. Tablet/mobile keep a simple row of five
  prints with a CSS entrance only. 1024–1279: narrower visual column (400, stage scaled 0.76) and
  a 60px headline, so the CTAs sit above the fold at 1024×768 (they were below it before).
- **Elsewhere on `/`:** the same five prints drop into the "Why five" card when it scrolls into
  view; the host dashboard figure and the six occasion cards rise in once. Nothing else moves.
  `/how-it-works`, `/pricing`, `/faq`, `/demo` are unchanged.
- **Three.js: not used.** The images are flat vector illustrations, so a WebGL scene would add a
  ~150 KB+ dependency, texture rasterization, and a fallback path for an effect that CSS
  transforms/perspective already give crisply at any pixel density, with no bundle cost.
- **No new dependency.** CSS keyframes/transforms plus a ~2 KB rAF loop that stops when idle.
- **Performance:** homepage entry JS 54.6 → 55.7 KB gzipped (+1.1 KB); the motion code is one
  2.3 KB-gz chunk loaded only by `/`. Prints and images are server-rendered HTML. CLS 0 (1440,
  390). The loop makes no style writes once settled and ignores input while the hero is
  off-screen; it never runs below 1024px, without a mouse, or under reduced motion.
- **Verification:** `pnpm typecheck` ✔ · `pnpm lint` ✔ · `pnpm build` ✔ · `pnpm test` 190/190 ✔
  (24 files; new `lib/marketing/hero-prints.test.ts` guards exactly five prints, in-bounds layout,
  shallow motion). Playwright/Chromium on the local dev server at 390, 768, 1024, 1280, 1440,
  1600: no horizontal overflow, no console/hydration errors, CTA is the hit target, entrance
  mid-frame and pointer-parallax frames inspected, reduced motion static from first paint (no
  animation, full opacity at 150 ms, no parallax), JavaScript disabled renders the finished
  composition, route away/back and resizing below 1024 re-attach or detach cleanly. Emulated
  Chromium only. Not evidence for real Safari/iOS, Firefox, or trackpad feel.
- **Human sign-off needed:** (1) taste: does the five-print hero read as FiveFrames and feel calm
  and weighted rather than floaty, on a real laptop with a trackpad/mouse; (2) Safari and Firefox
  desktop rendering of the prints (shadows, tilt crispness); (3) a real phone: the hero row's
  entrance and the "Why five" drop-in feel light, and nothing janks while scrolling; (4) with
  the OS "Reduce motion" setting on, the homepage is fully still.

## Desktop/browser responsive pass (2026-09-29): `awaiting human visual approval`

Laptop/desktop made first-class (`docs/design-direction.md` → "Desktop and browser"). Design
only; no product behavior, capture/upload/commit logic, authorization, gallery visibility,
download, lifecycle or demo-isolation change.

- **Redesigned for desktop (≥1024) and tablet (768–1023):** guest Join (open / not open /
  closed / full / not found), Your Five, Preview + Message, Completion (open and after close),
  own-photo viewer; public gallery locked / private / revealed and its viewer; `/demo`; 404 and
  error screens (they share the guest shell). Mobile (< 768) is unchanged.
- **Shared primitives:** `GuestShell` `variant` (`split` | `wide`), `width`, `panel`,
  `motifPhotos`; `SheetActions` desktop behavior; new `components/ff/frame-motif.tsx` (also
  used by the auth brand panel, same look); desktop compositions inside `PreviewSheet`,
  `PhotoViewer`, `OwnPhotoList`, `GalleryArchive`.
- **Audited, already desktop-composed, left as is:** `/`, `/how-it-works`, `/pricing`, `/faq`
  (1200 editorial layouts, FAQ side nav), auth (640 + 420 split).
- **Not audited in this pass:** host (`/dashboard`, create wizard, event Dashboard/Photos/
  Settings) and Operator Console. The session's permission classifier blocked reading their
  layout/chrome source and blocked data access to the dev Supabase project (which also backs
  Vercel Production), so they were neither inspected nor screenshotted. Per the existing notes
  they implement the handoff's D-series desktop templates; confirm visually.
- **Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (23 files, 186
  tests) pass. Browser screenshots (Chromium via Playwright, local dev server) at 360, 390,
  430, 768, 1024, 1280, 1440 and 1600 wide for public pages and every guest/gallery/demo state
  above — data-backed guest states rendered through a temporary, uncommitted fixture route
  with sample images, not live events. No horizontal overflow at any size; only Completion at
  1024×768 scrolls (~110px). Browser emulation is not real-device evidence (Slice 14 still
  covers that).
- **Open visual notes:** the story panel is decorative night + violet glow (no cover images
  exist); share buttons on desktop Completion cards sit on the photo (secondary style).

## UI/UX redesign — contracted designer handoff (2026-09-29): `awaiting human visual approval`

The designer handoff in `docs/design-handoff/` is now the authoritative visual direction
(`docs/design-direction.md`, which replaces every previous visual exploration). Implemented as a
reusable system (`app/globals.css` tokens, `components/ff/*` primitives and shells) and applied
to every guest, host, auth, gallery and demo screen. No product behavior, authorization, payment,
lifecycle, frame mechanics or download architecture changed; the reserve → upload → commit code
path is untouched.

**Screens implemented** (route → handoff screen):

- Auth: `/signup` (D1/04b), `/login` (D1b/04a), `/forgot-password` → check inbox (D1c–d/04c–d),
  `/reset-password` (D1e/04e), new `/auth/confirm` link handler.
- Host: `/dashboard` events — first-time empty state and populated grid/list with Live/Upcoming/
  Past filters and desktop search (D2/D2b/05); `/events/new` + `/events/[id]/setup?step=details|
  look|share` create wizard (D3–D5/05a–c); `/events/[id]` dashboard, `/events/[id]/photos`,
  `/events/[id]/settings` as three tabs under one cover header (D6–D8/06, 06b, 07).
  `/events/[id]/checkout` now forwards to the Share step (PayMongo's `cancel_url` still lands there).
- Guest: `/e/[token]` join open / not open yet / capture closed (with and without a session) /
  full; Your Five; Preview + Message; Completion; own-photo viewer (01–04).
- Public gallery: `/g/[token]` locked (with host-set custom reveal countdown), private, revealed
  grid, photo viewer (05). `/demo` and `/` restyled on the same system.

**Small, behavior-preserving additions made for the handoff** (all ownership-scoped, no schema
change): host full name stored in Supabase user metadata at signup (host-side greeting only,
never shown to guests); password reset via Supabase's standard recovery email; resend of the
signup confirmation email; `capturedAt`/`guestSessionId`/`displayUrl` fields on existing capture
views; `listEventsWithPhotoCountsForHost`; a "Reveal gallery" shortcut that sets the existing
"Immediately" reveal timing; guest "Download my photos". Guest original download URLs now carry
an attachment disposition (same defect class fixed for hosts in Slice 14 — otherwise a sequential
download navigates away after the first photo); regression test updated to assert it.

**File moves** (older notes below still use the old paths): `frame-grid.tsx` → shot slots in
`capture-slots.tsx` + `components/ff/shots.tsx`; `own-captures.tsx` → `own-photos.tsx`; host
`gallery-grid.tsx` → `(manage)/photos/photo-manager.tsx`; `link-row.tsx` → Settings "Links" card
(`(manage)/settings/page.tsx`); `g/[token]/photo-viewer.tsx` → `components/ff/photo-viewer.tsx`;
`events/[eventId]/page.tsx` → `(manage)/page.tsx`; checkout content → `setup/page.tsx` Share
step; `app/login`, `app/signup` → `app/(auth)/…`.

**Defect class fixed during the pass:** `cn()` treated the new font-size tokens (`text-button`,
`text-label`, …) as colors and silently dropped real text colors (primary buttons rendered dark
text on violet). Tokens are now registered in `lib/utils.ts`; `lib/utils.test.ts` guards it.

**Product conflicts** — handled by keeping product behavior; full list with rationale in
`docs/design-direction.md` → "Known discrepancies". Items that need a **user decision** only if the
product should change:

1. Cover photo and event theme color (Create · Look, Settings) — not product capabilities today.
2. Guest preview before payment — product.md §7.2 forbids it; shown only post-activation.
3. Delete event (Settings danger zone) — no host event-deletion capability exists yet.
4. Photographer name/time in the *public* gallery viewer and the Join-screen guest count —
   withheld (data exposure / engagement nudge).

**Follow-up pass — remaining surfaces (2026-09-29, same day):**

- **Operator Console** (`/operator`, `/operator/events/[id]`) rebuilt on `components/ff` (host
  desktop template; see `docs/design-direction.md` → "Surfaces outside the handoff"). Same DAL
  calls, server actions and privilege checks; no new data exposed (aggregate counts only). Three
  display fixes made on the way: lifecycle times now render in the event's timezone (previously
  the server process's locale/timezone); reveal timing, visibility, payment method and provider
  status show labels instead of raw values (`after_event`, `bank_transfer`, …) via the new
  `lib/events/labels.ts`; the manual-payment "received at" default is now "now" in the event's
  timezone, matching how the action interprets it (previously the operator's browser time).
  `window.confirm` replaced by `ConfirmSubmitButton` (native `<dialog>`, runs form validation
  first). Removed: `.operator-scope` tokens, `state-indicator.tsx`, all of `components/ui/*`.
- **Branded share card** redrawn in the new palette with bundled Fraunces 600 and Plus Jakarta
  Sans 500/700/800 TTFs (OFL, from Google Fonts); the Bricolage/Inter files were removed. Build
  traces confirmed to include the new fonts. Share cards are stored per capture once generated,
  so any generated before this change keep the old design.
- **404 and error pages** added (`app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`)
  on the guest shell; fonts moved to `app/fonts.ts` so `global-error` can load them.
- **App icons** replaced the stock Next.js favicon: `app/icon.svg`, a brand `favicon.ico`
  (16/32/48) and `apple-icon.png` (180).
- Verification: typecheck ✔ · lint ✔ · build ✔ · `pnpm test` 167/168 on the first run, then
  the timed-out test's file (`captures.integration.test.ts`, one test past the 5 s default)
  passed 16/16 on rerun — no capture code changed in this pass. Share card checked by rendering
  landscape/portrait/square/long-text samples. No browser automation in this pass — see
  checklist item 7.

**Automated verification (2026-09-29):** `pnpm typecheck` ✔ · `pnpm lint` ✔ · `pnpm build` ✔
(new routes `/auth/confirm`, `/events/new`, `/events/[id]/setup`, `/events/[id]/photos`,
`/events/[id]/settings`, `/forgot-password`, `/reset-password`) · `pnpm test` 168/168 ✔ (22 files;
the known `lifecycle.integration.test.ts` timeout flake appeared once and passed on rerun).

**Browser verification (Playwright, headless Chromium, against `next dev` + the dev Supabase
project):** every screen above rendered and compared against the handoff boards at guest 360/390/
430 and host 390/1024/1280/1440, with no horizontal overflow anywhere. Exercised through the real
UI: sign in, create-event wizard (desktop and mobile), activation (dev script), three guests
joining and committing photos through the real reserve/upload/commit path (partial, full five,
discarded retake that correctly consumed nothing), whitespace-name error state, hide/favorite in
Photos, Settings dirty/discard, custom reveal time round-trip in the event timezone, capture close
from the mobile toggle → after-event reveal, locked and revealed public gallery, long event name.
This is emulated Chromium — not evidence for real iPhone Safari, Android Chrome, in-app browsers,
native pickers, or venue networks (still Slice 14 human scope). Not pixel-perfect: compositions,
hierarchy, tokens and type match; source photography is replaced by the no-cover gradient and
synthetic test images.

**Dev test data created** (dev Supabase project only): synthetic identities
`design-verify-host@example.com` (4 events: live, upcoming, revealed, long-name draft, with 15
synthetic photos from 5 guest sessions), `design-verify-empty@example.com` (no events),
`design-verify-operator@example.com` (no operator grant). Created with
`pnpm e2e:provision-identities`; passwords are not recorded here.

**Environment note:** `.env.local`'s first line reads `EXT_PUBLIC_SUPABASE_URL=` (missing the
leading `N`), so `NEXT_PUBLIC_SUPABASE_URL` is undefined locally; this pass passed it as a
process env override without editing the file. The `E2E_*` variables this file previously listed
are also no longer in `.env.local`.

**Human visual-approval checklist** (real phone + desktop browser):

1. Guest on a real phone: join, take/choose a photo, Retake, Keep, reach Completion, download
   your photos (each file saves, the page doesn't navigate away). Check the sheet/keyboard
   behavior on Preview and that the header runs under the status bar without overlap.
2. Guest link before capture opens and after it closes (with and without having joined).
3. Host desktop and phone: events list, create wizard, dashboard capture toggle, Photos
   (hide/unhide/favorite/delete confirm/download all), Settings save/discard/leave-page warning.
4. Password reset end to end (needs the Supabase redirect allowlist to include
   `<origin>/auth/confirm` for each environment — configuration, not code).
5. Public gallery locked/revealed, viewer swipe/arrows/Escape.
6. Taste: does the result read as the contracted handoff? Report any screen that doesn't.
7. Follow-up surfaces: `/operator` list (search, empty result) and an event detail at phone and
   desktop widths — confirm-payment and record-refund dialogs (Cancel leaves the form untouched;
   a missing required field is flagged before the dialog opens); a mistyped URL and another
   host's event id (both show "We can't find that page"); a newly generated share card from a
   guest's own photo; the new browser-tab icon and iOS home-screen icon.

## Current phase

**Slices 1–13: complete. Slice 14 (full-flow real-device and venue-condition validation,
product.md, roadmap criteria 29/30) is `awaiting human verification` — status set 2026-09-23.**

Slice 14 is defined by the roadmap itself as human-run, not automated ("Human-run on real
devices. Not automated. ... this is a regression and end-to-end pass, not the first look at
device behavior — slice 2 already validated the capture flow on the same browsers") for the
device/in-app-browser/network scope. A separate, explicitly invoked `/e2e-validate` pass (and,
for this repair, a bounded, explicitly authorized Playwright verification against the real dev
deployment — see the "Slice 14" entry under "Regression protection added for human-found defects"
below) is a different, narrower kind of check: proving these two specific code defects are fixed
against a real browser and the real dev database, not a substitute for the human-device checklist
below. Accordingly, this slice's implementation work was: (1) run every automatable check, (2)
inspect deployed environment configuration for health and presence without ever reading or
printing a secret value, (3) assemble the full validation matrix and checklist the roadmap's 14
sections require, so a human can execute it directly against the real deployment without needing
to reconstruct scope from conversation history, (4) repair the two defects `/e2e-validate` found
and reverify them, and (5) stop and hand off, per this slice's own manual-verification boundary.

**Slice 14 — automated verification (2026-09-23, reverified after the defect repair):**

- `pnpm typecheck` — passing, no errors.
- `pnpm lint` — passing, no errors or warnings.
- `pnpm build` — passing. Route table unchanged in shape from the last recorded build (`/e/[token]`,
  `/events/[eventId]`, `/g/[token]`, `/operator`, `/operator/events/[eventId]`,
  `/api/cron/lifecycle`, `/api/webhooks/paymongo` all still register as dynamic; `/demo` still
  prerenders static).
- `pnpm test` — 162/162 passing on a clean rerun (157 pre-existing + 5 new regression tests for
  the two repaired defects, see below). One run showed a single timeout in
  `lib/dal/lifecycle.integration.test.ts`'s deletion-failure-isolation test (a real-dev-database-
  under-load timeout, the same pre-existing flakiness class already recorded under "Verification
  status" below); an immediate rerun passed 162/162, confirming it is not a regression from this
  repair.
- Two real, project-specific defects were found by a focused `/e2e-validate` run and fixed in
  this pass — see the "Slice 14" entry under "Regression protection added for human-found
  defects" below for root cause, fix, and regression coverage for each. Everything else this
  slice's scope covers (camera behavior, real in-app-browser share sheets, physical QR scans,
  real PayMongo test-mode payment UX, venue network conditions) remains observable only on real
  hardware — the human checklist below is unaffected by this repair.

**Slice 14 — deployed environment check (2026-09-23, via `vercel` CLI metadata only — no secret
value was read or printed):**

- **Deployment health:** the latest Production deployment
  (`five-frames-hbfq1le18-ezanglos-projects.vercel.app`, promoted to `https://five-frames.vercel.app`)
  shows `● Ready`. **PASS.**
- **Required env config present in Production:** `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GUEST_SESSION_SECRET`,
  `PAYMONGO_SECRET_KEY`, `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY`, `PAYMONGO_WEBHOOK_SECRET` all present.
  **PASS.**
- **`CRON_SECRET` is now present in Production** (added ~23 minutes before this check) — **the
  Slice 12 deployment prerequisite that was previously open is now satisfied structurally.** This
  is new since the last progress.md update; see §13 of the checklist below for the one remaining
  step (an actual authenticated invocation) that only a human running `curl` with the real secret
  value can perform — this environment must not read or transmit that value itself.
- **PayMongo Test mode / webhook delivery health:** **not verifiable from this environment.**
  The public/secret key values are only ever shown truncated by `vercel env ls`, and whether they
  are `pk_test_`/`sk_test_` vs. `pk_live_`/`sk_live_` is a fact this session should not decode or
  assert from a partial value — the PayMongo dashboard is the authoritative source per this
  project's own research-integrity rule (prefer first-party sources for provider-capability
  claims), and reading it requires the human's own PayMongo login. See §1 of the checklist below.
- **Preview environment is missing `CRON_SECRET`, `PAYMONGO_SECRET_KEY`,
  `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY`, `PAYMONGO_WEBHOOK_SECRET`** (only Supabase/guest-session vars
  are set there). Not a blocker — every real-device pass recorded in this file so far (Slices 2,
  3, 8) tested against the Production URL, not a Preview deployment, and the checklist below
  continues that pattern. Recorded here only so a future session doesn't assume Preview is
  payment-capable.
- No production/live financial configuration was mutated, viewed in decoded form, or referenced
  anywhere in this file or in code.

**Slice 13 (public pre-purchase demo, product.md §7.1, decision D14,
roadmap criterion 16) landed 2026-09-23.**

- **Route (`app/(demo)/demo/page.tsx` + `demo-experience.tsx`), entirely client-side per D14:**
  a static, unauthenticated page (confirmed prerendered `○` in the production build output — no
  server data dependency at all) rendering the five-frame mechanic against either a bundled
  sample photo or a visitor-picked file held only as an in-browser `ObjectURL`. No DAL import, no
  Supabase client, no server action, and no fetch to any `/api/*` route exists anywhere under
  `app/(demo)/` — enforced by `lib/demo/route-isolation.test.ts`, which reads the route's own
  source files and fails if that ever changes, rather than relying on a one-time manual check.
- **Reuses the accepted guest visual identity**, not a new design: the `.guest-scope` CSS scope
  (`app/(demo)/layout.tsx`) and the real guest `FrameGrid` component
  (`app/(guest)/e/[token]/frame-grid.tsx`) are imported directly and unmodified — the demo passes
  it local-only `FrameState` values (`kind: "filled"` with `downloadUrl: null`, so `FrameGrid`
  never renders a download affordance for a fake photo) rather than forking the component.
- **Local, DOM-free five-frame state** (`lib/demo/state.ts`, unit-tested in `state.test.ts`): a
  `DemoFrames` tuple of five slots (`empty` / `filled` with `source: "own" | "sample"`), pure
  immutable transitions (`withSlotFilled`, `withSlotCleared`, `nextEmptySlotIndex`,
  `isDemoComplete`) with no React or browser dependency — same "pure logic, DOM-free, unit
  testable without jsdom" pattern Slice 10 established for `lib/share/web-share.ts`, since this
  project's tooling has no jsdom.
- **Bundled sample photos** (`lib/demo/samples.ts`, unit-tested): five inline SVG data URIs
  generated in code, not shipped image files — no `public/` asset, no network fetch, nothing that
  could be mistaken for a real guest's photo. A visitor may pick their own photo instead; that
  file never leaves the browser (`URL.createObjectURL`, never uploaded).
- **Object URL lifecycle:** every own-photo `ObjectURL` the demo creates is tracked in one ref
  (`ownUrlsRef`, a `Set`) and revoked when its composing attempt is discarded, when the visitor
  taps "Start over," or on unmount (`useEffect` cleanup) — a committed sample photo needs no
  revocation since it's an inline data URI, never a blob URL.
- **Commitment is local-only:** "Keep this frame" only ever calls `setFrames`/`withSlotFilled` in
  React state — there is no reserve/commit/upload cycle to mirror, since there is nothing to
  persist. A filled demo slot cannot be un-committed except by "Start over" (which resets every
  slot, matching the real product's "commitment is final for the guest" tone at demo scale) —
  the only reset path, deliberately: no page reload persistence was added (no `localStorage`), so
  reloading the page and tapping "Start over" both land on the identical five-empty-slots state.
- **Explicit, non-automatic CTA:** the "Create your event" button is a plain `<Link href="/signup">`
  the visitor must tap — nothing in the demo auto-creates an account, auto-navigates, or treats
  demo completion as an implicit conversion event. Pricing copy reads the same
  `EVENT_PRICE_PHP` constant (₱999) the real checkout page already uses (`lib/payments/pricing.ts`,
  no `server-only` import, safe to read client-side), so the demo cannot drift from the real
  launch price, and does not present ₱1,490 as a reference price (product.md §7.2/§19 — that move
  is a later business decision, unimplemented anywhere in code).
- **Privacy/trust copy:** a persistent header line states demo photos stay on the visitor's
  device and are never uploaded or saved, and a footer line states a real event needs host setup
  and payment — both true by construction, not overstated (no claim about what happens to a real
  guest's media once an event is real, which is out of scope for a demo screen).
- **No gamification:** no frame countdown, no "X left" copy, no urgency/countdown on the CTA —
  matching product.md's existing no-nagging rule, the same restraint the real guest capture UI
  already applies (it shows no numeric counter either, only the five frames themselves).
- **Testing:** `lib/demo/state.test.ts` (five-frame local state: fills in order without mutating
  the previous array, reaches "complete" only at five, clearing a slot makes it reachable again,
  source/message are preserved per slot, out-of-range index throws). `lib/demo/samples.test.ts`
  (exactly five samples, every one an inline `data:image/svg+xml` URI never a remote URL,
  distinct ids/labels/rendered content). `lib/demo/route-isolation.test.ts` (reads every file
  under `app/(demo)/` and fails if any forbidden import/call appears — `lib/dal/*`, any
  Supabase import, `server-only`, `createSignedUploadUrl`/`createSignedReadUrl`/
  `generateLinkToken`, or a `fetch("/api/...")` call — satisfying the roadmap's own "verified by
  code inspection" requirement as an executable check rather than a one-time manual read).
  `pnpm typecheck`, `pnpm lint`, `pnpm build` (confirms `/demo` prerenders as static `○`, i.e. no
  server data dependency exists even structurally), and the full `pnpm test` suite (157 tests
  across 20 files, including this slice's 3 new files) all pass.
- **Manual verification:** none required for this slice specifically — the demo has no
  camera/file-picker behavior beyond what Slice 2's real-device pass already validated for the
  same `<input type="file" accept="image/*" capture="environment">` pattern reused here unchanged.
  Slice 14's full-flow device pass will still exercise `/demo` as part of the general regression
  sweep, but nothing here introduces new device-specific risk.

**Former current-phase entry (Slice 12), preserved below:**

Slice 12 (lifecycle automation and retention, product.md §7.3/§15.2,
decision D18, roadmap criterion 12) landed 2026-09-23.

- **Real defect found and fixed, not just new work:** before this slice, no real
  activation/capture-open code path ever set `safety_net_closes_at`, `hosted_until`, or
  `grace_until` — only the dev-only `pnpm dev:activate-event` script did. That meant the automatic
  capture safety-net close, hosted-access expiry, and the grace period had never actually fired
  for a single real, provider- or manually-activated event, even though `deriveEventLifecycleState`
  (decision D8) had derived correctly from those columns since Slice 1. `activateEvent`
  (`lib/dal/payments.ts`) now stamps `hosted_until`/`grace_until` in the same atomic update that
  activates the event; `openCapture` (`lib/dal/events.ts`) now stamps `safety_net_closes_at` on
  first open (computed by `computeSafetyNetClosesAt`, `lib/events/lifecycle.ts`) and never moves
  it on a later reopen.
- **A second, related regression this fix exposed:** `recordManualRefund` cleared
  `activated_at`/`event_token`/`gallery_token`/`activating_payment_id` on refund but not
  `hosted_until`/`grace_until`/`safety_net_closes_at`/`capture_opened_at`/`capture_closed_at`.
  Harmless before this slice (those columns were always already null in production), but once
  `activateEvent` started populating them for real, a refunded/unpaid event would eventually have
  derived as `expired`/`archived` from a since-undone activation (D8 checks `hosted_until`/
  `grace_until` before `activated_at`). Fixed in the same refund-clearing update; regression test
  in `lib/dal/payments.manual.integration.test.ts` asserts the event derives back to `draft`.
- **`computeSafetyNetClosesAt`** (`lib/events/lifecycle.ts`) anchors to the end of the event's
  configured day, in the event's own timezone (`zonedDateTimeLocalToUtcIso`, never the server's),
  plus the launch-policy safety-net window — per product.md §7.3, which anchors this to "the
  event's configured end/date," not to whenever the host happens to open capture. Falls back to
  the capture-open instant when no event date was ever configured, or when that computed deadline
  would already be in the past (a late/postponed opening), so the safety net always exists.
- **`lib/events/policy.ts`** (new) holds the launch-policy duration constants product.md itself
  calls out as policy, not fixed invariants: `SAFETY_NET_CLOSE_HOURS` (72), `HOSTED_ACCESS_DAYS`
  (365), `GRACE_PERIOD_DAYS` (30), `EXPIRY_WARNING_DAYS_BEFORE` (30).
- **Advance expiry warning:** `getExpiryWarning()` (`lib/events/lifecycle.ts`) is a pure derived
  read — within the warning window and not yet expired/archived. The host dashboard
  (`app/(host)/events/[eventId]/page.tsx`) shows it as a calm banner, plus separate banners for
  `expired` (read-only, downloads available until `grace_until`) and `archived` (deletion pending
  or completed, reading `media_deleted_at`). **No outbound email/SMS exists in this codebase**, and
  none was invented for this slice — the roadmap/build instructions for Slice 12 explicitly forbid
  that. This is a real, recorded launch prerequisite (decision D18): before a genuine production
  launch, product needs to decide on an actual delivery channel (most likely transactional email
  to the host's Supabase Auth account email, since that's already collected).
- **Permanent deletion (`lib/dal/lifecycle.ts`, new module — system-authoritative, no ownership
  predicate, mirroring why `lib/dal/operator-events.ts` is its own module):**
  `permanentlyDeleteEventMedia(eventId, now)` re-derives eligibility itself (`grace_until` must
  have elapsed, `media_deleted_at` must still be null) rather than trusting a caller, then deletes
  every capture's storage objects (original/display/thumbnail/share via the new
  `deleteObjects()` in `lib/media/storage.ts`) **before** hard-deleting the `captures` rows, and
  only marks `events.media_deleted_at` (an atomic `WHERE media_deleted_at IS NULL` guard) once
  both steps succeed. A rerun after any partial failure re-lists whatever capture rows are still
  present and retries; removing an already-removed storage object is a no-op, not an error, which
  is what makes this safe to retry from any point without a saga/transaction log. Once
  `media_deleted_at` is set, a repeat call is a pure no-op — media is never revived.
  `runLifecycleSweep(now)` processes every eligible event independently (try/catch per event, so
  one event's failure — a transient storage error, say — never blocks another's), plus a global,
  purely cosmetic sweep of abandoned `pending` reservations past their TTL (Operator Console
  display accuracy only; the frame-limit invariant itself was already guaranteed by the existing
  per-guest-session lazy sweep in `reserve_capture()`, unchanged).
- **Migration `20260923010000_lifecycle_retention.sql`** adds `events.media_deleted_at`
  (nullable timestamptz) — the durable "deletion actually completed" marker, distinct from
  `grace_until` merely having elapsed — plus a partial index for the cron's own query shape.
- **Cron (`app/api/cron/lifecycle/route.ts`, `vercel.json`, decision D18):** one daily Vercel Cron
  target, authenticated via `CRON_SECRET` (`Authorization: Bearer`, which Vercel sends
  automatically once that env var is set in the Vercel project — the one manual configuration
  step this slice couldn't do itself; see below). No new job platform, no queue.
- **Operator Console:** the event detail page now shows a "Permanent deletion" row (completed
  with timestamp / pending / not yet eligible) alongside the existing `hosted_until`/`grace_until`
  rows from earlier slices.
- **Testing:** `lib/dal/lifecycle.integration.test.ts` (new) against the real dev database and
  Storage bucket: not-eligible before grace elapses (and excluded from the sweep listing); host
  downloads still work throughout the grace period; permanent deletion actually removes a real
  uploaded storage object and its capture row and stamps `media_deleted_at`; a rerun after
  completion is a no-op; a rerun after a simulated partial failure (object already gone, row and
  marker not yet) converges correctly; and one event's deletion failure (a mocked storage error,
  via `vi.spyOn` on `deleteObjects` scoped to only that event's paths) is caught and recorded in
  `runLifecycleSweep`'s `failures` array without blocking a second event's real deletion in the
  same sweep. `lib/dal/captures.integration.test.ts` adds a case proving `openCapture` computes
  and stamps `safety_net_closes_at` on first real open and never moves it on reopen.
  `lib/dal/payments.integration.test.ts` adds a case proving `activateEvent` stamps `hosted_until`
  (~365 days out) and `grace_until` (~30 days after that). `lib/dal/payments.manual.integration
  .test.ts` extends the existing refund test with the regression assertions above.
  `lib/events/lifecycle.test.ts` (unit) adds coverage for `computeSafetyNetClosesAt` (timezone-
  anchored, the no-event-date fallback, the already-past-event-date fallback) and
  `getExpiryWarning` (no `hosted_until`, well before the window, inside the window, already
  expired, already archived).
- **Human/deployment prerequisite this slice could not complete itself:** the `CRON_SECRET` env
  var must be set on the Vercel project (any value; generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`), matching the
  pattern every other secret in `.env.example` already follows. Once set, Vercel Cron picks up
  `vercel.json`'s daily schedule automatically on the next deploy — no separate dashboard step
  beyond setting that one env var. Local `supabase db push` for this slice's migration was applied
  during this session (with the user's permission) against the linked dev project.

**Former current-phase entry (Slice 11), preserved below:**

Slice 11 (downloads, product.md §11.2/§12/§13, decision D11,
roadmap criteria 26/33) landed 2026-09-23. Guest download of a guest's own committed captures
already existed since Slice 3 (`listCapturesForGuestSessionWithUrls`, wired into the frame-grid
tile itself as a download anchor in both the in-progress capture view and the post-capture-close
"your captures" view) — already ownership-scoped by `guest_session_id` + `event_id` with no
capture-by-id lookup path at all, so a guessed capture id has nothing to be looked up against,
and already excluding hidden/deleted captures. Nothing needed to change there; this slice's real
work was the host-facing half, which had no UI despite `listCapturesForEventHost` (Slice 4)
already minting a `downloadUrl` per capture:
- **Individual download:** `gallery-grid.tsx`'s tile gained a persistent download icon (bottom
  left, alongside the existing "Hidden" badge when present) linking to the capture's existing
  `downloadUrl` — the original, not a derivative. No DAL change; the ownership check and signed
  URL already existed, just unused by the UI.
- **Bulk download (decision D11: client-driven sequential signed URLs, no server-side zip for
  MVP):** `listOriginalDownloadUrlsForEventHost(hostId, eventId)` (`lib/dal/captures.ts`) is a new
  DAL function, ownership-checked via the same `getEventForHost` predicate as every other
  host-facing capture query, returning every committed, non-deleted capture's original signed URL
  and a generated filename (`NNN-guest-slug.ext`, extension derived from the capture's own stored
  `mime_type`). Deliberately includes a hidden capture — hiding removes it from gallery/guest view,
  not from the host's ownership of their own media (invariant 11) — the same scope
  `listCapturesForEventHost` already uses. Signed URLs are minted fresh on each call (a Server
  Action, `getBulkDownloadUrlsAction` in `app/(host)/events/actions.ts`) rather than reused from
  page load, so a host who leaves the dashboard open a while before clicking doesn't hit URLs that
  expired while the page just sat there. `BulkDownloadButton` (new client component) calls that
  action, then triggers one browser download per original via a detached `<a download>` click,
  spaced 300ms apart — a plain browser-compatibility measure (rapid programmatic-download bursts
  get silently blocked as a popup storm by some browsers), not a product requirement.
- **Grace-period access (roadmap's own verification requirement):** no new gating was needed —
  `getEventForHost`/`listCapturesForEventHost`/the new `listOriginalDownloadUrlsForEventHost` all
  check ownership only, never lifecycle state, so an `expired` (grace-period) event's downloads
  keep working structurally, the same way they already did for Slice 4's gallery grid. Permanent
  deletion at the end of the grace period was unimplemented at the time this slice landed —
  **superseded by the Slice 12 entry above**, which now implements it.
- **Testing:** `lib/dal/captures.integration.test.ts` adds one case against the real dev database:
  bulk download includes a committed and a hidden capture, excludes a deleted one and a still-
  pending reservation, returns real https signed URLs with unique filenames, and is refused
  (`null`) for a different host. Guest-side download coverage (ownership scoping, hidden/deleted
  exclusion, null urls for a pending capture) was already covered by Slice 3's own tests and
  needed no changes.

**Former current-phase entry (Slice 10), preserved below:**

Slice 10 (guest sharing flow and branded share-card generation,
product.md §10, roadmap criteria 29–31) landed 2026-09-23. The host-facing sharing toggle and
hashtag field already existed since Slice 1's original event form (`events.sharing_enabled`
default `true`, `events.hashtag`) — this slice's work was entirely the guest-facing half: an
eligible guest generates/retrieves a branded card of their own committed capture and shares it
via the Web Share API or a download fallback, gated on that existing host setting.
- **Schema:** migration `20260923000000_capture_share_cards.sql` adds `captures.share_path`
  (nullable), the same caching role `display_path`/`thumbnail_path` already play — no new
  access-control surface, since every read of it goes through the existing guest-session-scoped
  queries.
- **Rendering (`lib/media/share-card.tsx`):** uses `next/og`'s `ImageResponse` (Satori + resvg),
  not `sharp` compositing text or an SVG string rasterized by `sharp` — both of those would
  depend on system fonts being installed in the serverless runtime, the exact risk
  `lib/media/signage.ts` already documents avoiding for the same reason. `ImageResponse` ships
  its own embedded fallback typeface and needs no font bytes supplied, no new dependency (it
  ships inside the `next` package already in use), and no network fetch — the guest's own photo
  is inlined as a base64 data URI, not fetched by URL. The photo is placed with
  `object-fit: contain` inside a fixed photo area (never `cover`), so an arbitrary source
  orientation or aspect ratio is always shown in full, letterboxed rather than cropped. The
  branded footer carries only product-approved fields already on the event/capture: event name,
  formatted date, hashtag, and the guest's own optional capture message — colors reused verbatim
  from `signage.ts`'s hex-converted host/guest palette (the accepted visual identity, not a new
  theme). The first version used `ImageResponse`'s embedded fallback font. The brand fonts are now
  bundled as TTF files in `lib/media/fonts/` and read from disk (still no network fetch), and the
  card follows the redesign (see "Follow-up pass — remaining surfaces" above).
- **Authorization (`lib/dal/share-cards.ts`):** `getShareCardForGuestCapture(event,
  guestSessionId, captureId)` is server-authoritative — checks `event.sharing_enabled` first,
  then loads the capture scoped by `id` + `guest_session_id` + `event_id` (the same three-column
  predicate `commitCapture` already uses), and requires `status === "committed"` with no
  `hidden_at`/`deleted_at`. Every disqualifying reason (wrong guest session, hidden, deleted,
  still pending, no such capture) collapses to the same generic `not_found` outcome, so a guest
  holding another guest's capture id cannot distinguish "not yours" from "doesn't exist" from
  "host hid it." The function never reads gallery visibility or reveal state at all, which is
  what makes pre-reveal sharing structurally incapable of leaking the gallery (architecture §10
  "pre-reveal share isolation," extended here to cross-guest access too) rather than relying on
  a caller to remember not to check it. Generation is idempotent: the share asset lives at a
  deterministic sibling path next to the original (`.../share`), so a cache hit reuses it and a
  concurrent double-generation overwrites the same path with an equivalent render rather than
  creating a second, divergent derivative — proven under real concurrent calls in the test suite.
  Bytes are served directly by the calling Server Action, not through a minted signed URL — the
  same reasoning `lib/media/signage.ts`'s route already applies (synthesized content is
  access-gated at the point of generation, not at a separate storage credential).
- **Guest UI:** a small share-icon button now overlays every filled frame in
  `frame-grid.tsx` (both during active capture in `capture-slots.tsx` and in the post-capture-
  close "your captures" view in `own-captures.tsx`), rendered only when `event.sharing_enabled`
  is true. Tapping it calls the new `getShareCard` Server Action
  (`app/(guest)/e/[token]/actions.ts`), then hands the returned PNG to
  `lib/share/web-share.ts`'s `shareOrDownload` — the Web Share API when
  `navigator.canShare({ files })` reports it can, an automatic download fallback otherwise or on
  any native-share failure, with a user-cancelled share sheet treated as a quiet no-op rather
  than an error. A share failure never touches the underlying capture; it only ever reads
  already-generated bytes.
- **Testing:** `lib/media/share-card.test.ts` (unit) proves `renderShareCardPng` produces a
  valid PNG at the fixed canvas size and doesn't throw across landscape/portrait/square source
  photos or long name/message/hashtag input. `lib/share/web-share.test.ts` (unit) proves the
  pure share-vs-download decision logic — this project's tooling has no jsdom, so the real
  `navigator`/`document` calls are behind an injected capability object, and this is the
  "Web-Share-unavailable falls back to download" coverage requested for this slice; genuine
  Safari/Android/in-app-browser share-sheet behavior itself is on the human-verification
  checklist below. `lib/dal/share-cards.integration.test.ts` (against the real dev database)
  covers every authorization/isolation requirement this slice specified: sharing enabled → ok;
  sharing disabled → refused regardless of capture eligibility; guest A cannot reach guest B's
  capture; a capture id alone without the matching guest session is insufficient; a pending
  (uncommitted) capture is refused; a host-hidden capture is refused; a host-deleted capture is
  refused; sharing succeeds even with `visibility: "only_me"` and capture still open (proving the
  function never consults gallery state); the original object's bytes are byte-for-byte
  unchanged after share-card generation; and two concurrent generation calls for the same
  capture leave exactly one storage object and one `share_path` value, with a third, later call
  reusing the identical cached bytes.

**Former current-phase entry (Slice 9), preserved below:**

Slice 9 (manual payment confirmation and refunds through the Operator
Console, product.md §7.2/§7.2.1/§15.1) landed 2026-09-23. It reuses the Slice 8 `activateEvent`
function unchanged for activation and adds no new schema — the `payments` table's manual and
refund fields were already designed in from Slice 8/9's original migration (decision D17), and
`events.activating_payment_id` (added for the Slice 8 double-payment fix) already carries
everything needed to tell "this payment activated the event" apart from "a different payment
already did," so that same mechanism now works identically for a manual/provider cross-source
race, not just a provider/provider one.
- `lib/dal/payments.ts` gained `confirmManualPayment(operatorId, eventId, input)` and
  `recordManualRefund(operatorId, eventId, input)`. Both take a pre-verified operator id — the
  caller (`app/(operator)/actions.ts`) calls `requireOperator()` first, the same trust split
  `startProviderCheckout` already has with `requireHost()` — and both enforce the
  ownership-conflict rule (architecture §5a: `event.host_id === operatorId` refuses) before
  touching anything.
  - `confirmManualPayment` refuses outright (rather than inserting a second manual payment row)
    once the event is already activated — a repeated/duplicated confirm submission for the same
    event is a clean no-op, not a spurious extra payment row that would always lose the
    activation race. It writes the new `payments` row (`source = 'manual'`, method, amount,
    `paid_at`, `confirmed_at = now()`, `confirmed_by`, optional note) then calls the *same*
    `activateEvent` the provider webhook uses — no separate manual activation code path, per
    decision D16. A genuine concurrent race (two operators, or an operator confirming while a
    PayMongo webhook lands) can still both pass the pre-check before either commits;
    `activateEvent`'s atomic `WHERE activated_at IS NULL` guard is what actually guarantees
    exactly-once activation there, and the loser's payment row is left as a genuinely recorded,
    non-activating payment.
  - `recordManualRefund` returns the event to unpaid and disables its links — `activated_at`,
    `event_token`, `gallery_token`, `activating_payment_id` all cleared in one guarded
    `WHERE activated_at IS NOT NULL` update — while separately, atomically marking the activating
    payment row `refunded_at`/`refunded_by`/`refund_note` via its own `WHERE refunded_at IS NULL`
    guard. Two independent single-table atomic guards, not a cross-table transaction, but each is
    individually idempotent (same style as `activateEvent` + `supersedeSiblingPendingCheckouts`
    in Slice 8), so a repeated or concurrent refund submission is safe: a second call sees
    `not_activated` and does nothing further.
  - `isDuplicatePayment(payment, event)` is a small derived helper — no new "duplicate" column —
    computing "this payment succeeded but isn't the one that activated the event" by comparing
    the payment id against `events.activating_payment_id`, working identically for a provider
    payment (already explicitly flagged `provider_status = 'paid_duplicate'` since Slice 8) and a
    manual one (no separate status column exists or is needed — confirmed-but-not-activating is
    sufficient). This is what makes the provider/manual cross-source race resolve into the
    existing duplicate-payment display path instead of a second, parallel mechanism.
- `app/(operator)/actions.ts` (new) holds the two Server Actions, each calling `requireOperator()`
  before any DAL work — the only invocation path into `confirmManualPayment`/`recordManualRefund`
  in the codebase, so a host session has no route or affordance that reaches them regardless of
  payment path (product.md §7.2: "the host can never self-declare payment"). The manual-payment
  form's "paid at" datetime is interpreted in the event's own configured timezone via the existing
  `zonedDateTimeLocalToUtcIso` helper (same convention as the reveal-time field), not the server
  process's timezone.
- `app/(operator)/operator/events/[eventId]/manual-payment-form.tsx` and `manual-refund-form.tsx`
  (new, client) fill the "Manual payment actions" zone the Slice 8 design pass reserved but left
  inert — a confirm form (method, amount, paid-at, optional note) shown for a draft event, or a
  refund form (optional note) shown for an activated one, both behind a `window.confirm(...)`
  guard before submitting (explicit confirmation for a consequential mutation, same pattern
  `LinkRow`'s rotate/revoke already uses). The event detail page's payment list now shows every
  payment's status generically for either source (including a manual payment's method and any
  reference note), and the existing "needs manual refund" duplicate banner now covers a manual
  duplicate the same way it already covered a provider one.
**Follow-on correction (2026-09-23): host checkout copy for supplier-assisted payment.**
product.md §7.2 was updated to resolve an ambiguity this slice had left open (see the superseded
note below): there is **no persisted "payment arranged" lifecycle state** — an unpaid event stays
in the same unpaid/pending-payment state regardless of path, until an operator actually confirms
receipt. The checkout page (`app/(host)/events/[eventId]/checkout/page.tsx`) now carries one line
of secondary, purely informational copy beneath the existing "Continue to payment" action:
"Already arranged payment directly with FiveFrames? Your event will activate once we confirm
receipt." "Pay online" remains the primary, only-clickable action; this line has no control behind
it — no button, no form, no way for a host to declare their own payment, create a manual-payment
record, or disable online payment. No schema, state, or activation logic changed; Operator Console
behavior is untouched.

**Regression found and fixed during this correction's verification pass (not caused by the copy
change — a pre-existing Slice 9 concurrency defect the test suite happened to catch under
repeated runs):** `activateEvent`'s `supersedeSiblingPendingCheckouts` step (Slice 8) used to
update a sidelined sibling provider payment's `provider_status` to `"superseded"`
unconditionally by id, guarded only by the *read* that selected it as still `pending` — not by
the *write*. Under the real provider/manual cross-source race the "a provider payment and a
manual confirmation racing the same event" test exercises, the losing provider payment's own
webhook can concurrently claim it `paid_duplicate` in the gap between that read and write; the
unconditional update then silently clobbered the claim back to `superseded`, which
`isDuplicatePayment` doesn't treat as a flagged payment — hiding a genuinely distinct second
payment from the Operator Console entirely (roadmap Slice 9's own requirement: "never silently
treated as ordinary success"). Fixed by guarding that update on `provider_status = "pending"` at
write time too (`lib/dal/payments.ts`), the same atomic-guard discipline as everywhere else in
this codebase — a stale write becomes a harmless no-op instead of an overwrite. The existing
cross-source race test in `lib/dal/payments.manual.integration.test.ts` reproduced this reliably
before the fix (failed roughly 2 of 3 runs) and now passes consistently (verified 8/8 consecutive
runs plus 3 full-suite runs); no new test file was needed since that test already covers the
exact interleaving.

**Former current-phase entry (Slice 8), preserved below:**

Slice 8 (provider payment, shared activation, event signage) finished
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

- **Reusable E2E test identities (maintenance, 2026-09-23):** three synthetic Supabase Auth
  identities exist in the linked **dev** project (`five-frames-dev`, `lrheuifbgbplekxnljfv`) so
  `/e2e-validate` doesn't depend on real email confirmation: E2E host A, E2E host B, and an E2E
  operator (granted via the normal `pnpm ops:grant-operator`, not a bypass). Provisioned via the
  new idempotent `pnpm e2e:provision-identities` (`scripts/e2e-provision-identities.ts`), which
  refuses to run against anything other than that dev project ref. Credentials live only in
  `.env.local` under `E2E_HOST_A_EMAIL`/`E2E_HOST_A_PASSWORD`/`E2E_HOST_B_EMAIL`/
  `E2E_HOST_B_PASSWORD`/`E2E_OPERATOR_EMAIL`/`E2E_OPERATOR_PASSWORD` (names only in
  `.env.example`) — never recorded here. Each E2E run should create its own event through the
  normal host UI (naming convention: `E2E <run id>`) rather than relying on seeded event data;
  none was created by this maintenance task. No global email-confirmation or auth behavior
  changed — this uses the Admin API's `email_confirm: true`, the same provider-supported
  mechanism `pnpm ops:grant-operator` already uses for its own confirmation prompt pattern.
- **Decisions D1–D18** ([decisions.md](./decisions.md)) — all **Accepted**, standing architecture.
  D12 records how "after the event" reveal timing is anchored to capture closing. D13 records the
  event-capacity counter mechanism (implemented, Slice 6). D14 records the client-only public
  demo, now implemented (Slice 13) exactly as decided: no server write path exists anywhere in
  the demo route. D15–D17 record the operator grant model, the shared provider/manual activation
  function (implemented, Slice 8, exercised by both payment sources since Slice 9), and the
  payment-row-as-audit-trail decision (manual fields populated since Slice 9). D18 records the
  lifecycle cron mechanism and permanent-deletion ordering (implemented, Slice 12), plus the
  recorded launch prerequisite that no outbound email/SMS channel exists yet for the required
  advance-expiry warning.
- **Roadmap** ([roadmap.md](./roadmap.md)) — Slices 1–13 complete; Slice 14 (full-flow device and
  venue-network validation, human-run) is next.
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
  `lib/dal/payments.manual.integration.test.ts` (Slice 9) adds, against the real dev database: a
  successful manual confirm activates the event through `activateEvent` with
  `capture_opened_at` still null; an operator cannot confirm for an event they own, but a
  different authorized operator can; a repeated confirmation attempt for an already-activated
  event is refused rather than creating a second payment row; two operators confirming the same
  fresh event concurrently activate it exactly once, with the loser correctly read as a duplicate
  via `isDuplicatePayment`; a provider webhook and a manual confirmation racing the same event
  concurrently also activate exactly once, with the loser (whichever source it is) flagged rather
  than silently accepted; a manual refund clears `activated_at`/`event_token`/`gallery_token`/
  `activating_payment_id` and marks the payment row `refunded_at`/`refunded_by`/`refund_note`;
  repeated refund submissions are safe (second sees `not_activated`); a refund is refused for an
  event that was never activated; and an operator cannot record a refund for an event they own.
  `lib/dal/payments.test.ts` (Slice 9, unit) — `isDuplicatePayment` across a winning/losing
  provider payment, a still-pending provider payment (never flagged), and a winning/losing manual
  payment.
  `lib/dal/lifecycle.integration.test.ts` (Slice 12) against the real dev database and Storage
  bucket — not-eligible-before-grace, host downloads still working during grace, real storage
  object + capture row deletion with `media_deleted_at` stamped, a no-op rerun after completion,
  a converging rerun after a simulated partial failure, and one event's mocked deletion failure
  not blocking a second event's real deletion in the same sweep. `lib/events/lifecycle.test.ts`
  (Slice 12, unit) adds `computeSafetyNetClosesAt` and `getExpiryWarning` coverage.

## Verification status

- `pnpm typecheck` — passing.
- `pnpm lint` — passing, no errors or warnings.
- `pnpm build` — passing; `/e/[token]`, `/events/[eventId]`, `/g/[token]`, `/operator`,
  `/operator/events/[eventId]`, and `/api/cron/lifecycle` register as dynamic routes.
- `pnpm test` (Vitest) — 145/145 passing, including the Slice 5 gallery-viewer/link-rotation, Slice 6
  join-capacity, Slice 7 operator-authorization, Slice 8 payment/activation/signage, Slice 9
  manual-payment/refund, Slice 10 share-card-generation/authorization, Slice 11
  bulk-download-scope, and Slice 12 lifecycle/retention integration and unit tests above, all
  against the real dev database. (Occasional single-test timeouts against the real dev database
  under full-suite parallel load are pre-existing flakiness in this environment, not a defect —
  every test passes individually and the suite as a whole passes on rerun.)
- **Slice 12 has no device-dependent acceptance criteria and no human verification is required
  for correctness** — the mechanism is proven at the database/storage level by the integration
  tests above (real deletion, real idempotent reruns, real per-event failure isolation), and the
  dashboard banners are ordinary server-rendered text. The one thing this environment genuinely
  cannot verify is a live Vercel Cron invocation itself, since that requires the deployment-side
  `CRON_SECRET` env var this session can't set (see the Current phase section above and the
  human/deployment prerequisite noted there) — the route's logic is fully covered by
  `runLifecycleSweep`'s own tests regardless of how it's triggered. If convenient once
  `CRON_SECRET` is set and deployed, a human sanity check is to `curl` the route with the correct
  bearer token and confirm a `200` with a JSON summary, and a `401` without it.
- **Slice 11 has no device-dependent or otherwise human-only acceptance criteria** — individual
  and bulk download are ordinary desktop/browser host affordances (a download link, a button
  triggering sequential `<a download>` clicks), fully exercised by the integration test above and
  the ownership/scope logic it proves. Not clicked through in a browser for the same reason as
  Slices 4/6/7 (no browser automation in this environment); if convenient, a human sanity check is
  to open a host's event with a few committed captures, click one tile's download icon and confirm
  the original file (not a resized derivative) saves, then click "Download all originals" and
  confirm one file per committed capture saves, including any hidden one.
- **Slice 10 — awaiting human verification for real Web Share behavior only.** Everything
  server-authoritative (the sharing toggle gate, cross-guest isolation, moderation gating,
  pre-reveal isolation, original-media integrity, idempotent generation) is proven by
  `lib/dal/share-cards.integration.test.ts` against the real dev database, and the
  share-vs-download decision logic itself by `lib/share/web-share.test.ts`. What remains
  unverifiable in this environment (no browser automation) is whether `navigator.share`/
  `navigator.canShare` actually behave as expected, and whether the download fallback actually
  produces a usable image, on real Safari/Android/in-app browsers — see the checklist below.
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

**Slice 14, found by a focused `/e2e-validate` run, repaired 2026-09-23 (two real defects):**

1. **Host "Download original" navigated the tab instead of downloading, and bulk download died
   after the first item.** `createSignedReadUrl` (`lib/media/storage.ts`) minted ordinary inline
   signed URLs for every caller. The `<a href download>` HTML attribute is silently ignored by
   browsers for a cross-origin URL — which a Supabase Storage signed URL always is — so clicking
   it just navigated the current tab to the image. For "Download all originals"
   (`bulk-download-button.tsx`, decision D11's client-driven sequential loop), the first
   navigated-away tab destroyed the page's JS execution context before the loop could reach items
   2–6.
   **Root cause / fix:** Supabase Storage's `createSignedUrl` accepts a `download` option that
   sets `response-content-disposition: attachment` on the signed response itself — a
   server-header-driven download, not something the anchor tag has to request. `createSignedReadUrl`
   now takes an optional `downloadFilename` parameter that sets this option; only the two
   host-only call sites that mint download links (`listCapturesForEventHost`'s per-tile
   `downloadUrl`, `listOriginalDownloadUrlsForEventHost`'s bulk `url`, both in
   `lib/dal/captures.ts`) pass a stable filename. Every other `createSignedReadUrl` call
   (thumbnails, the guest's own downloadUrl, the public gallery viewer's imageUrl) is unchanged —
   guest/share-card behavior was not touched.
   **Failure class:** a browser-only HTML attribute (`download`) that silently no-ops for
   cross-origin URLs is not a substitute for a server-set `Content-Disposition` header when the
   file being downloaded is served from a different origin than the page — worth watching for in
   any download affordance built against a signed cloud-storage URL.
   **Regression coverage:** `lib/dal/captures.integration.test.ts` (against the real dev database
   and storage) — a new test asserts the host gallery tile's `downloadUrl` carries a `download=`
   query parameter while its `thumbnailUrl` and the guest's own `downloadUrl` do not; the existing
   `listOriginalDownloadUrlsForEventHost` test now also asserts every bulk-download url encodes
   that capture's own filename via `download=`.
   **Confirmed against a real browser (Playwright, this environment's browser automation)**
   against the real dev deployment (`E2E Validation Event`, 6 real committed captures): clicking
   an individual "Download original" produced a genuine browser download event
   (`Downloaded file 001-guest-e2e-slice14.png`) with the page URL never leaving
   `/events/[eventId]` — no navigation. Clicking "Download all originals" made real signed
   `/original?...&download=NNN-*` requests for all 6 captures (confirmed via the network log,
   proving the loop no longer dies after item 1 — the page's JS context survived the whole run).
   Chromium's own "block multiple automatic downloads without a user gesture" policy aborted 5 of
   the 6 file saves in this headless run (`net::ERR_ABORTED`) — a Chrome download-permission
   behavior orthogonal to this fix and already the reason the component staggers requests 300ms
   apart (D11); it is not evidence the bulk loop stopped early, since all 6 requests were made.
2. **A payment the manual-refund flow had already resolved was shown as a false, unresolved
   duplicate.** `isDuplicatePayment(payment, event)` (`lib/dal/payments.ts`) flagged any succeeded
   payment as a duplicate whenever `event.activating_payment_id !== payment.id`. But
   `recordManualRefund` intentionally clears `activating_payment_id` as part of returning a
   refunded event to draft (the same atomic-guard pattern as D5/D6/D13/D16) — so the very payment
   an operator had just correctly refunded read as "succeeded, but isn't the activating payment,"
   i.e. a false duplicate, sending the operator chasing a payment that was already resolved.
   **Fix:** `isDuplicatePayment` now also excludes any payment with `refunded_at` set. A genuine
   duplicate (one that lost the activation race and was never itself refunded) still has
   `refunded_at = null` and keeps surfacing for operator follow-up exactly as before; refund audit
   fields, event-deactivation semantics, and the existing provider/manual cross-source duplicate
   behavior from Slices 8/9 are unchanged — no new payment state or schema was added.
   **Failure class:** a derived/computed status flag whose inputs are also mutated by a *resolution*
   action (here, refund clearing the same column the flag reads) needs the resolution's own
   terminal marker checked directly, not inferred from a side-effect of the resolution — worth
   watching for in any other "flag stays true until X happens" check where X's own handler
   incidentally changes the field the flag is computed from.
   **Regression coverage:** `lib/dal/payments.test.ts` (unit) — the sole activating manual
   payment reads as not-duplicate after `recordManualRefund` clears `activating_payment_id`; a
   genuine second successful payment still reads as duplicate both before and after an unrelated
   refund. `lib/dal/payments.manual.integration.test.ts` (against the real dev database) — a full
   confirm → refund cycle proves the refunded payment is not flagged; a second event's activating
   payment, used to model a genuine race-loser, still flags as duplicate after the first event's
   refund. All pre-existing Slice 8/9 provider/manual duplicate-race tests continue to pass
   unmodified.
   **Confirmed against a real browser (Playwright)** against the real dev deployment and operator
   account: confirmed a manual payment (event activated), recorded a refund (event returned to
   Draft/Unpaid, payment shows `Status: Refunded`), reloaded the operator event page — no
   duplicate-payment banner appeared for either the newly refunded payment or an older,
   previously refunded payment already on the same event.

Both fixes verified with a clean `pnpm typecheck`, `pnpm lint`, `pnpm build`, and full `pnpm test`
(162/162 passing; one lifecycle-integration timeout on the first run was the same pre-existing
real-dev-database-under-load flakiness already recorded above, confirmed non-regressive by an
immediate 162/162 rerun). Slice 14's own human-device-bound scope (camera, real in-app browsers,
physical QR, venue network) is unaffected by this repair and remains `awaiting human
verification` — see the checklist below.

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

## Human verification needed for Slice 10 (Web Share behavior)

Everything server-authoritative about the sharing flow is already proven by automated tests
(see "Verification status" above). What remains is real Web Share API / share-sheet behavior,
which this environment cannot exercise (no browser automation). Seed an activated event with
capture open (`pnpm dev:activate-event <eventId>` then open capture from the host dashboard),
capture at least one photo as a guest, and check:

1. **iPhone Safari** — tap the share icon on a captured frame. Expected: the native iOS share
   sheet opens with the branded card image (event name, date/hashtag, your message, "FIVE
   FRAMES") ready to send to Messages/Photos/etc.
2. **Android Chrome** — same tap. Expected: the native Android share sheet opens with the same
   image.
3. **Facebook/Messenger/Instagram in-app browsers** — same tap. Expected: either the native
   share sheet opens, or (if that browser doesn't support `navigator.share` with files) the
   image downloads directly — never a silent failure or a broken image.
4. **A desktop browser with no Web Share support** (e.g. desktop Chrome/Firefox) — same tap.
   Expected: the branded PNG downloads directly, no error shown.
5. **Cancel the native share sheet** partway (where the platform allows it) — expected: no
   error message appears, and the frame/photo is completely unaffected; tapping share again
   works normally.
6. **Sharing disabled** — turn off "Allow guest sharing" on the host's event page, reload the
   guest page. Expected: no share icon appears on any frame.

Reply with pass/fail for each item and any screenshot/error. Record the outcome in this file
under this heading once reported, and mark Slice 10 fully verified only once all items pass.

## Slice 14 — human verification checklist

This is the primary handoff for this slice. Nothing below can be executed from this environment
(no browser automation, no real devices, no PayMongo dashboard login). Work through each section
against the real deployment at `https://five-frames.vercel.app`, report PASS/FAIL/BLOCKED plus
any observation per item, and this file will be updated with the results — any FAIL becomes a
defect fixed in this same slice per build-app §32 before the slice is marked complete.

**1. Deployed environment** — the parts only a human can check:
- PayMongo dashboard shows **Test mode** active for this integration. Not spot-checkable from
  here — the CLI only shows truncated key values, decoding which would defeat the point of not
  exposing them.
- PayMongo webhook delivery log shows recent successful deliveries to
  `/api/webhooks/paymongo` (or trigger one via a fresh test-mode checkout in §2 and check after).
- No live/production PayMongo credentials are in use anywhere in this environment.

**2. Host journey** — create/sign in → draft event → configure → unpaid state → PayMongo
Test-mode checkout → payment → webhook → activation → links/signage appear → capture stays
closed → host opens capture → close/reopen → gallery/reveal controls → moderation → downloads.
Expected: state-appropriate copy at every step (never a stale "unpaid" banner after activation,
never a working guest link before payment).

**3. Physical QR and signage** — print or display each signage format (`qr`, `table-card`,
`poster`, `digital` at `/events/[eventId]/signage/[format]`) for an **activated** event; scan
with a real phone camera. Expected: every format scans to the correct event's capture link;
signage carries no per-event photo/identity beyond the event name (product.md §11.3); an
unpaid/unactivated event's signage route 404s (already covered structurally — the route refuses
unless `activated_at` and a real `event_token` exist — but worth a real scan-attempt check that
no old/cached link works).

**4. Guest journey — iPhone Safari.** QR/link → join → five-frame board → camera/picker →
preview → optional message → confirm → upload → own capture appears → own download → share (if
enabled). Include a portrait photo, a landscape photo, a reload mid-session, and one interrupted/
weak-network upload with retry. Expected: a failed/abandoned upload never permanently consumes a
frame (invariant 2) and a retry never produces two captures from one submission (invariant 3).

**5. Guest journey — Android Chrome.** Same flow as §4, abbreviated: join friction, camera/
library behavior, one interrupted-upload retry, own-capture access, download, share.

**6. In-app browsers — Facebook, Messenger, Instagram.** Event link opens, join works, photo
picker/capture reaches the app, upload/commit works or fails gracefully, Web Share works where
supported, download fallback works where it isn't. Record exact limitations per browser rather
than guessing — e.g. if Instagram's in-app browser blocks the native camera picker, say so
precisely rather than describing a workaround that wasn't actually exercised.

**7. Web Share (folds in the previously separate Slice 10 checklist).** Capture a photo as a
guest on a sharing-enabled event, tap the share icon:
- iPhone Safari: native share sheet opens with the branded card (event name, date/hashtag,
  message, "FIVE FRAMES").
- Android Chrome: same, native Android share sheet.
- Cancel the share sheet partway: no error, frame/photo unaffected, sharing again works.
- A desktop browser with no Web Share support: the branded PNG downloads directly, no error.
- Turn off "Allow guest sharing" on the host event page, reload the guest page: no share icon
  appears on any frame.
- (Already proven server-side, not re-needed here: hidden/deleted captures and pre-reveal
  sharing cannot leak the gallery — `lib/dal/share-cards.integration.test.ts`.)

**8. Gallery** — on a real/mobile viewport: unrevealed state, `only_me` visibility denial,
invalid/revoked link, a small revealed collection, a larger one, mixed orientations, the
immersive viewer, swipe, close behavior. Also serves as the pending visual-verification check for
the gallery redesign noted in the blockers table below — note any visual issue found, not only
functional ones.

**9. Operator/manual-payment path** — sign in as a granted operator: `/operator` lists events
across more than one host; an ordinary host account gets a 404 on `/operator`. On a draft
dev/test event: confirm a manual payment through the Console (uses the same `activateEvent` path
as provider payments — confirm the event activates and gains links); confirm an operator cannot
confirm/refund for an event they themselves own (should refuse); record a manual refund on an
activated test event and confirm it returns to unpaid with links cleared. Do not use real money
or a real cash transaction — use safe dev/test data only, as the slice instructions require. Also
serves as the pending visual-verification check for the Operator Console redesign in the
blockers table.

**10. Downloads** — on a host event with ~5–10 committed captures (include at least one hidden
one): click an individual tile's download icon (confirm the *original*, not a resized
derivative, saves); click "Download all originals" (confirm one file per eligible capture saves,
including the hidden one, excluding any deleted one). Note any browser popup/multi-download
permission prompt encountered — if the browser blocks enough of the sequential downloads to make
this unreliable, that is a Slice 14 defect to report, not a footnote.

**11. Network conditions** — using browser devtools throttling or real weak connectivity: slow
upload, interrupted upload + retry, page reload during/after an upload. Expected: no duplicate
commits, no permanently lost frame from an abandoned upload (this mirrors §4/§5's interrupted-
upload check but is worth exercising independently under throttled rather than fully-dropped
conditions).

**12. Capacity/concurrency sanity** — on a safe test event, set `guest_session_cap` low (e.g. via
a direct dev-database update, not a UI control — there is none) and join guests up to and past
it. Expected: a new guest past the cap sees a calm "this event is full" state; an already-joined
guest keeps working; there is no client-side way to bypass the cap (the hard concurrency
guarantee itself is already proven by `lib/dal/events.integration.test.ts`'s concurrent-join-storm
test — this step is only checking the human-facing behavior around that guarantee).

**13. Lifecycle cron deployment prerequisite** — `CRON_SECRET` is now confirmed present in
Vercel Production (see "deployed environment check" above), so this step is now unblocked. Run
one authenticated test invocation:
`curl -i -H "Authorization: Bearer $CRON_SECRET" https://five-frames.vercel.app/api/cron/lifecycle`
(using the real secret value from Vercel — never paste that value into chat or a document) and
confirm a `200` with a JSON sweep summary; then confirm the same request **without** the header
returns `401`. Confirm no ineligible event's rows changed by comparing an unaffected test event's
`media_deleted_at`/`hosted_until`/`grace_until` before and after. Do not wait for the daily
schedule and do not target any event with real/valuable data.

Reply with PASS/FAIL/BLOCKED and any observation for each numbered item (sub-items may be
grouped). Any FAIL will be diagnosed, fixed, and regression-covered inside this same slice before
it is marked complete; any BLOCKED (an environment genuinely not exercisable, e.g. no Android
device available) will be recorded honestly as a known limitation rather than claimed as passed.

## Next slice

**Slice 14 — full-flow real-device and venue-condition validation: `awaiting human
verification`.** Everything automatable is done and passing (see above). The checklist above is
the exit condition; there is no further automatable work in this slice. Slice 14 is the last
roadmap slice — do not begin `/release-review` or any production mutation until every item above
is PASS or an honestly-recorded BLOCKED with no unresolved launch-blocking defect.

## Blockers and open items

| Item | Type | Affects |
|---|---|---|
| Slice 14 full human verification checklist not yet run (see above) — this is now the single gating item for MVP completion | Manual verification pending | Entire guest/host/operator flow on real devices; see checklist above |
| Desktop/browser responsive pass (guest, gallery, demo, 404/error) implemented 2026-09-29 — awaiting human visual approval; host and Operator desktop audit still to do (see section above) | Design pass pending approval | Guest, gallery, demo; host/operator unaudited |
| Contracted UI/UX handoff redesign implemented 2026-09-29 — **awaiting human visual approval** (checklist in "UI/UX redesign" above). Supersedes the earlier public-gallery, payment/signage and guest/host visual passes, which no longer need separate approval. | Design pass pending approval | All guest, host, auth, gallery and demo screens |
| Handoff capabilities not in the product: cover photo, theme color, delete event, pre-payment guest preview, public photographer attribution | Product decision (only if the product should change) | Create · Look, Settings, gallery viewer |
| Operator Console, share card, 404/error pages and app icons moved onto the design system (follow-up pass, 2026-09-29) — awaiting human visual approval with the rest (redesign checklist item 7; Slice 14 §9 still covers the operator payment flow itself) | Design pass pending approval | `/operator`, `/operator/events/[eventId]`, share cards, 404/error, icons |
| Supabase Auth email templates (confirmation, password reset) still Supabase defaults — dashboard configuration, not repo code | Follow-up design task | Host signup and password-reset emails |
| `.env.local` key typo `EXT_PUBLIC_SUPABASE_URL` and missing `E2E_*` variables | Local environment | Running the app/tests locally |
| Supabase Auth redirect allowlist must include `/auth/confirm` for password reset in each environment | Configuration | Password reset |
| Vercel Production env currently points at the dev Supabase project (see note above) | Known interim state | Must be reconciled before real production payment work |
| Which specific individual(s) actually get the first operator grant, and when — the mechanism (`pnpm ops:grant-operator <email>`) exists as of Slice 7; only who to run it for and who holds the production service-role credential remain open (product.md §19) | Operational business decision | Pre-launch |
| No git remote configured | Setup | Any push/CI work |
| Service role key is the single highest-value secret; RLS does not constrain it | Security constraint | All slices |
| Refund/retention/deletion legal copy | Business decision, from spec §19 | Pre-launch |
| 250-session / 1,250-capture launch capacity (`guest_session_cap`, now enforced) is a hypothesis to validate via load testing and early real events, not a fixed constant (product.md §9.5, §19; decision D13) | Launch policy, to revisit with real data | Beyond launch |
| Exact timing/criteria for moving launch price from ₱999 toward the ₱1,490 target | Business decision once early paid-event data exists (product.md §19) | Post-launch |
