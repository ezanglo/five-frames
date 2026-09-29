# FiveFrames Event Theme & Keepsakes v1.0 (2026-09-30)

The design target for roadmap Slices 15–17 (product.md §10 / §11.3, decision D19). The rules an
implementer needs are in [docs/design-direction.md → "Event Theme &
Keepsakes"](../../design-direction.md). This folder holds the rendered reference.

**Status:** designed, awaiting human visual approval. Nothing here is implemented.

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

How it was made: the keepsake styles are HTML written only in the CSS subset `next/og` (Satori)
supports, so each one is a direct spec for `lib/keepsakes/`. The signage is SVG built the same
way `lib/media/signage.ts` builds it. Logo geometry and sample scenes come from
`lib/brand/logo.ts` and `lib/marketing/sample-scenes.ts`, so there is no stock photography. The
sample QR encodes a text string, not a link. The generator scripts were scratch tooling and are
not kept; edit the HTML directly, or regenerate from the design-direction rules.
