import "server-only";

import sharp from "sharp";
import { ImageResponse } from "next/og";

/**
 * The guest sharing flow's branded share-card asset (product.md §10, architecture §7 "share
 * cards"): a derived image containing the guest's own photo plus event name, date, hashtag,
 * message and FiveFrames branding — never a mutation of the original or its display/thumbnail
 * derivatives.
 *
 * Rendered with `next/og`'s `ImageResponse` (Satori + resvg) rather than `sharp` compositing
 * text, or an SVG string rasterized by `sharp` the way `lib/media/signage.ts` deliberately
 * avoids: both of those paths would depend on system fonts being installed in the serverless
 * runtime. `ImageResponse` sidesteps that risk structurally — it ships its own embedded
 * fallback typeface and never touches the host's font configuration — at the cost of not
 * using the product's display face here; a header/body font stack, if wanted later, would need
 * its own bytes supplied to `ImageResponse`, not the browser-facing Google Fonts already used
 * elsewhere in the app.
 *
 * The photo is placed with `object-fit: contain` inside a fixed-height photo area (never
 * `cover`) so an arbitrary source orientation or aspect ratio is always shown in full,
 * letterboxed rather than cropped — matching the same "never crop unnecessarily" requirement
 * `capture-slots.tsx`'s composing preview already honors for the guest's own confirm step.
 */

const CANVAS_WIDTH = 1080;
const PHOTO_AREA_HEIGHT = 1080;
const FOOTER_HEIGHT = 300;

// Matches lib/media/signage.ts's hex-converted host/guest --canvas / --ink / --accent family
// (docs/design-direction.md) — the same accepted visual identity, not a new palette.
const CANVAS = "#faf4e9";
const INK = "#3d3226";
const INK_MUTED = "#8a7c6a";
const ACCENT = "#a8632f";

const MAX_MESSAGE_LENGTH = 140;

export type ShareCardInput = {
  eventName: string;
  eventDateLabel: string | null;
  hashtag: string | null;
  message: string | null;
  photoBuffer: Buffer;
};

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function renderShareCardPng(input: ShareCardInput): Promise<Buffer> {
  const metadata = await sharp(input.photoBuffer).rotate().metadata();
  const photoWidth = metadata.width ?? 1;
  const photoHeight = metadata.height ?? 1;
  const photoDataUri = `data:image/jpeg;base64,${input.photoBuffer.toString("base64")}`;

  const metaLine = [input.eventDateLabel, input.hashtag ? `#${input.hashtag.replace(/^#/, "")}` : null]
    .filter(Boolean)
    .join("  ·  ");

  const response = new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_WIDTH,
          height: PHOTO_AREA_HEIGHT + FOOTER_HEIGHT,
          display: "flex",
          flexDirection: "column",
          backgroundColor: CANVAS,
        }}
      >
        <div
          style={{
            width: CANVAS_WIDTH,
            height: PHOTO_AREA_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000000",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders this JSX tree itself; next/image is not applicable here. */}
          <img
            src={photoDataUri}
            alt=""
            width={photoWidth}
            height={photoHeight}
            style={{
              maxWidth: CANVAS_WIDTH,
              maxHeight: PHOTO_AREA_HEIGHT,
              objectFit: "contain",
            }}
          />
        </div>
        <div
          style={{
            width: CANVAS_WIDTH,
            height: FOOTER_HEIGHT,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 12,
            padding: "0 64px",
          }}
        >
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: ACCENT }}>
            FIVE FRAMES
          </div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: INK }}>
            {truncate(input.eventName, 60)}
          </div>
          {metaLine && (
            <div style={{ display: "flex", fontSize: 28, color: INK_MUTED }}>{metaLine}</div>
          )}
          {input.message && (
            <div style={{ display: "flex", fontSize: 26, color: INK_MUTED }}>
              &ldquo;{truncate(input.message, MAX_MESSAGE_LENGTH)}&rdquo;
            </div>
          )}
        </div>
      </div>
    ),
    { width: CANVAS_WIDTH, height: PHOTO_AREA_HEIGHT + FOOTER_HEIGHT },
  );

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
