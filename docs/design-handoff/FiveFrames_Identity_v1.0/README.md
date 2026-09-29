# FiveFrames Identity v1.0 (2026-09-30)

The FiveFrames logo system: four frames (two landscape, two portrait) turn around a fifth, square
frame and together tile one square. Rationale, usage and open items are in
[docs/design-direction.md → "Brand identity"](../../design-direction.md).

| File | What it is |
|---|---|
| `FiveFrames_Identity_Board.png` | The identity board: nine application panels plus rationale and ownability tests. |
| `FiveFrames_Identity_Board.html` | The same board as a page. Open it in a browser (fonts load from Google Fonts). |
| `logo/symbol*.svg` | The symbol. `symbol` = ink + violet centre; `-ink`, `-violet`, `-white` = one colour; `-on-ink` = white + highlight centre. |
| `logo/wordmark*.svg` | The outlined wordmark: ink + violet dot, ink only, white only. |
| `logo/lockup-horizontal*.svg` | Symbol + wordmark, horizontal (primary): two-colour, ink, violet, white. |
| `logo/lockup-stacked*.svg` | Symbol over wordmark (compact, for signage and social). |
| `logo/favicon*.svg` | The 16px pixel-snapped drawing: adaptive (`favicon.svg`), ink, and violet tiles at 16 and 32. |
| `logo/app-icon*.svg` | App icon on a violet or ink tile. |

These files are exports for design tools, print and partners. The app does not read them: in
code, the logo is drawn from `lib/brand/logo.ts` and `components/ff/brand-mark.tsx`, and the
installed icons are `app/icon.svg`, `app/favicon.ico` and `app/apple-icon.png`. If the logo
changes, change it there first, then re-export these.
