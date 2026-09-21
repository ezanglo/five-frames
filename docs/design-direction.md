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
