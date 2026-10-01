import { SHOTS_PER_GUEST } from "@/components/ff/shots";

/**
 * Photographs on the public marketing site (docs/design-direction.md → "Marketing photography").
 * Freely licensed stock for now — sources and license checks are in docs/asset-credits.md — and
 * meant to be replaced by real FiveFrames pilot-event photos once there is permission to use them.
 *
 * Layouts never depend on a particular picture: they ask for "the guest's five", "an occasion" or
 * "the sample theme image", and every crop goes through the photo's own `focus`. Swapping a photo
 * means running scripts/prepare-marketing-photos.ts on the new file and editing its entry here.
 *
 * Files live in public/marketing/photos/ as `<file>-480.webp` and `<file>-960.webp`.
 */

export type MarketingPhoto = {
  /** Base file name in public/marketing/photos/. */
  file: string;
  /** Intrinsic size of the 960 file (its aspect ratio is the photo's). */
  width: number;
  height: number;
  /** object-position for every crop, so the subject stays in frame in any slot shape. */
  focus: string;
  /** For the places a photo carries meaning; decorative uses pass alt="" instead. */
  alt: string;
};

const DIR = "/marketing/photos";

export function photoSrc(photo: MarketingPhoto, width: 480 | 960 = 960): string {
  return `${DIR}/${photo.file}-${width}.webp`;
}

export function photoSrcSet(photo: MarketingPhoto): string {
  return `${photoSrc(photo, 480)} 480w, ${photoSrc(photo, 960)} 960w`;
}

/**
 * One guest's five kept frames, in commit order: the hero prints, the kept-frames row, the
 * guest-journey phone, the marketing rail and the homepage Full Set keepsake. Five different
 * kinds of moment from one evening — what five different guests' phones might each keep.
 */
export const GUEST_FIVE: readonly MarketingPhoto[] = [
  {
    file: "guest-friends-laughing",
    width: 960,
    height: 640,
    focus: "22% 45%",
    alt: "Friends laughing together outdoors in late-afternoon sun",
  },
  {
    file: "guest-birthday-candles",
    width: 960,
    height: 1450,
    focus: "50% 62%",
    alt: "Candles being lit on a birthday cake",
  },
  {
    file: "guest-toast-string-lights",
    width: 960,
    height: 640,
    focus: "60% 50%",
    alt: "Guests raising their glasses under string lights",
  },
  {
    file: "guest-dancing-couple",
    width: 960,
    height: 1440,
    focus: "50% 25%",
    alt: "Two friends laughing and dancing at a party",
  },
  {
    file: "guest-string-lights",
    width: 960,
    height: 720,
    focus: "45% 50%",
    alt: "String lights glowing over the venue at night",
  },
];

if (GUEST_FIVE.length !== SHOTS_PER_GUEST) {
  throw new Error("The marketing site shows exactly one guest's five frames.");
}

const GROUP_SELFIE: MarketingPhoto = {
  file: "guest-group-selfie",
  width: 960,
  height: 540,
  focus: "58% 50%",
  alt: "A group of friends taking a selfie outdoors",
};

/** One photo per occasion card on the homepage. */
export const OCCASION_PHOTOS = {
  birthdays: {
    file: "occasion-birthday-cake",
    width: 960,
    height: 639,
    focus: "50% 50%",
    alt: "A chocolate birthday cake with candles, held up outdoors",
  },
  parties: {
    file: "occasion-party-dancing",
    width: 960,
    height: 640,
    focus: "50% 45%",
    alt: "A crowded party, everyone dancing with their hands in the air",
  },
  reunions: {
    file: "occasion-family-gathering",
    width: 960,
    height: 1280,
    focus: "50% 35%",
    alt: "A family gathered together indoors, smiling",
  },
  trips: {
    file: "occasion-road-trip",
    width: 960,
    height: 640,
    focus: "50% 50%",
    alt: "Two friends in a car on a road trip, sun through the windscreen",
  },
  teamEvents: {
    file: "occasion-team-lunch",
    width: 960,
    height: 1440,
    focus: "50% 58%",
    alt: "Colleagues around a long table under party bunting",
  },
  weddings: {
    file: "occasion-wedding-dancing",
    width: 960,
    height: 638,
    focus: "55% 50%",
    alt: "Wedding guests dancing on the lawn",
  },
} as const satisfies Record<string, MarketingPhoto>;

/**
 * The event theme image in homepage keepsake examples: venue decor, never anything that could be
 * read as a guest's capture (product.md §10.2).
 */
export const SAMPLE_THEME_PHOTO: MarketingPhoto = {
  file: "theme-lights-in-trees",
  width: 960,
  height: 1440,
  focus: "50% 50%",
  alt: "String lights hanging in the trees",
};

/**
 * A longer run for mockups that need more than five photos (a gallery grid): the guest's five,
 * then other guests' moments.
 */
const GALLERY: readonly MarketingPhoto[] = [
  ...GUEST_FIVE,
  GROUP_SELFIE,
  OCCASION_PHOTOS.reunions,
  OCCASION_PHOTOS.parties,
  OCCASION_PHOTOS.birthdays,
  OCCASION_PHOTOS.teamEvents,
  OCCASION_PHOTOS.trips,
];

export function galleryPhoto(index: number): MarketingPhoto {
  return GALLERY[index % GALLERY.length];
}
