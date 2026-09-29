# Design Direction

**Status: implemented 2026-09-29 — awaiting human visual approval.** The contracted FiveFrames
UI/UX designer handoff is the authoritative visual direction for the whole product. It
**supersedes every previous visual exploration** recorded here before (the warm
terracotta/cream guest, host, public-gallery and demo directions, and their Dribbble/Shopify/A24
anchors). Those are retired; do not blend them back in.

Authority for visual work: product behavior comes from `docs/product.md`, accepted decisions and
architecture first; the handoff governs structure, visual system, interaction presentation,
responsive layout and journey composition. Where a handoff screen implies behavior the product
doesn't have, the product wins and the screen is rendered as its closest visual equivalent (see
"Known discrepancies").

## Source artifacts (the anchor)

Contracted designer handoff, in `docs/design-handoff/`:

- `FiveFrames_Design_System_DS01-06.pdf` — DS01 colors · DS02 type/spacing/radius · DS03
  buttons/badges/controls · DS04 inputs/navigation · DS05 photo components/cards · DS06 layout,
  states, accessibility, screen inventory, desktop templates, CSS tokens.
- `Host Flow · Full Journey · Part 1 of 2.png` — sign up, sign in, forgot password, check inbox,
  new password (desktop 1440 + mobile 390).
- `Host Flow · Full Journey · Part 2 of 2.png` — events (first time / populated), Create ·
  Details / Look / Share, Dashboard, Settings, Photos.
- `Guest Flow · Full Journey + 2 States for Event Landing Page.png` — Join (open / not open /
  closed), Your Five, Preview + Message, Completion, Gallery (locked / revealed), Photo view.

Don't duplicate the handoff here — open it. This file records only what an implementer needs.

## Where the system lives in code

| Concern | Home |
|---|---|
| Semantic tokens (DS01/DS06 names 1:1), type scale, radius, elevation, focus, photo-header gradients | `app/globals.css` |
| Fonts: Fraunces 600 (`font-heading`), Plus Jakarta Sans 400–800 (`font-sans`) | `app/layout.tsx` |
| Class merging aware of the custom tokens | `lib/utils.ts` (+ `lib/utils.test.ts`) |
| Primitives: buttons, fields, password, toggle, pills/chips/badges, avatar, wordmark, cards, stat tiles, shot slots, teaser, viewer, preview sheet, countdown, confirm dialog, copy link, guest preview | `components/ff/*` |
| Shells: guest mobile shell, auth split, host nav/mobile header/sheet, event tabs, wizard | `components/ff/guest-shell.tsx`, `components/ff/auth-shell.tsx`, `components/ff/host/*` |
| Lifecycle → status badge (Draft → Upcoming → Open → Closed → Revealed) | `components/ff/event-status.tsx` |
| Event-local date/time formatting (always the event's timezone) | `lib/events/format.ts` |
| Labels for stored enums (reveal timing, visibility, payment method) — never show raw values | `lib/events/labels.ts` |
| 404 and error screens (guest shell, any audience) | `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `components/ff/error-screen.tsx` |
| Brand fonts shared by the root layout and `global-error` | `app/fonts.ts` |
| App icons (violet tile, two tilted frames) | `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png` |
| Branded share card (Satori; tokens mirrored by hex, fonts as bundled TTFs) | `lib/media/share-card.tsx`, `lib/media/fonts/` |

Components consume semantic utilities (`bg-brand`, `text-ink-muted`, `bg-surface-subtle`,
`border-line`, `ff-dashed`, `rounded-sheet`, `shadow-glow`, `text-label`…), never raw palette
values. There is no `components/ui` layer any more — every surface, including the Operator
Console, uses `components/ff`.

## Implementation principles

- **One shell per audience.** Guest screens: 271px photo header (night gradient) → white sheet
  (−24px overlap, 28 radius) → one primary action pinned low. Designed at 390, works 360–480;
  above 480 the 430px column stays centered on night with the header glow blurred behind — there
  is no desktop guest app. Photo viewer and Preview go full-bleed dark.
- **Host is responsive by template, not by stretching.** < 1024: dark header + white sheet +
  segmented tabs. ≥ 1024: 72h top nav, grey page, white cards, 1200 content, and the four DS06
  templates — auth split (640 panel + 420 form), event list (4-col grid, 3 at 1024–1279), event
  pages (260 cover header, 64h underline tabs, main + 380 side column; Photos full-width 4-col),
  create wizard (wizard bar replaces nav, 700 form + 340 side column).
- **One violet primary per screen.** Everything else steps down to secondary (grey), dark (host
  utility: Save changes, Download QR, Download all, Copy link), on-tint (inside tint cards), or
  compact (32px with an invisible 44×44 hit area).
- **Fraunces only for titles, event names and big moments.** Never on buttons, forms or numbers
  — big counters are Jakarta ExtraBold with tabular numerals.
- **Labels above fields, 16px inputs**, subtle surface, 1px border, radius 14; focus = brand
  border + 4px violet ring; errors = danger border + danger helper text (never color alone).
- **Only the next shot slot is violet.** Filled / next / empty; the five-shot teaser is
  decorative. Remaining shots are stated factually; no nudges (product.md §4).
- **Every number is real.** Stat tiles, badges, "N of 5", countdowns derive from the actual
  event/lifecycle; nothing decorative.
- **No cover imagery exists**, so every "photo header" uses the handoff's no-cover treatment
  (night + violet glow). The auth brand panel keeps the photo panel's crop/gradient/hierarchy
  with an abstract five-frame motif instead of stock photography.

## Accessibility baseline

≥4.5:1 meaningful text (muted text only on white/subtle; `ink-on-dark` #A9A6B5 on night);
≥44×44 targets; visible focus everywhere (`.ff-focus`); real buttons/inputs/labels; `aria-label`
on icon-only controls; photo alt text "Photo by {name}, {time}" + message where the viewer may
know them; `prefers-reduced-motion` honored globally; countdowns tick visually but announce
politely at most once a minute; confirmations use native `<dialog>`.

## Known discrepancies (product/architecture wins)

Each is rendered as the closest visual equivalent; none adds product capability.

1. **Share step before payment.** The handoff hands over the QR at Create · Share. Invariant 7:
   no link/QR before payment. Share is "Ready to activate?" (price breakdown, Pay online,
   manual-payment note) until activation, then "You're all set" with QR/link/signage.
2. **Capture window times / countdowns.** FiveFrames has no scheduled open/close (product.md
   §7.3). Create · Details has no Opens/Closes fields; Join "not open yet" has no countdown;
   Your Five's info card and the dashboard's third stat tile show the real capture state and the
   automatic safety-net close instead of "2h 14m left".
3. **Cover image and theme color** (Create · Look, Settings) are not product capabilities (no
   schema, no storage path). Omitted; Look carries the supported welcome message, hashtag and
   gallery/sharing settings. Guest screens always use violet.
4. **Guest preview before payment.** product.md §7.2: no guest-experience preview before
   payment. The wizard's right column shows the "What happens next" timeline; the phone preview
   appears only in Settings for activated events.
5. **Closed Join → "View the gallery".** product.md §13: the gallery is reached only through its
   own link, so the capture link never links to it. Closed Join shows the guest's own photos (if
   their session exists) and explains the gallery has its own link.
6. **Locked gallery teaser.** The handoff shows blurred thumbnails and "184 photos from 38
   guests"; invariant 8 forbids exposing an unrevealed gallery, so the teaser is abstract with no
   counts. A countdown shows only for a host-set custom reveal time.
7. **Public viewer attribution.** The handoff's viewer shows photographer name and time. Public
   gallery viewers see photo + message only (unchanged data exposure); the guest's own viewer
   and the host views show name and time.
8. **Join social proof** ("38 guests are already snapping" + avatar stack) omitted — exposes
   other guests and is an engagement nudge (product.md §4). Replaced by the required trust cues.
9. **"Download ZIP"** is labeled "Download all" — D11 sequential signed originals, no server ZIP.
10. **Danger zone / Delete event** omitted — no host event-deletion capability exists yet.
11. **"Keep me signed in", "Help" nav link, Terms/Privacy links, "Open email app"** omitted — no
    backing behavior or pages.
12. **In-browser camera only (DS06 Assets).** The accepted native picker/camera input is kept
    (product.md §9.2: reliability over capture polish).
13. **Guest message limit** shows 100 (DS04) in the UI; the server keeps accepting up to 280.
14. **Dashboard "Reveal gallery"** sets the existing "Immediately" reveal timing (a shortcut to a
    Settings option, with a confirm), not a new mechanism.

## Surfaces outside the handoff

Not in the handoff's screen inventory, so each reuses an existing template rather than inventing
one:

- **Operator Console** (`app/(operator)/`): the host desktop template at every width — white top
  nav with the wordmark and an ink `OPERATOR` tag (never violet, so it can't read as the host
  product), grey page, white cards, 1200 column. Event list = one card of dense rows with the
  shared status badge; event detail = stat tiles for the aggregate counts, lifecycle/gallery
  cards (times in the event's timezone), and a 380 side column with payment history and the one
  privileged action card. The privileged submit is the screen's single primary (refund uses
  danger) and asks through the native `<dialog>` confirm, not `window.confirm`.
- **404 / error** (`app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`): the guest shell,
  because either can reach any audience. A host opening an event they don't own sees the same
  404 as a missing one (invariant 9).
- **Branded share card** (`lib/media/share-card.tsx`): white card, photo contained on a night
  tile (radius/sheet), Fraunces event name, Jakarta meta, message on surface/subtle in
  text/on-tint, wordmark footer. Cards are stored per capture once generated, so ones generated
  before this design keep the old look.
- **Signage SVGs** (`lib/media/signage.ts`) and the landing page (`app/page.tsx`) use the new
  tokens and fonts.
- **Not in the repo:** Supabase Auth email templates (confirmation, password reset) are set in the
  Supabase dashboard and still use Supabase's defaults.

## Avoid

- Reintroducing the retired warm palette, Bricolage Grotesque, or per-scope token families.
- Raw hex/palette values in components; generic shadcn/SaaS composition on product screens.
- A second violet primary on a screen; Fraunces on buttons, forms or numbers.
- Stretching a mobile host layout to desktop, or building a desktop guest app.
- Decorative/fake numbers, countdowns not backed by the lifecycle, or engagement copy.
- Building a handoff control whose behavior the product doesn't have — log it above instead.
