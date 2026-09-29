import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import { LOGO_TONES, lockupSvg, lockupWidth, svgDataUri } from "@/lib/brand/logo";

/**
 * The guest sharing flow's branded share-card asset (product.md §10, architecture §7 "share
 * cards"): a derived image containing the guest's own photo plus event name, date, hashtag,
 * message and FiveFrames branding — never a mutation of the original or its display/thumbnail
 * derivatives.
 *
 * Visual design follows the contracted design system (docs/design-direction.md): a white card
 * (color/surface/base) with the photo on a night tile (color/surface/dark, radius/sheet) — the
 * same full-bleed dark treatment the photo viewer uses — then the event name in Fraunces 600,
 * meta and the guest's message in Plus Jakarta Sans (the message on surface/subtle in
 * text/on-tint, like the photo list row), and the FiveFrames lockup (lib/brand/logo.ts) at the foot. The photo stays
 * the dominant object on the card.
 *
 * Rendered with `next/og`'s `ImageResponse` (Satori + resvg) rather than `sharp` compositing
 * text or an SVG string rasterized by `sharp`, for the same font-availability reason
 * `lib/media/signage.ts` documents. Satori cannot read CSS variables or woff2, so the brand
 * faces are embedded as static TTF bytes (`lib/media/fonts/*.ttf`, SIL Open Font License, per
 * the Next.js `ImageResponse` "Custom fonts" guide) and the colors below mirror the semantic
 * tokens in app/globals.css by hex.
 *
 * The photo is placed with `object-fit: contain` inside a fixed-size tile (never `cover`) so an
 * arbitrary source orientation or aspect ratio is always shown in full — matching the same
 * "never crop unnecessarily" requirement `capture-slots.tsx`'s composing preview already honors
 * for the guest's own confirm step. A mismatched aspect ratio letterboxes into the night tile.
 */

const CANVAS_WIDTH = 1080;
const PADDING = 40;
const PHOTO_TILE_HEIGHT = 840;
const PHOTO_CAPTION_GAP = 36;
const CAPTION_HEIGHT = 400;
const CANVAS_HEIGHT = PADDING + PHOTO_TILE_HEIGHT + PHOTO_CAPTION_GAP + CAPTION_HEIGHT + PADDING;
const PHOTO_TILE_WIDTH = CANVAS_WIDTH - PADDING * 2;
const PHOTO_TILE_RADIUS = 28; // radius/sheet

// Semantic tokens (DS01), hex-mirrored from app/globals.css for Satori.
const SURFACE = "#FFFFFF"; // color/surface/base
const SURFACE_SUBTLE = "#F5F4F8"; // color/surface/subtle
const SURFACE_DARK = "#141414"; // color/surface/dark
const INK = "#15141A"; // color/text/primary
const INK_MUTED = "#6B6A75"; // color/text/muted
const INK_ON_TINT = "#5B5670"; // color/text/on-tint
const BORDER = "#E6E4EE"; // color/border/subtle
const BRAND = "#6B2BD9"; // brand/primary

const BRAND_HEIGHT = 36;
const BRAND_LOCKUP = svgDataUri(lockupSvg(LOGO_TONES.onLight));

const MAX_NAME_LENGTH = 48;
const MAX_MESSAGE_LENGTH = 140;

export type ShareCardInput = {
  eventName: string;
  eventDateLabel: string | null;
  hashtag: string | null;
  message: string | null;
  photoBuffer: Buffer;
};

const frauncesSemibold = readFile(join(process.cwd(), "lib/media/fonts/fraunces-600.ttf"));
const jakartaMedium = readFile(join(process.cwd(), "lib/media/fonts/plus-jakarta-sans-500.ttf"));
const jakartaBold = readFile(join(process.cwd(), "lib/media/fonts/plus-jakarta-sans-700.ttf"));
const jakartaExtraBold = readFile(
  join(process.cwd(), "lib/media/fonts/plus-jakarta-sans-800.ttf"),
);

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const boundary = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${boundary.trimEnd()}…`;
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
          height: CANVAS_HEIGHT,
          display: "flex",
          flexDirection: "column",
          backgroundColor: SURFACE,
          padding: PADDING,
          gap: PHOTO_CAPTION_GAP,
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        <div
          style={{
            width: PHOTO_TILE_WIDTH,
            height: PHOTO_TILE_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: SURFACE_DARK,
            borderRadius: PHOTO_TILE_RADIUS,
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders this JSX tree itself; next/image is not applicable here. */}
          <img
            src={photoDataUri}
            alt=""
            width={photoWidth}
            height={photoHeight}
            style={{
              maxWidth: PHOTO_TILE_WIDTH,
              maxHeight: PHOTO_TILE_HEIGHT,
              objectFit: "contain",
            }}
          />
        </div>

        <div
          style={{
            height: CAPTION_HEIGHT,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "0 8px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Fraunces",
                fontWeight: 600,
                fontSize: 54,
                lineHeight: 1.1,
                letterSpacing: -0.5,
                color: INK,
              }}
            >
              {truncate(input.eventName, MAX_NAME_LENGTH)}
            </div>
            {metaLine && (
              <div style={{ display: "flex", fontWeight: 500, fontSize: 26, color: INK_MUTED }}>
                {metaLine}
              </div>
            )}
            {input.message && (
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  padding: "18px 24px",
                  borderRadius: 16, // radius/lg
                  backgroundColor: SURFACE_SUBTLE,
                  fontWeight: 500,
                  fontSize: 25,
                  lineHeight: 1.4,
                  color: INK_ON_TINT,
                }}
              >
                &ldquo;{truncate(input.message, MAX_MESSAGE_LENGTH)}&rdquo;
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 22,
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders this JSX tree itself; next/image is not applicable here. */}
            <img
              src={BRAND_LOCKUP}
              alt="FiveFrames"
              width={Math.round(lockupWidth(BRAND_HEIGHT))}
              height={BRAND_HEIGHT}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{ display: "flex", width: 10, height: 10, borderRadius: 9999, backgroundColor: BRAND }}
              />
              <div style={{ display: "flex", fontWeight: 700, fontSize: 22, color: INK_MUTED }}>
                Every guest. Five frames.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fonts: [
        { name: "Fraunces", data: await frauncesSemibold, weight: 600, style: "normal" },
        { name: "Plus Jakarta Sans", data: await jakartaMedium, weight: 500, style: "normal" },
        { name: "Plus Jakarta Sans", data: await jakartaBold, weight: 700, style: "normal" },
        { name: "Plus Jakarta Sans", data: await jakartaExtraBold, weight: 800, style: "normal" },
      ],
    },
  );

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
