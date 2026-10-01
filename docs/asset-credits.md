# Asset credits

Third-party images shipped in this repository, with the source and the license terms checked at
download. Code reads them through `lib/marketing/photos.ts`. `lib/marketing/photos.test.ts` fails
if a registry photo has no row here or no file on disk.

## Marketing photography (`public/marketing/photos/`)

Stock stand-ins for the public marketing site until real FiveFrames pilot-event photos can be
used with permission. Each was downloaded on **2026-10-01** from Unsplash's own image CDN. Each
photo page said "Free to use under the Unsplash License", and none is an Unsplash+ (paid) image.
Brand and sponsor accounts were avoided.

**License: [Unsplash License](https://unsplash.com/license)**, checked 2026-10-01:

- free for commercial and non-commercial use;
- may be copied, modified and distributed;
- no permission or attribution required;
- not allowed: selling the photos without significant modification, or compiling them to build
  a similar or competing service.

The site shows no public credits. Attribution isn't required, and it is recorded here instead.

The photos show real people, so they are used only as illustrations of an occasion. Nothing on
the site may present a pictured person as a FiveFrames customer, guest, host or reviewer, or
pair them with a quote.

Each photo ships as `<file>-480.webp` and `<file>-960.webp`, made by
`scripts/prepare-marketing-photos.ts`: resized, WebP quality 72, all metadata stripped.

| File | Used for | Unsplash photo | Photographer |
|---|---|---|---|
| `guest-friends-laughing` | Guest's five · 1 | [e3OUQGT9bWU](https://unsplash.com/photos/e3OUQGT9bWU) | Helena Lopes |
| `guest-birthday-candles` | Guest's five · 2 | [d8s13D29QiE](https://unsplash.com/photos/d8s13D29QiE) | Aneta Pawlik |
| `guest-toast-string-lights` | Guest's five · 3 | [ULHxWq8reao](https://unsplash.com/photos/ULHxWq8reao) | Al Elmes |
| `guest-dancing-couple` | Guest's five · 4 | [fLjktqPB_94](https://unsplash.com/photos/fLjktqPB_94) | Abstral Official |
| `guest-string-lights` | Guest's five · 5 | [uzPuVqQPgv4](https://unsplash.com/photos/uzPuVqQPgv4) | Chelsey Marques |
| `guest-group-selfie` | Mockup gallery grids | [xijTRdsL6cQ](https://unsplash.com/photos/xijTRdsL6cQ) | Vitaly Gariev |
| `occasion-birthday-cake` | Occasions · Birthdays | [Z30Jpgmx2UY](https://unsplash.com/photos/Z30Jpgmx2UY) | Imants Kaziļuns |
| `occasion-party-dancing` | Occasions · Parties | [o1Bis9ykTss](https://unsplash.com/photos/o1Bis9ykTss) | Abhimanyu Jhingan |
| `occasion-family-gathering` | Occasions · Reunions | [UjRVfjWJQns](https://unsplash.com/photos/UjRVfjWJQns) | Olek Buzunov |
| `occasion-road-trip` | Occasions · Trips | [Y5F1JAbo6IU](https://unsplash.com/photos/Y5F1JAbo6IU) | Christian Lue |
| `occasion-team-lunch` | Occasions · Team events | [rL1u334QqTw](https://unsplash.com/photos/rL1u334QqTw) | Ryan Waring |
| `occasion-wedding-dancing` | Occasions · Weddings | [tQVSZ3FLjxc](https://unsplash.com/photos/tQVSZ3FLjxc) | Lori DeJong |
| `theme-lights-in-trees` | Sample theme image in homepage keepsakes | [Qbm6_n7c57I](https://unsplash.com/photos/Qbm6_n7c57I) | Patrick Hendry |

## Replacing with pilot-event photos

1. Get written permission from the host and the people pictured.
2. Name the files after the registry entries.
3. Run `pnpm tsx scripts/prepare-marketing-photos.ts <dir>`.
4. Update each entry's size and `focus` in `lib/marketing/photos.ts`.
5. Replace the rows above with the permission record.
