# FiveFrames Event Theme & Keepsakes v1.0 (2026-09-30)

The design target for roadmap Slices 15–17 (product.md §10 / §11.3, decisions D19 and D20). The
rules an implementer needs are in [docs/design-direction.md → "Event Theme &
Keepsakes"](../../design-direction.md). This folder holds the rendered reference.

**Status:** approved by the user 2026-09-30 (sections 00–17). Slice 15 implements the theme foundation (Look studio, Settings → Look, themed guest screens); keepsakes (Slice 16) and themed signage (Slice 17) are not built yet.

- Sections 00–10 are the v1.0 design.
- Sections 11–17 are the **Full Set amendment** (2026-09-30): a second keepsake family of five
  styles, each made from all five of a guest's photos. It is added to the same board, and
  sections 00–10 are unchanged.

| File | What it is |
|---|---|
| `Theme_Keepsakes_Board.html` | The full board as one self-contained page (fonts from Google Fonts). Open it in a browser at ≥ 1760px wide. |
| `sections/00-moments.png` | The host's two outcomes: a themed event and a default event, across guest screen, keepsakes and signage. |
| `sections/01-accents.png` | The seven curated event colors and their contrast-safe roles (the `lib/theme/` registry target). |
| `sections/02-look-desktop.png` | Create → Look studio at 1440 (Overview), 1280 (Keepsakes, Signage/Draft), 1024 and 768. |
| `sections/03-look-mobile.png` | Create → Look at 390: controls, preview tabs, and the default event. |
| `sections/04-controls.png` | Theme image states, the remove confirm, color swatches and hashtag states. |
| `sections/05-settings.png` | Settings → Look at 1440 and 390, plus the presentation-only moves. |
| `sections/06-styles.png` | The five keepsake styles × theme image / default × portrait / landscape / square × message × long text. |
| `sections/07-guest-mobile.png` | Guest flow at 390: viewer → picker → preparing / ready / share sheet / cancel / failure / save-only / saved, sharing off. |
| `sections/08-guest-desktop.png` | Guest keepsake picker at 1440 and 1024. |
| `sections/09-signage.png` | The four themed signage formats (themed, default, Draft with long text), with the physical-output table. |
| `sections/10-draft.png` | Signage preview in Draft vs. activated. |
| `sections/11-fullset-family.png` | *Full Set.* The five styles side by side (Signature preselected), why each exists, and how the One photo and Your five families relate. |
| `sections/12-fullset-signature.png` | *Full Set.* Signature built from the brandmark: the mark, the rejected literal and square translations, the chosen geometry, and the slot table. |
| `sections/13-fullset-theme.png` | *Full Set.* All five styles × fully themed / accent only / default / long-text stress, plus the theme-image role of each style. |
| `sections/14-fullset-crops.png` | *Full Set.* Six mixed-orientation sets × five styles, and the worst-case crop table. |
| `sections/15-fullset-guest-mobile.png` | *Full Set.* Guest flow at 390: before five, completion card, hidden, picker with the family switch, and the preparing, ready, share, cancelled, failure, save-only, saved and unavailable states. |
| `sections/16-fullset-guest-desktop.png` | *Full Set.* Guest picker at 1440 / 1280 / 1024 and the desktop completion card. |
| `sections/17-fullset-host-look.png` | *Full Set.* Host Look: Overview pair, Keepsakes tab "All five", and mobile Look. |

How it was made: the keepsake styles are HTML written only in the CSS subset `next/og` (Satori)
supports, so each one is a direct spec for `lib/keepsakes/`.

- The Full Set sections draw their sample photos at true aspect ratios (3:4, 4:3, 1:1, 9:16,
  16:9), so the crops shown are the crops the renderer will make.
- Those sections store each repeated image once. A small inline script at the end of the page
  sets the `src` values, so the page still needs no network apart from Google Fonts.
- Text clamping on the board uses `-webkit-line-clamp`. In Satori, the equivalent is `lineClamp`. The signage is SVG built the same
way `lib/media/signage.ts` builds it. Logo geometry and sample scenes come from
`lib/brand/logo.ts` and `lib/marketing/sample-scenes.ts`, so there is no stock photography. The
sample QR encodes a text string, not a link. The generator scripts were scratch tooling and are
not kept; edit the HTML directly, or regenerate from the design-direction rules.
