# Design Direction

**Status: implemented 2026-09-29 — awaiting human visual approval** (including the desktop/browser
pass, "Desktop and browser" below). **Event Theme & Keepsakes and its Full Set amendment:
approved by the user 2026-09-30** as the implementation target for Slices 15–17 (see that
section). Slices 15 (theme foundation) and 16 (keepsakes, both families) are built; themed signage
(Slice 17) is not. The contracted FiveFrames
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
- `FiveFrames_Identity_v1.0/` — the logo system (2026-09-30): identity board (PNG + HTML) and
  SVG exports of the symbol, wordmark, lockups, favicons and app icons. See "Brand identity".
- `FiveFrames_Theme_Keepsakes_v1.0/` — the Event Theme & Keepsakes design (2026-09-30): one board
  (HTML + a PNG per section) covering the Look studio, Settings → Look, control states, the five
  keepsake styles, the guest picker, and themed signage with Draft previews. Sections 11–17 are
  the Full Set amendment (five Full Set styles, the Signature construction, crop pressure tests,
  the family switch, completion, and host Look). See "Event Theme & Keepsakes".

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
| Logo geometry: symbol, pixel-snapped favicon drawing, outlined wordmark, lockup, tones — one source for UI, images and signage | `lib/brand/logo.ts` |
| Logo components: `BrandMark` (symbol), `BrandLockup`; `Wordmark` = lockup + Host/Operator tag | `components/ff/brand-mark.tsx`, `components/ff/wordmark.tsx` |
| App icons (the symbol: adaptive SVG tab icon, violet-tile `.ico`, full-bleed violet Apple icon) | `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png` |
| Bundled brand TTFs for server-rendered images (keepsakes, Open Graph); the DOM keepsake previews load the same files | `lib/media/fonts/`, `components/ff/keepsakes/fonts.ts` |
| Curated accent registry + roles (`deriveAccentRoles`, `accentCssVars`), hashtag rules, theme-image limits (Slice 15) | `lib/theme/` |
| Look studio: controls, swatches, hashtag field, theme-image control, preview stage, and the Slice 15 presentational keepsake/signage objects | `components/ff/look/` |
| Keepsakes: registry (`styles.ts`), geometry and slot rects (`geometry.ts`), `coverCrop`, closed inputs (`context.ts`), the ten templates for both render targets (`templates/`), the export pipeline (`render.tsx`); guest picker and DOM preview in `components/ff/keepsakes/`. Themed signage is Slice 17 | `lib/keepsakes/`, `components/ff/keepsakes/`, `lib/media/signage.ts` |
| Marketing motion: print primitive, hero prints, reveal, parallax hook, motion prefs, print/ease tokens | `components/ff/marketing/{photo-print,hero-prints,reveal}.tsx`, `hooks/use-print-parallax.ts`, `lib/motion.ts`, `app/globals.css` |

Components consume semantic utilities (`bg-brand`, `text-ink-muted`, `bg-surface-subtle`,
`border-line`, `ff-dashed`, `rounded-sheet`, `shadow-glow`, `text-label`…), never raw palette
values. There is no `components/ui` layer any more — every surface, including the Operator
Console, uses `components/ff`.

## Implementation principles

- **One shell per audience.** Guest screens: 271px photo header (night gradient) → white sheet
  (−24px overlap, 28 radius) → one primary action pinned low. Designed at 390, works 360–480.
  Wider viewports recompose the same shell — see "Desktop and browser" below. Photo viewer and
  Preview go full-bleed dark.
- **Host is responsive by template, not by stretching.** < 1024: dark header + white sheet +
  segmented tabs. ≥ 1024: 72h top nav, grey page, white cards, 1200 content, and the four DS06
  templates — auth split (640 panel + 420 form), event list (4-col grid, 3 at 1024–1279), event
  pages (260 cover header, 64h underline tabs, main + 380 side column; Photos full-width 4-col),
  create wizard (wizard bar replaces nav, 700 form + 340 side column).
- **One violet primary per screen** (on themed guest screens, one *event-accent* primary; see
  "Event Theme & Keepsakes"). Everything else steps down to secondary (grey), dark (host
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
- **Photo headers use the handoff's no-cover treatment** (night + glow) when an event has no
  theme image. The glow takes the event accent. With a theme image, the image fills the header
  (see "Event Theme & Keepsakes" → guest screens). The auth brand panel keeps the photo panel's
  crop/gradient/hierarchy with an abstract five-frame motif instead of stock photography.

## Desktop and browser (accepted 2026-09-29)

Laptop and desktop are first-class FiveFrames surfaces. This supersedes the handoff's "guest is
mobile only — a centered 430px column above 480" note (guest flow sheet, DS06 "Responsive").
Product behavior is unchanged; only composition differs.

- **Desktop is compositionally distinct, not enlarged mobile.** Same components, tokens, state
  and actions; different arrangement at the breakpoint. No duplicated desktop page trees.
- **Avoid whole-page phone-width caps.** Constrain width per section/component (readable text,
  480px forms, 1200px content) instead of forcing a page into a phone column. A narrow page
  needs a stated reason.
- **Breakpoints:** < 768 mobile (unchanged); 768–1023 tablet; ≥ 1024 desktop composition;
  ≥ 1280 wide refinements (e.g. five shot slots in one row).
- **Guest stays mobile-first but gets a deliberate browser layout** (`GuestShell`):
  - `split` (every join/status/capture screen): 768–1023 a 600px sheet; ≥ 1024 a sticky
    full-height event story panel (5/12: top bar, frame motif, Fraunces 48 title, optional
    desktop-only `panel`) beside a white action region with content vertically centered —
    480px column for forms/status, 760px (`width="wide"`) for Your Five and Completion. Desktop
    has no thumb zone, so `SheetActions` stays with the content and keeps a button-sized width.
  - `wide` (revealed gallery): from 768 a full-width header band and a 1200px content column;
    grid 3 → 4 (tablet) → 5 (desktop) columns so tiles stay inspectable (~230px).
  - The story panel's five-frame motif (`components/ff/frame-motif.tsx`, shared with the auth
    brand panel) fills with the guest's own kept shots — or demo previews — decoratively.
  - Your Five: five slots in one row ≥ 1280, 4:5 slots on tablet. Completion: kept shots become
    photo cards (grid) instead of 56px list rows.
  - Preview + Message ≥ 1024: full-height photo region with the sheet docked right ("Keep this
    one?"). Photo viewer ≥ 1024: photo stage + 380px side panel (counter, attribution where
    allowed, message, keyboard hint, actions).
- **`/demo`** uses the split shell: product context (how it maps to a real event, links to How
  it works/Pricing — frosted, never a second violet primary) in the story panel, the interactive
  demo in the action region. Still entirely client-side (D14).
- **Marketing, auth, host and Operator** already use full desktop templates (1200 content, auth
  split, host D-series, operator host-desktop template); keep them that way.

## Marketing motion (2026-09-30)

The public marketing site may treat photographs as tactile, physical objects: printed photos with a
white paper border, layered shadow and a faint light falloff (`PhotoPrint`), resting at slight,
independent tilts. Photos still look like photos: no glossy 3D materials, and crops use
`object-position`, never distortion. Until approved event photography exists, the prints use the
illustrated sample scenes (`lib/marketing/sample-scenes.ts`), never stock imagery.

- **Signature moment: the hero's five prints** (`components/ff/marketing/hero-prints.tsx`, layout
  data in `lib/marketing/hero-prints.ts`). One guest's five kept frames, numbered 1–5, mixed
  orientation, laid on a shallow surface. The same five scenes reappear in the "Why five" card
  and the guest-journey mockups. Always exactly five.
- **Motion is restrained and meaning-driven.** Slow, weighted ease-out (`--ease-settle`), no
  overshoot, no perpetual loops, no autoplay spectacle; the page is still once the visitor stops.
  Allowed: a one-time entrance (prints settling onto the surface), shallow depth parallax on a
  real mouse at ≥1024 (a few px, the same amplitude at every desktop width), a slight gather as
  the hero scrolls away, a small hover lift, and one-time reveals on a few chosen blocks
  (`Reveal`). Most sections stay plain HTML/CSS.
- **CSS and lightweight motion first.** Transforms, perspective, shadows and a small rAF loop
  that runs only while values settle (`hooks/use-print-parallax.ts`). No motion library.
- **WebGL/Three.js is reserved for an isolated signature marketing moment** that CSS can't achieve,
  lazy-loaded, with a static fallback. It's not used today (the hero is CSS) and never belongs in
  guest, host, gallery, checkout, auth or Operator screens.
- **Every motion has a complete static alternative.** The server renders the finished
  composition (nothing shifts when motion starts; no-JS visitors see it complete).
  `prefers-reduced-motion: reduce` turns off entrances, parallax, tilt, hover lift and reveals
  entirely rather than speeding them up. Resting tilt is composition, not motion, so it stays.
  Tablet and mobile get a simple row of five prints with a CSS entrance and nothing continuous.
- **Decorative only.** Motion layers are `aria-hidden`, never focusable, never carry information
  that isn't in the copy, and never overlap CTAs.

## Brand identity (2026-09-30)

The logo replaces the handoff's text-only wordmark (DS04) and the old two-tilted-frames app icon.
The identity board, with its rationale and ownability tests, and SVG exports for design tools and
print are in `docs/design-handoff/FiveFrames_Identity_v1.0/`. In code, the geometry lives only in
`lib/brand/logo.ts`; the exports are copies of it, never read by the app.

- **Symbol:** four frames (two landscape, two portrait) turn around a fifth, square frame and
  tile one square. No four corners meet. It is always drawn from `SYMBOL_FRAMES`; at 16–32px use
  the hand-snapped `FAVICON_FRAMES` (`<BrandMark pixel />`), never a scaled-down symbol.
- **Wordmark:** Plus Jakarta Sans 800 as outlines, tracked tight, with a square dot on the i. It
  is never typed as live text, so it needs no font and renders the same in the app, `next/og`
  images and printed signage.
- **Colour lives in the centre** (the fifth frame and the i's dot): ink + violet on light
  surfaces (`onLight`), white + highlight violet on ink, night surfaces and photos (`onDark`),
  solid white on violet (`onViolet`). No other colourways, no gradients, no outlines.
- **Where it appears:** every header via `Wordmark`, the marketing mockups, the Open Graph image,
  the border of every keepsake (the Signature Full Set carries the wordmark alone, because its photos already draw the symbol), the top of all four signage
  formats, and the app icons. It is never themed: the event accent never replaces its violet
  centre.
- **Open items:** the wordmark is a modified public typeface; a type designer should redraw it
  before any trademark filing, and no trademark clearance search has been done.

## Event Theme & Keepsakes (approved 2026-09-30)

The design target for Slices 15–17. The board, `docs/design-handoff/FiveFrames_Theme_Keepsakes_v1.0/`,
shows every surface and state. This section records the rules. Behavior is product.md §10/§11.3,
D19 and architecture §7a–§7c. Nothing here changes it.

**Principle:** the host gives the event its identity once (image, color, hashtag), and FiveFrames
carries it everywhere. Nobody edits a layout. The default event (violet, no image, no hashtag) is
a first-class state: no surface shows an empty slot, placeholder image or blank hashtag area.

### References (2026-09-30, inspiration only; no assets or identities reused)

- **Primary: Korean self-photo-studio prints** (Life4Cuts / Photoism style; e.g.
  https://creatrip.com/en/blog/13797 and https://dribbble.com/search/photobooth). Photo-first,
  thin even borders, a tiny brand and date foot. Used for the keepsake family's physical-print
  language and restraint.
- **Spotify Wrapped share cards** (https://newsroom.spotify.com/2025-12-03/2025-wrapped-user-experience/):
  one data set, several cards, a fixed brand-foot position, and a choose-then-share flow. Used for
  the picker and family consistency. The lesson we go past it on: our five differ in
  *composition*, not just colorway.
- **Modern QR welcome/seating signs** (e.g. https://www.etsy.com/market/qr_code_seating_chart_signage):
  a distance hierarchy of headline → calm white QR panel → one instruction. Used for the signage
  family.
- Rejected as anti-references: ornamental/clip-art photobooth strips, and theme panels with free
  color pickers and per-element controls.

### Curated event colors (`lib/theme/` registry)

Seven keys, no custom picker in MVP (closes the product.md §19 design question). Each key has
fixed, pre-verified roles. The host sees only swatch + label.

| Key · label | base | fill / fill text | ink (text on white) | onDark | tint |
|---|---|---|---|---|---|
| `violet` · Violet (default) | #6B2BD9 | #6B2BD9 / white | #6B2BD9 | #B58CFF | #F3EDFE |
| `coral` · Coral | #E8604C | #C8432F / white | #B83D2A | #FF9A88 | #FDEEEB |
| `rose` · Rose | #D93A7E | #C02A6C / white | #B02664 | #FF8DBE | #FCEBF3 |
| `marigold` · Marigold | #E9A23B | #E9A23B / **ink** | #8F5A00 | #F5BE6A | #FDF3E3 |
| `teal` · Teal | #12937A | #0E7A66 / white | #0B6E5C | #5FD4B8 | #E6F5F1 |
| `ocean` · Ocean | #2D6FE0 | #2563D4 / white | #1F5AC4 | #8DB4FF | #EAF1FD |
| `midnight` · Midnight | #26304F | #26304F / white | #26304F | #AEB9DA | #EEF0F5 |

Every pairing clears WCAG AA (fill/text ≥ 4.88, ink/white ≥ 5.62, ink/tint ≥ 4.98, onDark/night
≥ 7.16). The unit test asserts these. `base` is used only for decoration (swatches, glows, accent
squares, signage brackets and bands), never for text.

**Token mapping on themed guest screens (Slice 15):** `--brand-primary` ← fill, a new
`--brand-foreground` ← fill text (buttons stop assuming white), a new `--brand-ink` ← ink (for
accent *text*: guest `text-brand` usages move to it, because marigold fill on white is 2.2:1),
`--brand-tint` ← tint, `--brand-highlight` ← onDark. Scope: the guest shell only. The
`live`/`success`/`danger` status colors, host chrome, auth, marketing, the Operator Console, the
FiveFrames logo and the QR plate are never themed.

### Guest screens

- **Header / story panel with a theme image:** the image, cover-cropped at `50% 35%` (biased to
  the upper third, where faces are), under a legibility gradient (night at 25% → 15% → 86%,
  top → bottom). Same on the desktop story panel. **Without one:** night + a glow in the event
  base color (today's no-cover treatment, recolored).
- The hashtag, when set, sits after the date in the header meta line in `onDark`. When absent it
  takes no space.
- Accent: the primary action, the next shot slot (fill border + tint), "N of 5" numerals (ink).
  The capture/camera, preview-before-commit and photo viewer surfaces stay full-bleed dark and
  unthemed around the photo. Only their buttons take the accent.

### Host · Look studio (Create → Look and Settings → Look)

- **Composition ≥ 1024:** a controls column (440 at ≥ 1280, 380 below) and a sticky preview stage
  filling the rest. The stage is a white card holding a segmented control (**Overview · Guest
  screens · Keepsakes · Signage**) above a soft `#F0EFF4` "table" surface. **Overview** is the
  host's moment: the guest join screen (phone), a Print keepsake and a table card, laid out as
  objects. Every change updates all three. The Keepsakes tab shows one large style plus a list of
  all five and a Portrait/Landscape sample toggle, labelled "guests start here" on Print. The
  Signage tab has a format switcher and one large format with its print size and use note.
- **768–1023:** one column. A two-column control form, then the preview with the same tabs.
- **< 768:** dark wizard header → controls → a "See it everywhere" preview section (Guest ·
  Keepsakes · Signage) with one large swipeable preview. Continue stays pinned. An inline accent
  sample (a guest button + hashtag chip on the tint) sits under the swatches in every layout. It
  is the only immediate feedback on mobile.
- **Controls, in order:** Theme image · Event color · Hashtag · Welcome message ("isn't printed on
  keepsakes or signage") · Guest keepsakes toggle (the existing `sharing_enabled`, moved here
  because this is where its effect shows. When off, the Keepsakes tab dims with "Guests won't see
  these until you turn them on").
- **Create → Look is only the look:** reveal timing and gallery visibility move to Create →
  Details as an "After the party" card. They are the same fields with the same defaults, and the
  wizard still has three steps. Continue with nothing set = the default event. The kicker reads
  "Step 2 of 3 · optional".
- **Settings** splits into **Event & gallery · Look · Links** sub-sections, each its own form with
  the existing unsaved-changes guard (the amber dot, Discard / Save changes, `beforeunload`, and
  asking before switching sub-section). In Look, the unsaved card sits under the stage with:
  "Applies to guest screens, keepsakes and signage from now on. Signage you've printed keeps
  working." The host event cover (260 header) uses the theme image when set.
- **Two save models, stated plainly:** the theme image saves the moment its upload commits
  (architecture §7a) and its tile says "Saved". Remove asks through the native `<dialog>`.
  Everything else waits for Save changes (Settings) or Continue (Create).

**Theme image control states:** *empty* (a dashed tile, "Add a theme image", format hint, and
the public-facing notice "Anyone with your event link or signage can see it — it isn't part of
your private gallery"), *uploading* (local preview + % bar), *processing* ("Getting it ready…"),
*ready* ("Saved" chip, Replace / Remove), *ready but small* (< 1600px long edge: amber "may print
a little soft on the poster"), *unsupported* and *failed* (danger text that always says "Your
current image is unchanged", plus Try again for failed). There is no crop or position control:
FiveFrames crops per surface.

**Hashtag:** a fixed "#" prefix inside the field (a typed one is stripped), a counter to 30,
helper "Printed on keepsakes and signage. Leave it empty and nothing takes its place." When
invalid: danger border + "Hashtags can't have spaces. Letters, numbers and _ only."

**Color:** a radiogroup of 44px swatches. Selected = a check (ink on marigold) plus an inset ring,
and the label beside it names the color, so selection is never shown by color alone.

### The five keepsake styles (`lib/keepsakes/`)

These are the **Single-photo** family (product.md §10.2.1). The Full Set family is separate (see
"Full Set keepsakes" below). In the guest picker it is the second segment of one family switch,
never more thumbnails in this row.

Canvas **1080 × 1350 (4:5)** for all five. Order and ids: `print` (preselected), `booth`,
`poster`, `journal`, `album`.

| Style | Composition | Theme image use | Message |
|---|---|---|---|
| **Print** (default) | The FiveFrames printed photo: white paper, the photo contained with 64px margins, and a caption lip: message → Fraunces event name → accent square + date + hashtag, with the lockup at the right of that row | none | yes (2 lines) |
| **Booth** | The whole canvas in the accent fill. A letter-spaced date stamp (`18.10.2026`) and hashtag across the top, the photo in a 16px white keyline, the Fraunces name at the foot | none (the color is the theme) | never |
| **Poster** | A 560px field across the top (theme image, or night + accent glow) with the Fraunces name at 84 and meta over it. The photo is a white-bordered print overlapping the field edge, on white below | background field | yes, centered under the photo |
| **Journal** | Editorial: a masthead (112px theme motif plate + name + meta), a 3px ink rule, the photo. Portrait photos get a side column with the message as a Fraunces pull-quote, or with none, the day as a large accent numeral. Landscape anchors that block at the foot | cropped motif plate (omitted when absent) | yes (pull-quote, 3–8 lines) |
| **Album** | A white-bordered print at −2.5° on the accent tint, and a label card at +1.6° holding message / name / date | derived texture: cover at 12% under the tint | yes (on the label) |

Rules for all five:

- **The photo is contained, never cropped by a style.** Each window sizes itself to the photo's
  own ratio (portrait, square, landscape, 16:9, 3:4 all shown). The theme image never overlaps
  the photo.
- Text steps down by length, then clamps: name 2 lines, message 2 (8 in Journal's side column).
  Minimum type on canvas is 24px. A missing hashtag or message collapses its space.
- **Brandmark:** the horizontal lockup at 30px tall, on the border or field only. It sits in the
  caption row (Print) or bottom-right (the other four). Tones: `onLight` on white/tint, one-colour
  white on accent/night fields, one-colour ink on marigold. No slogan, URL or call to action.
- **Satori subset only:** flex/absolute boxes, radius, box-shadow, linear/radial gradients,
  object-fit/position, opacity, 2D rotate. Fonts: the bundled Fraunces 600 and Jakarta
  500/600/700/800 (no italics needed). DOM previews use the same component (D19).

### Guest keepsake flow

- **Entry points** (own view only): the share button on each completion / "Your photos" row, and
  the own-photo viewer. The viewer shows two labelled groups: **Keepsake** → Share (accent) · Save
  keepsake, and **Original photo** "Exactly as you took it" → Download. Keepsakes never appear in
  capture, preview-before-commit, Your Five slots, or anyone's gallery view.
- **Picker (mobile):** one screen titled "Make a keepsake", with the subtitle "A new image made
  from your photo. Your original stays exactly as you took it." It has a large stage, all five
  styles in one row of real thumbnails with names (fits at 360px), and Share + Save at the bottom.
  Print is preselected. Swiping the stage is a shortcut.
- **Bytes before the tap (D19):** on open and on every selection, fetch that style's JPEG. Share
  shows "Getting it ready…" (tint + progress) until the bytes are held, then enables. Save is
  always available (`?download=1` navigation).
- **States:** *share cancelled* → back to ready with **no message**. *Couldn't prepare* → a calm
  note on the subtle surface ("We couldn't get this keepsake ready. Your photo is safe…") and Try
  again replaces Share. *No share sheet* (in-app browsers) → Share hidden, Save keepsake is the
  primary, with a one-line explanation. *Saved* → "Saved. Look in your downloads or Photos."
- **Desktop ≥ 1024:** the photo viewer's pattern. A subtle stage with the keepsake as large as
  fits, and a 400px panel with the five styles as a labelled list (thumb + name + one-line
  description), Share / Save, and the Original photo row. Not host software.
- **Sharing off:** no keepsake group, hint, row buttons or disabled style controls. The viewer
  shows only "Download original".
- **Motion:** on open the photo settles into the preselected style (240ms `--ease-settle`), and
  style changes cross-fade in 160ms. Under reduced motion both are instant.

### Full Set keepsakes (approved 2026-09-30)

These are the second keepsake family: five styles, each made from all five of a guest's committed
photos. The board is sections 11–17 of `FiveFrames_Theme_Keepsakes_v1.0/`.

- Behavior: product.md §10.2.2 and criteria 54–66.
- Architecture: D20 and architecture §7b. This section changes neither.
- The Single-photo styles above are unchanged.

#### The five styles (`lib/keepsakes/`, `family: "fullSet"`)

Canvas **`FULL_SET_CANVAS` = 1200 × 1800 (2:3, 2.16 MP)** for all five. Why 2:3:

- It is exactly a 4 × 6 in print at 300 ppi, the standard photo and photobooth sheet.
- Five photos each get real area on a phone screen.
- It shows whole in messaging apps, Stories and the camera roll.
- Tradeoff: Instagram's feed crops anything taller than 4:5.

Order and ids: `signature` (**preselected**), `strip`, `grid`, `spotlight`, `prints`.

| Style · picker line | Composition (why it exists) | Theme image | Maker's mark |
|---|---|---|---|
| **Signature** · "The FiveFrames shape, made of your five" | The brandmark's construction made of photographs (below). The one composition only FiveFrames can own | A 128 px circular **seal** beside the name. Absent without an image | **Wordmark only**, 28 px, onLight, right of the caption row |
| **Strip** · "A photobooth strip on your event" | The booth ritual: a white paper strip of five 384 × 278 frames, top to bottom, laid on the event, with the name set large beside it | **Full-bleed ground** under night (0.62 → 0.42 → 0.9). Without an image, the ground is the accent fill | Lockup on the strip's own foot, onLight |
| **Grid** · "All five, side by side" | Equal weight: a 2 × 3 sheet of near-square cells, the sixth being an accent **end card** (name, date, hashtag). The most forgiving crop | **Not used**. The end card is the color | Lockup on the end card: white, or ink on marigold |
| **Spotlight** · "Your first photo leads, four follow" | Hierarchy: photo 1 as a 1072 px square, photos 2–5 as a 4:5 filmstrip, and an identity band at the foot | **Soft crop behind the name** in the 264 px foot band, under a night wash. Without an image: night + accent glow | Lockup in the band, one-colour white |
| **Prints** · "Five prints on your event's colour" | Objecthood: five instant-style prints with square 404 px windows, at −3° … +2.4°, on the accent tint | **Faint texture** in the surface (12%, then a 55% tint wash) | Lockup bottom-right on the tint, onLight |

**Names:** short, warm words a guest understands in a five-thumbnail row.

- **Signature** marks the house style without design jargon. "Five" repeats the family label,
  "Mark" and "Form" are designer words, and "Studio" says nothing.
- "Grid", not "Gallery": the gallery is a different product surface.
- "Spotlight", not "Hero" or "Feature".

**Default: Signature.** It is the most ownable composition, and in every pressure-test set it stays
credible: faces survive, and the failures are side crops, not lost heads. **Grid** is the
robustness benchmark (no photo loses more than 27%). If pilot feedback on crops is poor, Grid is
the fallback default, and that is a one-constant change.

#### Signature geometry (derived from `SYMBOL_FRAMES`)

Slot *n* is `SYMBOL_FRAMES[n]`: landscape top, portrait right, landscape bottom, portrait left,
then the closing square. They turn clockwise, and no four corners meet.

| # | Slot | x, y | w × h | ratio |
|---|---|---|---|---|
| 1 | Landscape · top | 72, 72 | 672 × 448 | 3 : 2 |
| 2 | Portrait · right | 768, 72 | 360 × 760 | 36 : 76 |
| 3 | Landscape · bottom | 456, 856 | 672 × 448 | 3 : 2 |
| 4 | Portrait · left | 72, 544 | 360 × 760 | 36 : 76 |
| 5 | Square · closing | 456, 544 | 288 × 288 | 1 : 1 |

The form is 1056 × 1232 at (72, 72), with a gutter of 24.

- **Refinements of the literal mark:**
  - The portrait arms keep the mark's exact 36:76.
  - The landscape arms open from 2.11:1 to 3:2. Phone photos are mostly portrait, and those arms
    receive them, so a 3:4 photo keeps 50% of its height instead of 35%.
  - The gutter narrows from 8/120 to 24 px, and the radius drops to 4 px.
  - The form becomes 6:7, which leaves the 2:3 canvas a caption row instead of an empty third.
  - A square translation with thin gutters (arms 1.84:1, 41% kept) was also rejected (board §12).
- **Color lives in the centre:** slot 5 sits on a 10 px mat in the accent *base*, inside its
  gutter, with 14 px of paper left to its neighbours. Otherwise the style's only accents are the
  date square and the hashtag ink.
- **Caption row** (vertically centred in the 496 px below the form): optional seal, then the
  Fraunces name (80 → 66 → 56 → 48 by length, 2 lines), then the accent square + date + hashtag
  (Jakarta 30), with the wordmark on the same centre line.
- **Test:** the same kind of geometry test as `logo.test.ts`:
  - the slots tile the form with 24 px gutters;
  - slots 1 and 3 are 3:2, and slots 2 and 4 are 36:76;
  - slot 5 is square and sits between slots 1–4;
  - no point is a corner of four slots.

#### Slot rectangles for the other four (canvas px, commit order)

- **Strip:** x 126; y 126 + i·296; 384 × 278. The strip paper is 444 × 1608 at (96, 96), and the
  lockup sits in its 118 px foot.
- **Grid:** 526 × 544 cells at (64, 64), (610, 64), (64, 628), (610, 628), (64, 1192). The end
  card is at (610, 1192).
- **Spotlight:** slot 1 is (64, 64, 1072 × 1072). Slots 2–5 are 253 × 316 at y 1156, with x at
  64 / 337 / 610 / 883. The band runs from y 1536 to the bottom.
- **Prints:** 404 × 404 windows at (116, 110), (674, 174), (142, 690), (652, 754), (128, 1260).
  Each print (452 × 514, a 24 px border and an 86 px lip) is rotated −3°, 2.4°, 1.8°, −2.2°, −1.4°
  about its own centre.
  - The declared slot is the unrotated window, so D20's in-bounds, non-overlapping test applies
    as written.
  - Rotation is template composition, as with the accepted Album style.
  - No print overlaps another's window.

#### Mixed orientation and crops

- **One focus constant for the family: `object-position: 50% 30%`.** It is centred across, and
  30% from the top when height is trimmed. That is architecture's rule ("centred, top-biased
  when a taller photo fills a wider slot") written as one value, and it is identical in the
  server pre-crop (`coverCrop`) and the DOM preview. No per-photo or content-aware focus.
- **Slot range:** 1 : 2.11 (only Signature's portrait arms) to 3 : 2. There are no other extreme
  slots.
- **Worst case kept** (trimmed dimension) for portrait 3:4 / landscape 4:3 / 9:16 / 16:9:

  | Style | 3:4 | 4:3 | 9:16 | 16:9 |
  |---|---|---|---|---|
  | Signature | 50 | 36 | 38 | 27 |
  | Strip | 54 | 97 | 41 | 78 |
  | Grid | 78 | 73 | 58 | 54 |
  | Spotlight | 75 | 60 | 56 | 45 |
  | Prints | 75 | 75 | 56 | 56 |

  (Percentages.) Board §14 renders all five styles against six sets: 5 portrait, 5 landscape,
  3P + 2L, 2P + 3L, square-ish, and awkward subjects.
- **Accepted limitation:** a subject in the bottom quarter of a portrait photo is cut off in a
  wide slot (Signature 1, Strip 1). Only content analysis could fix that, and D20 excludes it.
  There is no crop control either (product.md §10.5).

#### Rules for all five

- **Nothing is drawn inside a slot.** Slot radius is 2–4 px. The theme image is never a
  capture-sized rectangle: it is a seal, a ground, a band behind type, a texture, or absent.
- **Text:**
  - The name is the only Fraunces. It steps down by length, then clamps (2–4 lines by style).
  - The date and hashtag are Jakarta. A missing date or hashtag collapses its space, and a long
    hashtag ellipsizes.
  - Minimum type on the canvas is 27 px.
  - There is no message, display name, welcome message, per-photo data, count, QR or URL.
- **Every theme state looks finished:** fully themed, accent only, and default violet with
  nothing set (board §13, including a 46-character name and a 27-character hashtag).
- **Satori subset**, as for the Single-photo styles. Check parity for `lineClamp` and for the
  Spotlight band's radial glow in Slice 16. If the glow drifts, a linear gradient is an
  acceptable fallback.

#### Guest experience

- **Availability** comes from the server flag (`getFullSetSources` + sharing on). While it is
  false, the Full Set is **absent**: no card, no family switch, no disabled segment, no teaser,
  no progress. That applies with fewer than five photos, with a photo hidden, and permanently
  after a deletion.
- **Completion and "Your photos" (own view):** one tint card between the photo list and
  *Download my photos*. The card has a small tilted Signature thumbnail, the title **Your five,
  together**, the line "All five photos in one keepsake." and an on-tint button, **See them
  together**. *Download my photos* stays the one accent primary. The same card appears in the
  desktop split shell's action region.
- **Picker IA:**
  - The picker ("Make a keepsake") gains a two-segment switch above the stage, **One photo ·
    Your five**, only while the Full Set is available.
  - Each family shows only its own five thumbnails and preselects its own default (Print ·
    Signature). Ten styles never appear together.
  - It opens on **One photo** from a photo, and on **Your five** from the card.
  - Switching family keeps the picker open and prepares the new family's preselected style.
  - At 390, the 2:3 stage is about 262 × 393 and the thumbnails are 58 × 87.
- **Your five subtitle:** "One new image made from your five photos. Your originals stay exactly
  as you took them."
- **States:** exactly the Single-photo model.
  - Preparing ("Getting it ready…" for the selected style only).
  - Ready (Share inside the gesture), and Save (always, `?download=1`).
  - Style switch: aborts the previous fetch, 160 ms cross-fade.
  - Share cancelled: silent.
  - Couldn't prepare: calm note, and Try again replaces Share.
  - No share sheet: Save keepsake becomes the primary.
  - Saved: one line.
  - The filename is `fiveframes-{event}-{style}.jpg`.
- **Became unavailable while open:** if a prepare returns not-found, the switch disappears.
  - From a photo, the picker falls back to One photo, with one neutral line: "Your five together
    isn't available right now."
  - From the card, it returns to the completion screen, where the card is now gone.
  - Moderation is never explained.
- **Desktop ≥ 1024:** the accepted photo-viewer pattern.
  - A subtle stage with the keepsake at viewport height − 120 (about 504 × 756 at 1440, and
    about 420 × 630 at 1024).
  - A 400 / 380 panel containing: the family switch, the subtitle, the five styles as a
    labelled list (thumb, name, line, "· default", tint + ring + check when selected), Share /
    Save, and the originals row "Original photos · Exactly as you took them · Download".
- **Copy never says** unlock, complete(d), 5/5, reward, challenge, "Full Set" (an internal and
  host term), or "frames" for styles.

#### Host Look studio

- **Overview (≥ 1280):** the Keepsakes object becomes a pair: a Signature Full Set with the Print
  keepsake laid over its corner. Below 1280 it stays the single Print, as accepted.
- **Keepsakes tab:**
  - A family switch, **One photo · All five** (hosts' words; guests see "Your five"). It
    defaults to One photo.
  - "All five" shows one large style and the list of five, with "guests start here" on Signature.
  - Each row carries Image / Color / Hashtag chips, struck through where the style doesn't use
    that part (Grid: no image).
  - The note under the list reads: "Guests who keep all five photos can also make one keepsake
    of all five. You preview the styles here; only guests make their own."
  - There is no Portrait/Landscape toggle for All five, because the samples already mix
    orientations.
- **Mobile Look:** two chips under the Keepsakes tab pick the family. It shows one large
  swipeable preview.
- **Samples:** five bundled illustrated photos in the order portrait, portrait, landscape,
  portrait, square. Slot 1 of Signature and of Strip therefore always shows real portrait-in-
  landscape cropping.
- **Sharing off** dims both families with the existing line. **Draft** previews are allowed.
  There is no download or "make" action on the host side.
- **Demo:** unchanged. The accepted board has no `/demo` keepsake surface. If one is added,
  D14 and D20 already allow DOM previews of either family on sample photos, with no route calls.

#### References (inspiration only)

The FiveFrames brandmark construction is the primary reference. Besides it:

- **Photobooth strips and 4 × 6 booth sheets** (the Korean self-photo-studio prints already
  cited above): the canvas ratio, and Strip's paper-on-event object.
- **Photographers' contact sheets:** Grid's equal weight and end card.
- **Instant-print layouts, and the marketing hero's five prints**
  (`components/ff/marketing/hero-prints.tsx`): Prints.

No branded template is copied. The references are not wedding-specific.

### Signage (`lib/media/signage.ts`)

One system in four compositions: an **identity field** (theme image, or night + accent glow,
carrying the lockup, the Fraunces name, date and hashtag), a **white scan side** (the QR plate,
"Scan. You have five frames.", "No app. No account."), and a thin **accent band**.

| Format | Canvas | Layout | QR |
|---|---|---|---|
| QR | 600 × 720 | All white. Lockup + hashtag top, name, plate, copy, 16-unit band. No theme image | 336 |
| Table card | 700 × 500 (7 × 5 in) | 280-unit field left, scan side right | 212 (≈ 5.4 cm) |
| Poster | 1200 × 1800 (2:3, 24 × 36 in) | 780-unit field on top, then plate + Jakarta 800 instruction at 56 | 540 (≈ 27 cm) |
| Digital | 1920 × 1080 (16:9) | 1040-unit field left with the name at up to 120, scan side right. For TVs, projectors and tablets, not a scaled poster | 520 |

- **The QR plate is never themed:** ink modules on white. Padding = 4 modules at every size.
  Nothing inside the plate. Accent brackets sit **outside** it (a gap of at least 9 units). The
  plate always rests on white, never on the theme image. *Today's renderer draws its brackets
  inside the plate padding and pads with fewer than 4 modules. Slice 17 fixes both.*
- The theme image only ever fills the field under the night gradient (0.15–0.25 → 0.92), cropped
  `xMidYMid slice` biased to the upper third. A low-quality image degrades to a soft background;
  it is never behind the QR or instruction.
- Long names step down (e.g. poster 108 → 92 → 76 → 64) and wrap to 2 lines (QR, poster) or 3
  (table card, digital), with an ellipsis last. A hashtag that doesn't fit beside the date drops
  to its own line.
- Physical output: poster content inside a 6% inset (survives A-series trimming), table card
  0.125 in bleed on the field edge, digital within a 5% title-safe inset.
- **Draft preview QR:** the same footprint, filled with a pale dot field (no finder patterns, so
  it isn't decodable and doesn't look like a code) and a centered label, **PREVIEW / Not a working
  code**. The stage shows a "Draft preview" badge where Download will be, plus "The code here is a
  placeholder. Your real QR and downloads arrive when you activate." **Activated:** the real QR
  and a dark Download button per format (the existing route).
- Create · Share ("You're all set") keeps its QR + link hand-off and points to the Look → Signage
  tab. It drops the "poster and phone-screen version are on your dashboard" line.

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
3. ~~Cover image and theme color~~ — **resolved by product change (2026-09-30).** They are now
   product capabilities (product.md §10.1: theme image, curated accent, hashtag), designed in
   "Event Theme & Keepsakes" (the handoff's six swatches + "+" become seven curated keys with no
   custom color). Built in Slice 15.
4. ~~Guest preview before payment~~ — **resolved by product change (2026-09-30).** Host-only
   theme previews (guest screens, keepsake styles, signage with a placeholder QR) are now allowed
   in Draft (product.md §7.2). There is still no reachable guest experience before payment. In
   the design, the Look studio's preview stage replaces the wizard's "What happens next" column
   on the Look step and the Settings-only 380 phone preview. Built that way in Slice 15.
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
- **Branded share card**: retired in Slice 16. The keepsake styles replaced it ("Event Theme &
  Keepsakes"), and Print takes its role as the calm default.
- **Signage SVGs** (`lib/media/signage.ts`) use the tokens and fonts, but the current layout (one
  composition at four sizes, brackets inside the plate padding) is superseded by the themed
  signage design. The landing page (`app/page.tsx`) uses the tokens and fonts.
- **Not in the repo:** Supabase Auth email templates (confirmation, password reset) are set in the
  Supabase dashboard and still use Supabase's defaults.

## Avoid

- Reintroducing the retired warm palette, Bricolage Grotesque, or per-scope token families.
- Raw hex/palette values in components; generic shadcn/SaaS composition on product screens.
- A second violet primary on a screen; Fraunces on buttons, forms or numbers.
- Stretching a mobile layout to desktop, or centering a phone column in a desktop browser.
- A desktop guest experience that reads as host software (dashboards, toolbars of host actions).
- Decorative/fake numbers, countdowns not backed by the lifecycle, or engagement copy.
- Building a handoff control whose behavior the product doesn't have — log it above instead.
- For themes: a free color picker, per-element or per-surface theme controls, crop/position
  editors, stickers or clip-art, calling keepsake styles "frames", tying the five styles to the
  five-photo allowance, anything themed inside or under a QR plate, and a keepsake that crops the
  guest's photo or puts the brandmark on it.
- For Full Sets:
  - any locked, greyed, teaser or progress state before five;
  - a Full Set built from four photos or with a gap filled;
  - a theme image the size or shape of a capture;
  - a per-photo or content-aware crop focus;
  - "unlock", "complete" or "5/5" copy;
  - showing all ten styles in one list.
