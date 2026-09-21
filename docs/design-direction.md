# Design Direction

**Status: accepted.** Foundational guest-experience redesign (Full Redesign Mode), human-verified
2026-09-21. Later work should extend this direction rather than replace it; a further identity
shift would need a new foundational pass with its own anchor-selection gate.

## Scope

The guest capture journey only: join → five frames → capture/preview/confirm → own captures,
including the calm not-open-yet / capture-ended states. Scoped under `.guest-scope`
(`app/(guest)/layout.tsx`); the host dashboard, login/signup, and marketing pages are
intentionally untouched and still use the default shadcn palette.

## Product character

Event-agnostic. FiveFrames is not a wedding product — weddings, birthdays, reunions, trips, and
company events are equally primary. The five frames are the product's mechanic and its visual
hero: tangible, fillable spaces, not a progress bar and not an invitation.

## Primary anchor

- **Virtual Disposable Camera App (iOS, Android)** — Purrweb UI/UX Agency
- https://dribbble.com/shots/21544965-Virtual-Disposable-Camera-App-iOS-Android
- Source/type: Dribbble concept shot, inspiration-only (no code/asset reuse; licensing unclear,
  so the implementation is original)
- Why chosen: it's the only reference found where a fixed grid of photo slots is the primary
  interactive surface — you act directly on the grid, not on a control below it. That macro idea
  (the five frames themselves are the thing you tap) transferred directly to FiveFrames' mechanic
  of exactly five finite frames.
- What was explicitly **not** taken from it: its neon orange/lime palette and generic filter-app
  chrome. Those were named out of scope by the user and are absent from the implementation.

## Secondary references

- **"Frames" film-photography logbook app** —
  https://www.35mmc.com/21/05/2026/frames-one-year-later-building-a-film-photography-logbook-app-full-time/
  — contributed the idea that each frame carries a stable numbered identity (I–V) rather than
  being an interchangeable grid cell, and that composing controls belong in a persistent,
  thumb-reachable action zone rather than an inline card that reflows the page. Inspiration-only.
- **Vintage/skeuomorphic disposable-camera concept** — Vladislava Urazova,
  https://dribbble.com/shots/21675093-Virtual-Disposable-Camera-App-iOS-Android — contributed the
  tactile "photo-object" treatment (mat, soft shadow, rounded corner) applied to every frame, and
  a warm, nostalgic-but-not-wedding-specific palette. Inspiration-only.

## Structural signature

- The five frames are one irregular photo-board composition (`frame-grid.tsx`, `.frame-board` in
  `globals.css`) — a 4-column, fixed-row-height grid with each frame given an explicit,
  deliberately uneven placement: Frame I is a wide hero strip; II is a tall portrait column; III
  is a wide strip beside it; IV and V are two small squares beneath III. This was a refinement
  pass after an initial version (hero + a uniform 2×2 below it) read as generic UI cards rather
  than one distinctive collection — see the note at the end of this section. Placement is fixed
  per index regardless of fill state — only which frame carries the active affordance changes —
  so the board never resizes or reflows as a guest fills it. The I→V numeral badge on every
  frame, not its position or size, is what keeps the order legible despite the asymmetry.
- Future (not-yet-reachable) frames are a light, skeletal outline — a hairline dashed border on
  a transparent background — not a filled card, so they read as empty frames waiting rather than
  as inert UI elements. Only the active frame (dashed accent border + solid raised fill) and
  filled frames (an actual photo) have visual weight; future frames deliberately have almost
  none.
- The composing preview uses `object-contain` (not `object-cover`) so the guest always sees the
  complete photo before confirming, regardless of its orientation — the frame's fixed shape
  letterboxes a mismatched aspect ratio rather than cropping content out of view. Filled/
  committed frames keep `object-cover` for the settled gallery look; the guest already confirmed
  the crop when they committed, and the original file is untouched regardless (invariant 10).
- Exactly **one** frame is ever the active capture target — the one the server has actually
  reserved or will reserve next (`activeIndex` in `capture-slots.tsx`, driven by existing
  `pending`/`committed` slot state, never by which cell the guest tapped). Other empty frames are
  visibly part of the five but are not interactive, so the UI never implies the guest can choose
  their own slot — the server remains the sole authority on slot assignment.
- Every frame — future, active, resuming, composing, or filled — renders through one
  `PhotoFrame` component and one visual object type (rounded photo-object with a numeral badge),
  not a set of ad hoc per-state styles.
- A selected photo previews **inside its own frame's position** in the grid, not in a separate
  preview block elsewhere on the page.
- The compose/confirm/retry controls (`app/(guest)/e/[token]/capture-slots.tsx`) render only
  while a file is selected and its attempt is in flight (previewing / reserving / uploading /
  committing / error) — never permanently present. When mounted, they sit in a `position: sticky`
  panel (not `fixed`) inside the page's normal scroll flow, so they don't fight the iOS Safari /
  in-app-browser virtual keyboard the way a fixed-positioned dock can; `env(safe-area-inset-bottom)`
  covers the home-indicator area, and the message field scrolls itself into view on focus as a
  defensive fallback for browsers with inconsistent `dvh` support under a keyboard.
- The guest's own-captures view (`own-captures.tsx`) reuses the identical `FrameGrid` in a
  read-only mode (filled/future only) — one visual language across the whole guest journey
  instead of a second grid style for "your captures."
- Event identity (`EventIdentity` in `page.tsx`) is compact — name plus one line of context —
  deliberately smaller than the frame grid, so the event header doesn't compete with the frames
  for hero status the way an invitation-style masthead would.

## Typography

- UI/body: Inter (`--font-sans`, already loaded app-wide).
- Guest-scope display face: **Bricolage Grotesque** (`--font-guest-display`, `.font-guest-display`
  utility), used for the event name, the frame numerals, and the capture-state headline. Chosen
  as a playful-but-grown-up geometric grotesque — distinctive without reading as an editorial
  serif/invitation face (that direction was explicitly rejected in an earlier pass).

## Color/material

Warm, low-chroma palette scoped to `.guest-scope` in `app/globals.css` — no neon, no saturated
accents:

| Token | Role |
|---|---|
| `--guest-canvas` | page background (warm paper) |
| `--guest-canvas-raised` | inputs, the active-frame surface |
| `--guest-surface` / `--guest-surface-quiet` | filled-frame fallback / future-frame background |
| `--guest-ink` / `--guest-ink-muted` | primary / secondary text |
| `--guest-accent` / `--guest-accent-foreground` | the one accent (a grounded, low-chroma
  terracotta) — active-frame affordance, primary button, composing ring |
| `--guest-border` | hairline dividers (composer's top border) |

## Layout and rhythm

Mobile-first single column (`max-w-md`), `flex min-h-dvh flex-col` shell
(`app/(guest)/layout.tsx`) so the sticky action zone has a real flex-flow bottom to pin to. Frame
grid uses a fixed 2-column bento with a spanning hero cell; gaps and radii are generous (`gap-3`,
`rounded-[1.5rem]`) to read as physical objects rather than dense UI chrome.

## Media treatment

Every photo (active preview, composing preview, filled capture) renders `object-cover` inside its
frame's fixed aspect ratio (hero: 16/10, others: 1/1), with a small numeral badge overlaid in the
top-left corner rather than as a caption below the image.

## Controls and forms

Primary actions (Start capturing, Keep this frame) use the accent fill; secondary/retry actions
use the existing `ghost` button variant unchanged. Inputs (`Input`, `Textarea`, `Label`) are the
existing shadcn/base-ui primitives, restyled via `className` only — no new form primitives were
introduced, per the component-library rule.

## Motion

Tap feedback on the active frame is a small scale-down (`active:scale-[0.96]`); the composing
overlay uses a spinning refresh icon during busy phases. No confetti, no completion celebration,
no progress-style animation — deliberately, per the "no gamification" constraint.

## Accessibility

Interactive frames are real `<button>` elements (not `<div onClick>`); future/inert frames are
plain `<div aria-hidden>` so they're skipped by assistive tech rather than announced as
unreachable controls. Text contrast uses `--guest-ink`/`--guest-ink-muted` against the warm
canvas — not yet measured against WCAG AA numerically; flagged below for human verification.
Errors are communicated by text (`text-destructive`), never by color alone.

## Avoid

- Reintroducing a uniform 3-column thumbnail grid, or a uniform 2×2 for Frames II–V, for either
  capture or own-captures — both were tried and rejected for reading as generic UI cards rather
  than one distinctive photo board.
- Any progress-pressure copy ("3 of 5 left", streaks, badges) — remaining frames stay implicit in
  the grid itself.
- Letting a guest's tap target imply they chose which slot they filled — only the
  server-authoritative next slot is ever the active affordance.
- A permanently-mounted bottom action dock, or a `position: fixed` composer — both reintroduce
  the iOS-keyboard problems this pass deliberately avoided.
- Wedding-invitation or editorial-microsite framing for the event header — it must stay compact
  and secondary to the frames across every event type.

---

# Host experience

**Status: accepted.** Foundational host-surface redesign (Full Redesign Mode) through Slice 4,
human-verified 2026-09-21. Extends this direction rather than replacing it — the guest section
above is unchanged and remains its own accepted scope. Later host-surface work should extend this
direction rather than replace it; a further identity shift would need a new foundational pass
with its own anchor-selection gate.

## Scope

Host authentication (login/signup), draft event creation, the event dashboard (status, capture
open/close, guest/photo counts), the moderation gallery (hide/unhide/delete/favorite), and event
configuration (details, gallery reveal, sharing), through Slice 4. Scoped under `.host-scope`
(`app/(host)/layout.tsx`, plus `/login` and `/signup`). Slice 5 (gallery-link/reveal delivery
behavior) was explicitly not designed or implemented in this pass — only existing configuration
fields were restyled.

## Product character

Operational, not decorative. The host dashboard exists so an event organizer can tell, at a
glance, whether capture is live, and moderate a small photography-forward gallery — not to
showcase the product's warmth the way the guest join/capture flow does. Calmer and quieter than
the guest scope by design.

## Primary anchor

- **Pixieset — Client Gallery Dashboard** (2024 redesign)
- https://blog.pixieset.com/blog/client-gallery-dashboard/
- Source/type: real production SaaS product, inspiration-only (no code/asset reuse)
- Why chosen: the only reference found where the operator (photographer) manages a gallery that
  someone else (a client/guest) contributed to or views — structurally the same host↔guest
  relationship as FiveFrames. Its composition of state + one primary lever + gallery in a single
  coherent operator view, with counts as ambient badges rather than boxed stat widgets, is the
  skeleton the event dashboard's masthead and layout are built on.
- What was explicitly **not** taken from it: its cool-neutral/white palette. FiveFrames' host
  surfaces stay warm, in the same family as the guest scope, just quieter.

## Secondary references

- **Photo Mechanic** (Camera Bits) — https://carlseibert.com/tag/photo-mechanic/ — contributed
  the moderation-gallery pattern: a gutter-only contact sheet with no per-tile card border, and
  persistent status iconography (flag/star equivalent) rendered directly on the photo rather than
  a button row beneath it. Translated from its desktop/keyboard paradigm to touch — every action
  icon is always visible (no hover-only affordances) and sized ≥44px. Inspiration-only.
- **Picflow** — https://picflow.com/ — contributed the individual photo-tile treatment (mat,
  rounded corner, soft shadow) applied across the moderation grid, keeping continuity with the
  guest scope's tactile "photo object" language at dashboard density. Inspiration-only.

## Structural signature

- The event dashboard opens with a masthead status band, not a text label — lifecycle state is
  legible from color and a live-state pulse dot before any copy is read. Capture open/close is
  the single dominant control in that band (accent-filled when actionable, live-tinted outline
  when open), not a button nested inside a Card two levels down.
- Guest-session and photo counts are an ambient caption line inside the masthead ("12 guests ·
  43 photos"), never boxed stat tiles.
- The event page is no longer a stack of bordered `Card` components. The masthead is one region;
  the moderation gallery is a labeled section with no card shell; event configuration is one
  continuous form surface with quiet section dividers (`border-t`) instead of separate Cards.
- Moderation tiles (`gallery-grid.tsx`) are a Photo Mechanic–style contact sheet: gutter-only
  spacing, no individual tile border, favorite/hide as always-visible icon toggles on the photo
  (Picflow-style mat/rounded/shadow treatment underneath). Delete is deliberately visually
  quieter and requires a second tap (an inline confirm/cancel pair replaces the tile) so a
  destructive action never carries the same weight as the one-tap reversible toggles — the
  underlying `window.confirm` safety check is unchanged.
- The dashboard (event list) replaces the "New event" Card with an inline composer bar and
  renders events as compact rows with a state dot instead of a card grid.

## Typography

Same as guest scope: Inter (`--font-sans`) for UI/body, Bricolage Grotesque
(`--font-guest-display`, applied via the `.font-host-display` utility) for the event name, page
headings, and the masthead — one display face for the whole product, not a host-specific one.

## Color/material

New `--host-*` token set in `.host-scope` (`app/globals.css`), same warm/low-chroma family as
`.guest-scope` but quieter and with a dedicated live-state color the guest scope doesn't need:

| Token | Role |
|---|---|
| `--host-canvas` / `--host-canvas-raised` | page background / raised surfaces (inputs, panels) |
| `--host-surface` / `--host-surface-quiet` | moderation-tile background / quiet inline panels |
| `--host-ink` / `--host-ink-muted` | primary / secondary text |
| `--host-accent` / `--host-accent-foreground` | primary action (open capture, create, save) —
  same terracotta hue as the guest accent for identity continuity |
| `--host-live` / `--host-live-foreground` | the one host-only color: capture-open state |
| `--host-danger` | destructive-action text/fill (delete) |
| `--host-border` | hairline dividers and input borders |

## Layout and rhythm

`flex min-h-dvh flex-col` shell (`app/(host)/layout.tsx`), `max-w-3xl` content column — wider
than the guest scope's `max-w-md` because this is a data-dense operator surface, not a single
capture card. Generous `rounded-2xl` on the masthead and form panels, consistent with the guest
scope's rounded/tactile language.

## Media treatment

Moderation-tile photos render `object-cover` in a fixed `aspect-square`, matted inside a
`rounded-2xl` surface with a small soft shadow — the same "photo object" idea as the guest
frames, at grid density rather than hero scale.

## Controls and forms

Primary actions (open capture, create draft, save changes) use `--host-accent`. Close capture
uses a live-tinted outline rather than a second solid color, so "the event is live" stays legible
even on the control that turns it off. Existing shadcn/base-ui primitives (`Input`, `Textarea`,
`Label`, `Select`, `Switch`, `Button`) are unchanged — restyled via `className` only, per the
component-library rule.

## Motion

Minimal: a pulse on the live-state dot when capture is open, standard button/hover transitions.
No celebratory or gamified motion, consistent with the guest scope's restraint.

## Accessibility

Favorite/hide are real `<button>` elements with `aria-label` and `aria-pressed`; delete requires
an explicit second tap (inline confirm/cancel) in addition to the existing `window.confirm`, so
it's not reachable by a single accidental tap. Status is never communicated by color alone — the
masthead always also states the lifecycle label in text. Contrast against the warm host canvas
has not yet been measured numerically; flagged below for human verification, same as the guest
scope.

## Avoid

- Reusing the guest scope's five-frame bento/photo-board composition for anything host-facing —
  that pattern is specific to the guest capture mechanic (product.md invariant, brief for this
  pass).
- Reintroducing a stack of bordered `Card` components as the default host page structure — this
  was the exact pattern this pass moved away from.
- Hover-only affordances anywhere in the moderation grid — the dashboard must work as a touch
  surface first.
- Implying or building Slice 5 gallery-link/reveal delivery behavior — only existing
  configuration fields were restyled in this pass.

---

# Public gallery

**Status: awaiting human visual verification.** Full Redesign Mode pass through Slice 5,
implemented 2026-09-22. Extends this direction rather than replacing either scope above — the
guest and host sections are unchanged. A further identity shift to this surface would need a new
foundational pass with its own anchor-selection gate.

## Scope

The public gallery viewer at `/g/[token]` (`app/(gallery)/`) — the revealed-collection overview,
the immersive full-screen photo viewer, and the three access-denial calm states (not found,
private/"only me", not yet revealed) — plus clarity-only polish to the existing host-side
capture-link/gallery-link controls (`link-row.tsx`, the "Links" section of
`app/(host)/events/[eventId]/page.tsx`). Gallery reveal-timing and visibility *logic* (Slice 5,
decision D12) is unchanged; this pass is presentation only.

## Product character

The payoff, not an operator tool and not the capture mechanic. Someone opening the gallery link
is looking at a finished record of the event — calm, intentional, photography-dominant — never a
feed to scroll for engagement. Suitable for any event type; nothing here is wedding-specific.

## Primary anchor

- **A24 gallery (film catalog)** — https://a24.raviklaassens.com
- Source/type: real production site, inspiration-only (no code/asset reuse)
- Why chosen: the only reference found with a genuinely *archival* composition — a vertical,
  equal-weight record rather than a grid, a feed, or an operator dashboard — which fits "this is
  the payoff record of the event" better than a browsing or feed metaphor. Its restrained,
  quiet-metadata-under-a-prominent-element hierarchy is what the gallery's event-name/message
  treatment and the calm-state panels are built on.
- What was explicitly **not** taken from it: its literal one-full-width-item-per-row structure.
  FiveFrames galleries can hold far more photos than a film catalog holds titles, so a literal
  read would produce an unbounded page. The implementation preserves A24's *rhythm and equal
  weight* while grouping photos into small repeating "spread" units (see Structural signature).

## Secondary references

- **RemyShoots** — https://www.remyshoots.co.za — contributed the immersive full-screen,
  swipe-through single-photo viewing mode as a first-class second level of the gallery, distinct
  from the overview. Inspiration-only.
- **Ethan W Photography** — http://ethanwong.photography — informed restraint and whitespace
  discipline (sparse typography, generous breathing room) but was not used as a structural
  anchor.

## Structural signature

- The revealed gallery is **not** a uniform grid, a masonry/Pinterest wall, the guest scope's
  fixed five-frame board, or the host scope's contact-sheet moderation grid. It's a vertical
  sequence of "spread" units of up to three photos each (`gallery-archive.tsx`), alternating
  between two asymmetric templates (a wide hero + two squares; a tall portrait + two stacked
  landscapes) — a photobook-spread rhythm that varies as you scroll, structurally distinct from
  the guest board's *fixed* five-position layout because it's an open-ended repeating pattern
  over an arbitrary photo count, not five specific slots.
- Overview tiles render `object-cover` inside their spread's fixed aspect ratio — the same
  "settled photo object" treatment (rounded mat, soft shadow) already established for filled
  guest frames and host moderation tiles, kept for visual continuity across all three scopes.
- Tapping any tile opens a **full-screen immersive viewer** (`photo-viewer.tsx`) — a native
  horizontal `scroll-snap` track, not a gesture-library carousel, so touch swipe and momentum come
  from the browser. Every image renders `object-contain` against a dark, warm-neutral matting
  surface (`--guest-ink`) so an arbitrary aspect ratio — portrait, landscape, square — is shown
  complete, never cropped; the opposite tradeoff from the overview, which crops deliberately for
  spread rhythm. Desktop also gets arrow-key paging; a quiet "n / total" indicator and a single
  always-visible close control are the only chrome. No hover-only affordances.
- Large collections stay bounded without a real pagination subsystem: all committed, signed
  captures are fetched once server-side as today; the client reveals them in batches of four
  spreads with an explicit "Show more" control, and off-screen images carry `loading="lazy"`. This
  is bounded progressive presentation of already-loaded data, not a data-loading subsystem — the
  immersive viewer always has the full list, so swiping isn't limited by what's been revealed in
  the overview.
- All three access-denial states (not found, private, not yet revealed) share one abstract
  "held archive" panel — a plate sized and rhythmed like the archive's own tiles (rounded,
  dashed-border, quiet surface) with a small icon (`ImageOff` / `Lock` / `Clock`) and the
  existing per-reason copy. It deliberately shows **no** thumbnail, silhouette, or count — nothing
  that would hint at content the viewer isn't authorized to see — while still reading as "the same
  gallery, just not open to you" rather than a generic error page. The existing per-reason copy
  differentiation (today's product behavior) is unchanged.
- Host-side: `link-row.tsx` gained a small leading icon per link (`Camera` for the capture link,
  `Images` for the gallery link) and tightened helper copy, entirely inside the existing
  `.host-scope` tokens and layout — no structural change, per the constraint that this pass must
  not make the host dashboard imitate the gallery's composition.

## Typography

Unchanged: `font-guest-display` (Bricolage Grotesque) for the event name and calm-state headings,
Inter for body copy — the gallery route already sits under `.guest-scope` for this reason.

## Color/material

Reuses the existing `--guest-*` token family for continuity with the rest of the warm/tactile
identity — no new palette. The immersive viewer's dark matting surface is the one deliberate
exception: `--guest-ink` at full opacity, chosen because it's already a warm dark brown rather
than true black, so full-screen photo viewing stays inside the product's warm identity instead of
switching to a generic "dark mode."

## Layout and rhythm

Inherits the guest-scope shell (`max-w-2xl` column). Spread units stack with generous `gap-8`
vertical rhythm between them; tiles within a spread use `gap-2`, consistent with the tight,
tactile spacing already established for filled photo objects elsewhere in the product.

## Media treatment

Overview: `object-cover` inside per-template fixed aspect ratios (16/10 hero, 4/3 single, 3/4
portrait, 3/2 landscape, 1/1 square) — cropped deliberately for spread rhythm, consistent with the
existing precedent that *settled* captures (guest's own view, host moderation grid) crop, while
*in-progress* composition doesn't. Immersive viewer: `object-contain`, complete image always
visible regardless of orientation — the guest's actual composition is never forced into the
viewport's aspect ratio.

## Controls and forms

"Show more" is a quiet text-link action, not a button — it's pacing, not a primary action. The
immersive viewer's close control is a single always-visible circular icon button (no hover-only
affordance); position is communicated by an unobtrusive text indicator, never a progress bar or
gamified counter.

## Motion

Minimal: the immersive viewer's paging comes from native scroll-snap momentum, not custom
animation. No celebratory motion, no auto-advancing slideshow.

## Accessibility

Immersive viewer: `role="dialog"` `aria-modal="true"`, focus moves to the close control on open
and is restored to the tapped tile on close, `Escape` closes, arrow keys page on desktop, and the
underlying archive is marked `inert` while the viewer is open so background content is excluded
from focus/tab order without a custom focus-trap implementation. Every archive tile is a real
`<button>` with an `aria-label`. Status/denial states are communicated by heading and body text,
never by icon or color alone. Contrast against the warm canvas has not yet been measured
numerically — flagged for human verification, same as the guest and host scopes.

## Avoid

- Reusing the guest scope's five-frame board or the host scope's contact-sheet moderation grid as
  the gallery's composition — both were explicitly ruled out as anchors for this surface.
- A literal one-full-bleed-photo-per-row read of the A24 anchor for the overview — that doesn't
  scale to FiveFrames' arbitrary, potentially large photo counts.
- Any social-feed mechanic (likes, comments, avatars, infinite auto-scroll) — "Show more" is an
  explicit, quiet action, never automatic.
- A download or sharing affordance in the gallery viewer — both are out of scope (Slice 8 and
  existing product-controlled sharing elsewhere), not part of this pass.
- Letting a calm/denial state hint at what's behind it (thumbnail, silhouette, count) — the held-
  archive panel must stay abstract regardless of how tempting a preview would look.

---

# Operator Console

**Status: awaiting human visual verification.** Full Redesign Mode pass, implemented
2026-09-22, applied to the read-only Operator Console shipped in Slice 7 (no mutations exist
yet). Extends this direction rather than replacing any scope above — those are unchanged. A
further identity shift to this surface would need a new foundational pass with its own
anchor-selection gate.

## Scope

The internal Operator Console only: `/operator` (event list/search) and
`/operator/events/[eventId]` (event operational detail), both under `app/(operator)/`. Not the
guest, host, or public-gallery surfaces above, and not a redesign of Slice 7's functional scope —
still read-only, still no guest-media access, still no mutation wired up. This pass also visually
reserves, but does not implement, the Slice 9 manual-payment-confirmation/refund actions.

## Product character

Internal and utilitarian, not customer-facing. Before this pass, the Console (built functionally
in Slice 7) simply reused `.host-scope` wholesale — same tokens, same bordered-`Card`-stack
layout the host redesign had already moved away from — which read as "the host dashboard, copied
again" rather than its own surface, and gave an operator no visual cue that they were in a
different, cross-host tool. This pass gives it its own quieter, denser, more neutral identity:
trustworthy and internal, built for a support person triaging many events quickly, not for a
host managing their one event.

## Primary anchor

- **Shopify Admin — Orders list and order detail (including the refund panel)** —
  https://help.shopify.com (product itself, real production admin; specific screenshots
  inspected: a Shopify order-refund screen, magecomp.com/blog/wp-content/uploads/2023/06/
  Refund-reason.png)
- Source/type: real production SaaS admin, inspiration-only (no code/asset reuse)
- Why chosen: it is the only reference inspected that already solves *both* required views —
  a dense entity list and a compact detail view — as one coherent product, and its order-detail
  composition (read-only informational cards on the left, a visually distinct right-rail
  "Summary" panel ending in a bold primary action button) is a direct structural fit for "reserve
  a place for future manual-payment/refund actions that reads differently from informational
  state." The Console's right-rail "Manual payment actions" panel is built directly on this idea.
- What was explicitly **not** taken from it: its literal financial-summary math (subtotal/tax/
  shipping breakdown) — FiveFrames has no line-item order to total, so only the *panel
  separation and action-placement* pattern transferred, not its content.

## Secondary references

- **Linear — issue search/list view** — https://linear.app/changelog (screenshot inspected:
  a Linear issue search results view) — contributed the dense, border-free row-scanning pattern:
  a small colored status glyph leading every row, primary/secondary text pair (title, then a
  quieter identifier line), inline metadata pills before a trailing detail, no per-row card
  border. The operator event list's state dot + name/host-email pair + trailing payment/state
  pills is built on this. Inspiration-only.
- **Stripe Dashboard — Payments list** — https://docs.stripe.com/dashboard/basics (screenshot
  inspected: a Stripe payments-list clone/recreation showing the real dashboard's structure) —
  contributed the single prominent search bar with a leading icon, and the colored status-pill
  vocabulary (a filled, rounded, low-chroma badge per state) used for the list's Paid/Unpaid
  badge and the lifecycle state pill. Inspiration-only.

## Structural signature

- The Console no longer reuses `.host-scope`. It has its own `.operator-scope` token family
  (`app/globals.css`) — near-neutral (far lower chroma than guest/host), denser type, and one
  reserved saturated color (`--operator-privileged`, a muted indigo) used *exclusively* for the
  manual-payment/refund reserved zone, never for any ordinary informational element, so a
  privileged action can never be visually confused with a read-only one.
- The event list (`operator/page.tsx`) is a border-free, Linear-anchored row list, not the
  previous plain `<ul>` of name/host-email/lifecycle-label text. Each row leads with a small
  lifecycle-state color dot (inside a `StatePill`), shows event name (primary) and host email
  (secondary) as a stacked pair, and trails with a compact "guests/cap" count, a Paid/Unpaid
  status pill (Stripe-anchored), and the lifecycle-state pill — all visible without opening the
  row, directly serving "enough information to locate a customer problem quickly."
- Search is a single Stripe-style pill input with a leading search icon (`operator/page.tsx`) —
  no non-functional filter chips were added; the underlying search is still the same one-query
  DAL call from Slice 7 (`listEventsForOperator`), only its presentation changed.
- The event detail page (`operator/events/[eventId]/page.tsx`) no longer stacks four uniform
  bordered `Card` sections. It now opens with a compact masthead (event name, a `StatePill`,
  host email/event id) and splits into a two-column body on desktop: a wider "operational state"
  column (Lifecycle, Guests and capacity, Capture and moderation, Gallery) using label/value rows
  separated by quiet `border-t` dividers between subsections rather than boxed cards, and a
  narrower right-rail panel holding Payment state plus the new "Manual payment actions" reserved
  zone (Shopify-anchored). Below `lg`, the right-rail panel moves under the operational-state
  column rather than disappearing or requiring horizontal scroll.
- The reserved manual-payment/refund zone renders as two non-interactive, dashed-outline rows
  (a `Lock` icon, an inert-styled label, and "Reserved for Slice 9 — not yet available" copy) in
  `--operator-privileged` — deliberately *not* real `<button>` elements, so nothing announces
  itself to assistive tech as an actionable control that does nothing. This is presentation-only:
  no server action, no mutation, no new data is read from any table Slice 7 didn't already query.
- The event list's empty/no-results state is a designed dashed-border panel (a `SearchX` icon
  plus text), replacing the previous bare "No events match." line — consistent with the
  calm-panel visual language already established for the gallery's access-denial states, adapted
  to this surface's more neutral tone rather than the guest scope's warm calm-state copy.

## Typography

Same as guest/host: Inter (`--font-sans`) for body/UI, Bricolage Grotesque
(`--font-guest-display`, applied via `.font-operator-display`) for the event name and page
headings — one display face for the whole product. Sizes run a step smaller than the host scope
(`text-lg` mastheads, `text-xs` labels) to fit the higher information density this surface needs.

## Color/material

New `--operator-*` token set in `.operator-scope` (`app/globals.css`):

| Token | Role |
|---|---|
| `--operator-canvas` / `--operator-canvas-raised` | page background / raised surfaces (header, right-rail panel, search input) |
| `--operator-surface` / `--operator-surface-quiet` | row hover fill / quiet fills |
| `--operator-ink` / `--operator-ink-muted` | primary / secondary text — denser and higher-contrast than the host scope's equivalents |
| `--operator-border` | hairline dividers, dashed empty-state and reserved-action borders |
| `--operator-accent` | same warm terracotta as guest/host, used sparingly (links, focus) for identity continuity |
| `--operator-privileged` / `--operator-privileged-foreground` / `--operator-privileged-surface` | the one reserved color — manual-payment/refund zone only |
| `--operator-state-{draft,active,capture_open,capture_closed,expired,archived}` | one color per lifecycle state, used only by the small `StateDot`/`StatePill` |

## Layout and rhythm

`flex min-h-dvh flex-col` shell (`app/(operator)/layout.tsx`), `max-w-5xl` content column —
wider than the host scope's `max-w-3xl` since the list and the two-column detail both need more
horizontal room at this density. The header is shorter (`py-2.5` vs. the host header's `py-3`)
and carries a small "Internal" tag next to the wordmark, a cue this is not a customer-facing
surface.

## Controls and forms

The search input is the existing shadcn/base-ui `Input`, restyled via `className` only — no new
form primitive, per the component-library rule. The reserved manual-payment/refund zone is
intentionally not a control at all (see Structural signature) until Slice 9 actually implements
it.

## Motion

None added. This is a scan-and-read surface; the only interactive affordance (a list row link)
gets a plain background-color hover transition, consistent with the restraint elsewhere in the
product.

## Accessibility

List rows are real `<Link>` elements covering the full row (a large hit target, no nested
interactive elements). The reserved manual-payment/refund placeholders are plain `<div>`s with
no button/link semantics and no `tabindex`, specifically so they are not reachable as dead
controls via keyboard or announced as buttons by a screen reader. Status is communicated by both
a color dot and adjacent text everywhere (list pills, detail masthead), never by color alone.
Contrast against `--operator-canvas` has not yet been measured numerically — flagged for human
verification, same as every other scope above.

## Avoid

- Reusing `.host-scope` tokens or the host dashboard's bordered-`Card`-stack layout for anything
  under `app/(operator)/` — that was the exact pattern this pass moved away from.
- Any non-functional-looking control in the manual-payment/refund reserved zone — it must read as
  "not here yet," never as a broken button.
- Charts, sparklines, or other BI-dashboard decoration — product.md §5.1 is explicit the Console
  is not a BI/analytics surface, and this pass added none.
- Exposing a capture's signed media URL, thumbnail, or any per-guest-media affordance from this
  surface — unchanged from Slice 7's DAL boundary (`lib/dal/operator-events.ts` still selects
  aggregate counts only).
