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
| Implementation history and status | [docs/roadmap.md](docs/roadmap.md) | Implementation complete. |
| Current state, blockers, release follow-ups | [docs/progress.md](docs/progress.md) | Keep current. |
| Remaining pre-release verification | [docs/release-validation.md](docs/release-validation.md) | **Canonical.** Record results there. Do not recreate slice-specific test checklists elsewhere. |
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
6. Capture is possible only while the event is activated (paid, or the account's one Free event),
   active, and explicitly opened by the host.
7. Activation must succeed before any event link or QR exists: confirmed payment, or the server
   granting the host account's one Free event (product.md §7.2, §15.3).
8. Media is never at a guessable public URL; an unrevealed gallery is never viewable.
9. A host can only reach events they own. An operator reaches a customer's event only through
   support access (product.md §5.1.3), within its limits.
10. Original media is never modified. Derivatives are additional files. The event theme, keepsake
    styles and FiveFrames branding exist only in derived outputs (guest screens, keepsakes,
    signage), never in a stored original, and never during capture/preview/commit.
11. The host can download their media at any point before permanent deletion.
12. The frame count (5 photos) is a constant. Never configurable, purchasable, or extendable.
13. Privileged operator mutations (confirming a manual payment, recording a manual refund, overriding
    an event's guest capacity) are server-authoritative and auditable, and happen only through
    the Operator Console — never a host-declared, ad hoc, or undocumented action. Every operator
   action in support access, including viewing photos, is permanently logged and shown to the host.
14. A keepsake is a derivative, made only from the requesting guest's own committed, non-hidden
    captures. A **Single-photo keepsake** uses one of them. A **Full Set keepsake** uses exactly
    the five committed captures of the requesting session, all non-hidden, in commit order, with
    no guest message. Hiding any of the five makes the Full Set unavailable until the capture is
    unhidden, and deleting one makes it permanently unavailable. It is never made from four
    captures. A keepsake never contains another guest's content, the guest's display name, or
    the capture/gallery link or QR, and making or sharing one never changes gallery access.
    Making a keepsake never consumes a frame, counts as a capture, or adds a gallery item.

## Engineering constraints

- **All data access goes through `lib/dal/`** with `import 'server-only'`. The browser never gets
  a Supabase client, never queries Postgres, and never uses Supabase Auth. The one permitted
  direct browser↔storage interaction is uploading bytes to R2 under a server-issued presigned
  PUT for one object key — a per-upload capability, not database access.
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
- **Provider payment, manual payment and Free activation go through one shared `activateEvent`
  function**, guarded by a single atomic `WHERE activated_at IS NULL` update (decision D16) — the
  same pattern as the frame slot mechanism and event-join capacity. Never write a second,
  payment-source-specific activation code path. "One Free event per host account, ever" needs its own atomic guard too,
  never a count-then-activate check (product.md §7.2).
- **Manual-payment mutations (confirm, refund) happen only through the Operator Console.** Do not
  add a host-facing route, generic admin endpoint, or script that performs them in production.
- **The Operator Console's own pages show aggregate counts, never individual guest media.** Do not
  add a DAL function a Console page could use to obtain a capture's signed image URL.
- **Operator support access (D27, architecture §5b; planned, Slice 27).** Operators run an event
  on the host's own pages through `getEventAccess(userId, eventId)`, which returns `owner` or
  `support` (owner wins on an operator's own event). Each host DAL function names the roles it
  admits. Never add a blanket "or operator" predicate, and never move an owner-only function (plan,
  checkout, refund request, event or photo deletion, favorite, original/ZIP/Drive downloads,
  co-hosts) onto it. A support change and its `support_actions` entry commit in one transaction.
  Support may sign display derivatives only, never originals. Every new host DAL function must
  state which roles it admits.
- **Event Theme & Keepsakes (decisions D19, D20; architecture §7a–§7c).**
  - The theme image is public-facing but **not publicly addressable**. It lives in the private
    R2 `theme/` prefix and reaches a browser only as a signed URL after that surface's own
    check (owner or support access, valid event token, or granted gallery access). The Console's
    own pages never get one. Never accept SVG uploads.
  - There is **one sharing system**: keepsakes in two families (five Single-photo styles, five
    Full Set styles) in one closed registry, rendered on demand and never persisted. Do not
    reintroduce a share-card path, `share_path`, or a stored keepsake cache without a new
    decision. The render inputs are closed structs: never add the display name, welcome message,
    tokens, links or counts to them, and never add a message or per-photo metadata to the Full
    Set input.
  - **The server derives a Full Set's captures.** `getFullSetSources` selects by the cookie's
    guest session **and** event, and requires exactly five committed, unhidden, undeleted
    captures, ordered by `(committed_at, slot_index)`. Never accept capture ids from the client
    for a Full Set, never build a partial one, and never reorder. Full Set crops are the
    deterministic `coverCrop` rule. No smart crop, face detection or other content analysis.
  - Accent colors are registry keys. Never interpolate a host-entered string into CSS or SVG
    (SVG text always goes through `escapeXml`).
  - The signage QR plate is never themed: dark on light, untouched quiet zone, nothing inside it,
    destination always the event's capture link. Draft previews use the URL-less `preview` QR
    type. Never mint a real or temporary token for a preview.
  - Host/guest original downloads and D11 bulk download are unaffected by keepsakes and by the
    sharing toggle.
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
- **Event accent on guest surfaces uses role tokens, never raw `text-brand`.** Accent text is
  `text-brand-ink`, text on a brand fill is `text-brand-foreground` (marigold's fill is too light
  for white text or for text on white). Themed surfaces get the six `--brand-*` roles from
  `accentCssVars()` inside `.ff-event-theme`; host chrome, Operator, the logo and the QR plate
  never do. The unit test in `lib/theme/accents.test.ts` is the contrast safeguard.
- **Raw HEIC/HEIF is not supported in MVP** (product.md §14). The prebuilt `sharp` can't decode
  HEVC HEIC. A photo only works when the browser has already converted it to JPEG, and that isn't
  guaranteed, so never claim FiveFrames decodes HEIC. Refuse it early (see `isHeicUpload` in
  `lib/theme/image.ts`) and test against the real fixture `test/fixtures/theme-sample.heic`.
- **Keepsake templates render twice — Satori export and DOM preview — from one component.** Use
  the target helpers in `lib/keepsakes/templates/` (`clamp`, `ellipsis`, `ShadowedBox`, `Img`)
  instead of raw CSS for those concerns. Satori clamps only `display: block` + `lineClamp`, draws
  nothing for an absolutely positioned box sized in percent or by `right`/`bottom` insets (use
  pixel sizes), and rejects `undefined` style values. Large blurred shadows dominate render time,
  so the export uses pre-blurred bitmaps. After any template change, re-check DOM/export parity.
- **Signage draws only what `lib/media/signage-layout.ts` places.** Any new mark, text or image
  on a sign goes into the layout model first, so `signage.test.ts` checks it against the plate,
  the quiet zone and the safe area. Text is outlined from the bundled TTFs, not `<text>`. Keep the
  real-decoder tests (`test/qr-decode.ts`) passing for every format.
- **Live dashboard updates go through the app's own SSE route** (`/events/[eventId]/live`,
  decision D21). It sends an opaque version, never data, and the page refreshes from the server.
  Never add browser Supabase Realtime, and never derive counts from messages. Any background
  `router.refresh()` must be gated on a reachability probe (see `DashboardLive`): a failed
  refresh request makes Next hard-navigate, which strands an offline tab on the browser's error
  page.
- **Media lives in one private R2 bucket, reached only through `lib/storage/r2.ts`** (D26,
  architecture §7h). Rows store unprefixed paths. `lib/media/storage.ts` and `theme-storage.ts`
  add `captures/` / `theme/`. Never add a custom domain or public access, and never read the
  `R2_*` variables anywhere else. A browser upload is one presigned PUT. Its type, exact length
  and cache policy are signed, so the browser must send exactly the headers the server returned,
  and the declared size must be the file's real size. The SDK client keeps
  `requestChecksumCalculation: "WHEN_REQUIRED"`, or presigned PUTs demand a checksum the browser
  can't send. `captures.upload.integration.test.ts` runs the browser's request against real R2.
- **The guest Keep sequence lives in `lib/capture/keep.ts`.** A server action rejects when its
  request fails in transit, so every reserve/commit call there must end in an outcome (Retry),
  never an uncaught throw. Retry reuses the persisted reserve key or re-commits the same uploaded
  reservation. Never mint a new key for a Retry (NET-02).
- **Guest/demo photo inputs never set `capture`.** It makes Android open only the camera, with no
  library. Use `components/ff/photo-picker-input.tsx`.
- **Multi-file original downloads go through `lib/media/save-files.ts`.** One cross-origin link
  navigation per file lets later ones cancel earlier ones (HOST-10), and copy may only claim a
  file was sent to the browser, never saved. The host's "Download all" builds ZIP parts in
  `lib/media/zip-download.ts` (D25) and uses `save-files.ts` only as its fallback. A part fails
  whole, never as a ZIP missing a photo. Call the save picker before any other await in the
  click, and build the stream only once its destination is ready.
- **Remaining frames count moderated captures.** The guest view hides hidden/deleted captures,
  but their slots stay used (`lib/capture/guest-slots.ts`). Never derive "shots left" from the
  visible list.
- **Gallery layouts are presentation only (D22, architecture §7d).** Masonry, Rows and Grid all
  render the one list from `listCapturesForGalleryViewer`, which never takes the layout. Never
  add per-layout filtering, ordering or moderation. Render gallery tiles, real or marketing,
  through `GalleryLayoutList`, so the site can't show an arrangement the product doesn't make.
  Its container tiers live in both `lib/gallery/layouts.ts` and `app/globals.css`;
  `layouts.test.ts` checks that they match. Tile shapes come from `display_width/height`,
  recorded at commit, never from measuring in the browser.
  Time sections (D24) follow the same rules: labels only, computed on the server from
  `created_at` (the order key) in the event's timezone. Never send a capture's own time to the
  client.
- **Prices, guest capacities and hosted-access periods live only in `lib/plans/registry.ts`**
  (D24). Activation stamps them onto the event from `payments.plan`, never from the draft's
  `events.plan`, so a plan change after a checkout can't change what was bought. After
  activation, read `guest_session_cap` and `hosted_until` from the event (an operator override
  may have raised the cap), never from the registry. Marketing copy interpolates the registry;
  `content.test.ts` rejects literal guest counts.
- **Free's lighter event is gated where bytes are served** (product.md §15.3.1). Signage and
  keepsake routes check `isSignageFormatAllowed` / `isStyleAllowed` against
  `eventPlanFeatures(event)`, and screens list only `signageFormatsFor` / `stylesForPlan`. A new
  signage format, keepsake route or Premium-only feature must go through the same check, never
  a UI-only hide.
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
- Keepsake designs are "keepsake styles", never "frames". Copy must not tie the five styles to
  the five-photo allowance, and must never merge the two families ("ten styles"). Nobody gets an
  editor: the host sets image, accent and hashtag, and the guest picks a style.
- The Full Set is never a goal. Before a session has five committed, visible captures, it is
  absent: no locked or teaser state, no "unlock", and no progress toward it.

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

Those remain human/real-device verification (tracked in `docs/release-validation.md`) unless
actually exercised through an approved real-device testing system.

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
