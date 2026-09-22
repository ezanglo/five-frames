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

---

# Payment, activation, and event signage

**Status: awaiting human visual verification.** Presentation-only pass, implemented 2026-09-22,
over the already-complete and verified Slice 8 payment/activation functionality. Extends the
accepted "Host experience" direction above rather than replacing it — no new token family, no
anchor-approval gate required (docs/design-direction.md §6.6: an established direction may be
extended autonomously). No payment semantics, provider behavior, activation logic, operator
behavior, or pricing changed.

## Scope

The unpaid-event state, the checkout page (`app/(host)/events/[eventId]/checkout/page.tsx`), the
event dashboard's payment/activation-related banners and masthead copy
(`app/(host)/events/[eventId]/page.tsx`), and the four signage SVG formats
(`lib/media/signage.ts`). Not the operator console, not payment logic, not the webhook route, not
pricing.

## Product character

Same as the host scope above: calm, operational, trustworthy — a Filipino host paying ₱999 for a
real event should understand what they're buying, that "continue to payment" is safe to retry,
and that paying doesn't open guest capture, without reading a paragraph of legal copy.

## Research

Targeted image search for one-time-purchase checkout trust patterns and event QR/table-card/poster
signage turned up mostly generic stock-template results, and — notably — almost every QR/table-
card reference found was wedding-specific (table tents, "capture the love" table numbers,
invitation-style decoration), which is exactly the framing product.md and this pass's brief
require avoiding for an event-agnostic product. Rather than force-fit a mismatched anchor, this
pass extends the already-accepted host visual identity (warm palette, terracotta accent, the
photo-object/frame motif established in the guest-scope section above) instead of adopting an
external anchor for the checkout or signage surfaces — consistent with the "later redesigns under
an established visual direction" allowance in the Skill's operating rules.

## Structural signature

- **Checkout page:** added a "What you get" panel above the price breakdown — three lines (link/
  QR/signage issued on confirmation; five frames per guest up to the event's guest cap; capture
  stays closed until explicitly opened) — so a first-time host understands what a "checkout" here
  actually produces before seeing the price, addressing this pass's requirement that the host
  understand what happens after payment and that capture doesn't auto-open. This did not exist
  before; previously the only post-payment expectation set was one line above the price box.
- **State-differentiated banners:** the cancelled/pending/confirming states on both the checkout
  page and the dashboard no longer share one identical neutral `bg-host-surface` treatment. A
  "payment in progress" or "confirming" state now gets a distinct accent-tinted, bordered
  treatment with a `Clock` icon; "cancelled" and "saved" keep the existing quieter neutral
  treatment (a `CircleCheck` icon added to "Saved" for symmetry) — so an in-progress state is
  visually distinguishable from a completed or inert one, not identical copy in an identical box.
- **Retry wording kept honest:** the existing "won't start a second one or charge you twice" claim
  was preserved as-is (not touched, not strengthened) — it accurately describes the real
  `begin_provider_checkout` one-active-session guarantee (D16/D17, migration
  `20260922030000_payment_session_integrity.sql`), not a broader "retrying can never cause another
  charge" claim this pass was told not to make.
- **Post-activation reassurance:** the masthead's `active` state (paid, capture not yet opened)
  gained a quiet one-line reassurance — "Paid and ready. Capture stays closed until you open it —
  no rush." — directly under the event name, using the existing masthead structural signature (no
  new panel, no urgency styling, no badge).
- **Signage (`lib/media/signage.ts`):** rebuilt from a bare cream-background QR+Georgia-serif SVG
  into a composition consistent with the product's actual visual identity: the warm host/guest
  canvas color (hex-converted from the same palette, since SVG can't read CSS custom properties),
  the product's display face (`Bricolage Grotesque` with a geometric-sans fallback chain) for the
  event name, and a QR "photo-object" plate — a rounded card with a terracotta hairline border and
  four small L-shaped viewfinder-corner brackets at its corners, a quiet capture-cue motif echoing
  the guest scope's frame identity without any literal camera icon or event-type decoration. A
  vertical-centering layout algorithm replaced the previous top-anchored one, which had left roughly
  40% of the poster format's canvas as dead space below the content — the four formats now center
  their content proportionally regardless of aspect ratio.

## Typography

Signage headline: `Bricolage Grotesque` (falls back to a geometric sans-serif chain when the font
isn't available to the rendering surface — SVG `font-family` degrades gracefully rather than
failing). Body/instruction text: an Inter/Helvetica/Arial stack, mirroring the host scope's
body-face choice. No new typography introduced on the checkout/dashboard pages — existing
`font-host-display` and body text sizes are unchanged.

## Color/material

Signage reuses the host/guest palette's hex equivalents (`#faf4e9` canvas, `#3d3226` ink, `#8a7c6a`
muted ink, `#a8632f` accent, `#fffdf8` plate) rather than the previous generic cream/black pairing
that shared no color relationship with the rest of the product. Checkout/dashboard banners use the
existing `--host-accent` token at low opacity for "in progress" states — no new color was added to
`.host-scope`.

## Layout and rhythm

No structural change to the checkout page's or dashboard's existing single-column, panel-based
host layout — this pass adds one new panel (checkout's "What you get") and restyles existing
banner/masthead elements in place. Signage layout is unchanged in file-level API (still four fixed
formats, still one SVG per format) but its internal vertical rhythm is now computed to center
content in the canvas rather than being top-anchored with an unaccounted-for bottom margin.

## Controls and forms

No new form primitives. The checkout CTA copy simplified from "Continue to payment (GCash, Maya,
or card)" to "Continue to payment" with the payment-method detail moved to a smaller trust line
below the button (`Lock` icon + "Pay with GCash, Maya, or card — handled securely by PayMongo"),
since payment methods are a trust/reassurance detail, not the primary action's label.

## Motion

None added beyond the existing pattern (a `Clock` icon uses the same restrained `animate-pulse`
already used by the masthead's live-state dot, applied only to actively-in-progress states, not to
inert ones).

## Accessibility

All new icons are `aria-hidden` decoration alongside real text — status is still communicated by
text in every case, never by icon or color alone, consistent with every other scope's accepted
accessibility approach. Contrast of the new accent-tinted banner backgrounds against
`--host-ink`/`--host-accent` has not been measured numerically — flagged for human verification,
same as every other scope in this document. Signage SVGs are static images with no interactive
elements; the encoded QR data is unchanged in meaning, only its surrounding visual treatment
changed.

## Avoid

- Any wedding-specific or single-event-type framing in signage — explicitly avoided per this
  pass's research finding that most real-world QR/table-card references skew wedding-specific;
  the viewfinder-corner motif and photo-object plate are deliberately event-agnostic.
- Claiming retrying checkout "can never" cause a second charge — the copy states what the system
  actually guarantees (one active session, reused on retry), not an absolute never-charge-twice
  promise.
- Treating the browser's checkout return/cancel redirect as trusted payment state — unchanged;
  activation still only ever happens from the webhook, and this pass added no code path that reads
  activation state from the redirect.
- Any pressure, urgency, or celebratory styling on the post-activation "capture stays closed"
  moment — it is one quiet line, not a banner, confetti, or a call to action to open capture now.
- A Canva-like signage editor, theme picker, or per-event customization — signage remains four
  fixed, non-customizable formats, only their shared visual treatment changed.

---

# Guest sharing and the branded share card

**Status: awaiting human visual verification.** Presentation-only pass, implemented 2026-09-23,
over the already-complete and verified Slice 10 sharing functionality. Extends the accepted
guest-scope direction above rather than replacing it — anchor selected autonomously per
docs/design-direction.md §6.6 ("later redesigns under an established visual direction"), since
this is not a foundational identity shift. No sharing authorization rules, gallery-visibility
logic, moderation behavior, storage behavior, idempotency, or Web Share/download-fallback
semantics changed — see Verification below.

## Scope

The generated share-card image (`lib/media/share-card.tsx`, served by
`lib/dal/share-cards.ts`) and the guest-facing share affordance on filled frames
(`Share2` button in `app/(guest)/e/[token]/frame-grid.tsx`, wired through
`use-share-capture.ts` in both `capture-slots.tsx` and `own-captures.tsx`). Not the DAL's
authorization/eligibility logic, not `web-share.ts`'s share-vs-download decision, not the
guest capture journey documented above.

## Product character

Same as the guest scope: calm, tangible, event-agnostic. A share card exists to leave the
product with the guest when they post it somewhere else — it should read as "a photo from my
event, with a quiet FiveFrames credit," never as an ad for FiveFrames wrapped around someone
else's memory.

## Research

Targeted research (design-inspiration search + targeted web search) for real production
share-card/social-card/photo-keepsake systems, avoiding wedding-only references per the brief:

- **Spotify Wrapped** shareable stat cards — real production, the strongest available reference
  for "typography and metadata that survive being screenshotted into a chat/feed at small size."
  Its promotional, saturated, gradient-driven tone was explicitly **not** taken — this pass needed
  the opposite: restraint.
- **Fujifilm Instax-style instant-print format** — a real, universally recognized physical
  keepsake-photo object (mat border, photo dominant, a caption strip beneath, not overlaid on the
  image) that people already normalize sharing to social feeds. Chosen as primary anchor because
  it is the only reference that structurally extends FiveFrames' own already-accepted "photo
  object" language (the mat/rounded-corner/soft-presence treatment already used for every filled
  frame, gallery tile, and moderation tile) rather than introducing a new visual genre.
- **Museum/gallery wall-label ("tombstone data") convention** — artist/title/date as a small,
  quiet caption block *below and secondary to* the work, never overlaid on it. Reused here for the
  event-name/date/hashtag/message hierarchy, consistent with the same "quiet metadata under a
  prominent element" idea already established as the Public Gallery section's anchor rationale
  above.

## Primary anchor

- **Instant-print photo-object format** (Fujifilm Instax-style keepsake prints; format-level
  reference, not a specific screen or product to clone)
- Source/type: a real, widely recognized physical media format, inspiration-only (no
  code/asset/branding reuse — nothing Instax-specific, no literal camera chrome, no plastic-frame
  skeuomorphism)
- Why chosen: it is the only reference that both (a) is already a "worth posting" object in real
  life, unprompted, and (b) structurally extends FiveFrames' own accepted photo-object material
  language instead of adding a second one. It also solves the arbitrary-aspect-ratio requirement
  for free — a mat border around a photo tolerates any source shape without a forced crop.
- What was explicitly **not** taken from it: literal instant-film chrome (rounded plastic
  corners, a white polaroid-style thick-bottom-heavy border treated as a physical object photo,
  handwriting-style caption fonts, film-grain/light-leak filters on the photo itself — invariant
  10 and the brief both forbid inventing filters on the original).

## Secondary references

- **Spotify Wrapped** — contributed the legibility requirement (bold enough kicker/wordmark,
  sufficient name/metadata contrast) for surviving screenshot/feed compression, not its tone.
  Inspiration-only.
- **Museum wall-label convention** — contributed the caption hierarchy (name → date/hashtag →
  message, each visually quieter than the last, all quieter than the photo). Inspiration-only.

## Structural signature

- The card is no longer a flat two-band rectangle with a **black** photo letterbox
  (`lib/media/share-card.tsx`, previous version). It is a single warm-paper mat
  (`lib/media/share-card.tsx`'s `CANVAS` token) framing a rounded photo tile, a hairline rule,
  and a caption strip — one continuous "photo object," not a picture with a footer bolted on.
- The photo tile's own background is the same mat color as the rest of the card, not black. An
  `object-fit: contain` photo whose aspect ratio doesn't match the tile (portrait, landscape,
  or square source, per the brief) now letterboxes invisibly into the mat instead of showing
  bars of an unrelated color — the same "never force one destructive crop" requirement, met
  without a visible seam.
- Four small accent-colored corner brackets (`CornerTickTL/TR/BL/BR`) sit just inside the photo
  tile's corners — the same quiet "viewfinder" motif already established on event signage
  (`lib/media/signage.ts`), reused here rather than inventing a second capture-cue mark, and
  deliberately not a literal camera icon.
- The caption strip's hierarchy is now real typographic hierarchy, not four same-weight text
  rows: a small accent kicker (mark + "FIVE FRAMES," tracked caps) → event name (largest, the
  product's actual display face) → date/hashtag (one quiet metadata line) → optional guest
  message (quoted, quietest). Each is visually subordinate to the one above it, and all of them
  are subordinate to the photo.
- Long event names truncate on a word boundary, not mid-word (`truncate()` now finds the last
  space before the character limit rather than hard-slicing) — a small, self-contained polish fix
  found and fixed during visual verification of the long-name/long-message checklist case.

## Typography

The product's actual display face is used here for the first time in this file: the previous
version deferred it (documented in the file's own comment) because `ImageResponse` needs raw font
bytes, not a CSS `next/font` reference. This pass bundles static TTFs
(`lib/media/fonts/bricolage-grotesque-{600,700}.ttf`, `inter-500.ttf` — the same open-source
Google Fonts files already used via `next/font/google` elsewhere, fetched once and committed
rather than fetched over the network at render time) and passes them to `ImageResponse`'s `fonts`
option per the Next.js `ImageResponse` "Custom fonts" guide
(`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md`). Event
name: Bricolage Grotesque 700. Kicker/metadata/message: Inter 500. This closes the one deliberate
gap the original implementer flagged, rather than leaving it open indefinitely.

## Color/material

Same hex-converted `--guest-canvas`/`--guest-ink`/`--guest-ink-muted`/`--guest-accent` family as
`lib/media/signage.ts` — no new palette. One new hex value, `BORDER` (`#ddd2c7`, converted from
`--guest-border`), for the hairline rule between the photo tile and the caption strip.

## Layout and rhythm

1080px-wide canvas (unchanged), now built from an explicit mat padding (40px top/sides, 64px
bottom — asymmetric, echoing the classic instant-print mat) around a fixed-height photo tile, a
32px rule row, and a 300px caption block, rather than two flush bands. Total canvas height is
1356px (previously 1380px for the same landscape case — a byproduct of the new layout, not a
independently chosen number; `lib/media/share-card.test.ts`'s fixed-size assertion was updated to
match).

## Controls and forms

Not applicable — this is a static generated image, not an interactive surface.

## Guest share affordance

The `Share2` icon button on filled frames (`frame-grid.tsx`) was visually reviewed against the
brief's "discoverable but not louder than capture/own-photo behavior" requirement and left as-is:
it already matches the established pattern (a small always-visible icon toggle on the photo,
mirroring the numeral badge's placement and the host moderation grid's favorite/hide icons) rather
than a labeled button or a second call to action. One real gap was found and fixed instead: the
download fallback (`lib/share/web-share.ts`'s `shareOrDownload`) already returned which of
"shared"/"downloaded"/"cancelled" happened, but `use-share-capture.ts` discarded that result, so a
guest whose device fell back to download got no acknowledgement anything happened. A quiet status
line ("Saved your share card — find it in your downloads.") now surfaces only for the
`"downloaded"` outcome — a native share hands off to the OS's own confirmation, and a cancelled
share says nothing, matching the existing "never pressure the guest" rule.

## Motion

None added, consistent with the guest scope's restraint. The existing spin-on-the-share-icon busy
state (`RefreshCw` in `frame-grid.tsx`) is unchanged.

## Accessibility

Unchanged: the share button remains a real `<button>` with `aria-label="Share this photo"`. The
new status line is plain text alongside the existing error text, communicated the same way
(never by icon or color alone). The share-card image itself has no interactive elements. Contrast
of the new caption typography against the mat has not been measured numerically — flagged for
human verification, same as every other scope in this document.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm build`, and the full `vitest` suite (128 tests, including the
`lib/dal/share-cards.integration.test.ts` and `lib/dal/captures.integration.test.ts` suites
against the real linked dev Postgres/Storage) all pass. Two integration tests intermittently hit
the default 5s per-test timeout against live infrastructure during this pass and passed cleanly on
re-run with a longer timeout — pre-existing network-latency flakiness unrelated to this change,
not a regression it introduced. No DAL, authorization, or Web Share/download-fallback logic was
touched; `lib/dal/share-cards.ts` and `lib/share/web-share.ts` are unmodified.

Browser-driven/rendered visual verification was not performed — global environment rules prohibit
launching a dev server or browser automation for this session. Rendered PNG samples (portrait,
landscape, square, long event name, long message, no message/no hashtag) were generated directly
through `renderShareCardPng()` and inspected as static images to confirm the layout doesn't
overflow or error, but this is **not** a substitute for the human visual-verification checklist
below.

## Avoid

- Any literal instant-film skeuomorphism (plastic corner curl, drop shadow implying a physical
  print sitting on a surface, faux-handwriting caption font, grain/light-leak filters on the
  guest's actual photo) — only the mat/caption-strip *structure* was taken from the anchor, not
  its literal material rendering, per invariant 10 and the brief's "no invented filters" rule.
- Likes, comments, view counts, or any social-metrics chrome on the card — explicitly out of
  scope per the brief.
- A host-selectable card theme or a card editor — the card remains one fixed template, same as
  event signage remains four fixed formats.
- Letting the caption strip's typography or the corner-tick motif grow loud enough to compete
  with the photo for attention — every element in the caption block is sized and weighted to sit
  below the photo in the page's reading order.

---

# Public pre-purchase demo

**Status: awaiting human visual verification.** Presentation-only pass, implemented 2026-09-23,
over the already-complete and verified Slice 13 demo functionality. Extends the accepted
guest-scope direction above rather than replacing it — anchor selected autonomously per
docs/design-direction.md §6.6 ("later redesigns under an established visual direction"), since the
brief explicitly required reusing the accepted guest identity and the real `FrameGrid` unmodified,
which rules out a foundational identity shift by construction. No demo isolation, client-only
architecture (decision D14), pricing, account behavior, or roadmap scope changed — see
Verification below.

## Scope

`app/(demo)/demo/demo-experience.tsx` only — the copy, information architecture, and conditional
rendering around the demo's five-frame interaction. Not `lib/demo/state.ts`, not
`lib/demo/samples.ts`, not the route-isolation guarantees, not `FrameGrid` itself, not the real
guest capture journey documented above.

## Product character

Same as the guest scope: calm, tangible, event-agnostic. The demo's job is narrower than the
guest scope's, though — it exists to make a first-time visitor *feel* the five-frame mechanic in
seconds and understand it becomes a shared collection, not to fully replicate every guest-flow
affordance or to read as a feature tour.

## Research

Targeted research for interactive product demos / try-before-signup experiences. The
design-inspiration tool's image/reference search returned mostly generic B2B "interactive demo
platform" marketing listicles for this query space (Walnut, Navattic, Demoboost, etc.) rather than
concrete, inspectable UI case studies — this is a UX-pattern space, not a visual-style space, so
the tool's coverage was thin. Per the research budget's "stop when additional results stop adding
meaningful new directions," research converged on three real, well-documented structural patterns
instead of forcing a visual anchor:

- **Duolingo's pre-signup first lesson** — real, well-documented product pattern (confirmed via
  search: "no account creation before lesson one, sign-up only shows up after you've already
  earned XP"). Relevant for: teaching entirely by doing the real mechanic, deferring signup until
  after value is felt.
- **Excalidraw's zero-friction canvas** — real production product (confirmed via search: "no
  sign-up, no pop-ups... instant-canvas spirit"). Relevant for: the core interaction *is* the
  entire front door, with no tutorial gate or explanation carousel before it, and a quiet,
  non-blocking upsell alongside it.
- **Browser private/incognito-mode intro pattern** — a real, universally familiar convention
  (a calm, explicit "nothing here will be saved" statement, understated rather than alarming,
  coexisting with an otherwise fully normal, fully functional interface underneath). Relevant for:
  stating a non-persistence guarantee candidly without it reading as a warning or a legal notice.

## Primary anchor

- **Excalidraw's zero-friction try-now canvas** (product-level structural pattern, not a specific
  screen to clone)
- Source/type: real production product, inspiration-only (no code/asset/branding reuse)
- Why chosen: it is the only one of the three that resolves the brief's explicit rejection list
  (no tutorial carousel, no gamified tour, no marketing-page-with-screenshot) by removing the
  question entirely — there is no separate "demo mode" chrome layered over the product, the real
  interaction is the whole page. That transferred directly: the demo's headline and picker changes
  below exist to get out of the way faster, not to add more explaining surface area.
- What was explicitly **not** taken from it: Excalidraw's toolbar-dense, utility-app visual
  register — FiveFrames' existing warm, tactile guest identity (already accepted above) was kept
  completely unchanged, per the brief's explicit "do not redesign `FrameGrid` or fork the
  production guest visual system" constraint.

## Secondary references

- **Duolingo's pre-signup first lesson** — contributed the sequencing idea of deferring the full
  conversion offer until after the visitor has actually experienced the mechanic once, rather than
  presenting it up front alongside the interaction. Inspiration-only.
- **Browser private/incognito-mode intro copy** — contributed the tone for the non-persistence
  guarantee: stated candidly and only once as ambient framing (the badge), then reinforced briefly
  at the one moment it matters most (right before committing a frame), rather than repeated as a
  disclaimer block. Inspiration-only.

## Structural signature

- **Progressive, state-driven copy replaces one static intro paragraph.** The previous header
  always showed the same explanatory paragraph regardless of what the visitor had done.
  `demo-experience.tsx`'s `DemoBadgeHeader` now shows its one-sentence orientation line only
  before the visitor's first interaction (`showOrientation = !hasAnyFilled && !pickerOpen &&
  !composing`); once they've acted once, the explanatory sentence gets out of the way and the
  headline itself becomes the only state cue (idle → "Tap the first frame to try it.", partial →
  "Keep going, or stop whenever it feels right.", complete → "All five — yours to keep, for
  now."). This is the Excalidraw-anchored "teach by interaction, not upfront explanation" idea
  applied to copy sequencing, not layout.
- **The sample-vs-own choice is now two legible, differently-weighted paths instead of one
  paragraph plus an unlabeled thumbnail row.** The picker now leads with "Use your own photo" as
  the primary button with its own reassurance line directly beneath it ("Stays on your device —
  never uploaded."), then a quiet "or try a sample" divider, then the existing sample strip
  unchanged in mechanism (still `DEMO_SAMPLE_PHOTOS`, still a horizontal scroll of thumbnails) —
  only the framing around the same two existing affordances changed.
- **The non-persistence guarantee is restated once more at the moment it's most load-bearing**:
  the composing panel (where a visitor is about to tap "Keep this frame") now carries its own
  short reassurance line ("Only visible here — this demo photo isn't uploaded or saved
  anywhere."), rather than relying solely on copy read minutes earlier in the header. This is the
  incognito-mode-anchored idea of restating a non-persistence guarantee right where the action
  happens, not just once at arrival.
- **The conversion CTA now becomes visible at the point the brief specifies, rather than always
  being present.** `TrustAndConversion` previously rendered its full price/CTA panel
  unconditionally, even before a visitor had touched anything. It now takes a `compact` prop: with
  zero frames kept, only a single quiet, ghost-styled text link ("Already sold? Create your
  event") is present, so nothing resembling a sales panel competes with the very first frame; once
  `hasAnyFilled` is true, the existing full panel (price line + primary "Create your event" button,
  copy and `EVENT_PRICE_PHP` reference unchanged) takes its place. No new route, no new offer — the
  same link and same panel content, gated on visitor progress rather than always rendered.
- **The preview/complete state copy now names the "moments become part of the collection" idea
  the brief centers on**, which the previous copy ("A taste of a revealed FiveFrames gallery.")
  didn't state. Partial: "This is what your frames look like together."; complete: "All five,
  together — a taste of a real event's collection." Still no celebratory framing (no confetti
  language, no "you did it") — closure is stated plainly, consistent with the guest scope's
  existing no-celebration precedent.

## Typography, color/material, media treatment, motion, accessibility

Unchanged from the guest-scope sections above — this pass introduced no new token, no new font
role, no new image treatment, and no new interaction beyond the conditional-rendering and copy
changes described in Structural signature. `FrameGrid`, `.guest-scope`, and every existing
`--guest-*` token are used exactly as already accepted.

## Layout and rhythm

No change to the page shell (`app/(demo)/layout.tsx`'s `max-w-md` single column, unchanged) or to
`FrameGrid`'s fixed board. The picker panel gained one additional row (the "own photo" reassurance
line and the "or try a sample" divider) and the composing panel gained one reassurance line above
the existing textarea — both within the existing `rounded-2xl` panel treatment already established
for these two states.

## Controls and forms

No new form primitives. The compact-CTA state's text link reuses plain Tailwind utility classes
(no new `Button` variant) since it must read as quieter than even the existing `ghost` button
variant used for "Start over."

## Avoid

- Reintroducing a static, always-visible explanatory paragraph in the header regardless of
  interaction state — that was the exact pattern this pass moved away from.
- Rendering the full price/CTA panel before a visitor has kept any frame — the brief is explicit
  the CTA must "become visible at an appropriate point without interrupting the demo," and zero
  interaction is not that point.
- Any tutorial carousel, gamified progress indicator, or "X of 5 left" copy — none was added,
  consistent with the guest scope's existing no-gamification rule and this pass's brief.
- Forking or restyling `FrameGrid` for this surface — every visual change in this pass lives in
  `demo-experience.tsx`'s copy and conditional rendering only.

## Verification

`pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass (`/demo` still prerenders as static `○`,
confirming route isolation — decision D14 — is unaffected). The full `pnpm test` suite ran with all
`lib/demo/*` unit tests (state, samples, route-isolation) passing; one pre-existing, unrelated
integration suite (`lib/dal/share-cards.integration.test.ts`) intermittently timed out against live
Postgres/Storage infrastructure on this run — the same category of pre-existing network-latency
flakiness already documented in the "Guest sharing" section above, not a regression this pass
introduced (this pass touched no DAL, no share-card code, and no file outside
`demo-experience.tsx` and this document).

Browser-driven/rendered visual verification was not performed — global environment rules prohibit
launching a dev server or browser automation for this session. This design pass is marked awaiting
human visual verification; see the checklist delivered with this pass's completion report.
