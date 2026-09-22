import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ImageResponse } from "next/og";

/**
 * The guest sharing flow's branded share-card asset (product.md §10, architecture §7 "share
 * cards"): a derived image containing the guest's own photo plus event name, date, hashtag,
 * message and FiveFrames branding — never a mutation of the original or its display/thumbnail
 * derivatives.
 *
 * Visual design (docs/design-direction.md, "Guest sharing / share-card artifact"): an
 * instant-print "photo object," the same tangible-object language already established for
 * every filled frame and gallery tile elsewhere in the product (mat, rounded corner, soft
 * presence) — not a promotional overlay on top of the photo. The photo sits in a rounded tile
 * inset within a continuous warm-paper mat (deliberately not the previous black letterbox — see
 * PHOTO_AREA below); a hairline rule separates the photo from a quiet caption strip carrying
 * the FiveFrames mark, event name, date/hashtag, and an optional guest message, in that order
 * of visual weight. The photo remains the dominant object on the card at every step.
 *
 * Rendered with `next/og`'s `ImageResponse` (Satori + resvg) rather than `sharp` compositing
 * text or an SVG string rasterized by `sharp`, for the same font-availability reason
 * `lib/media/signage.ts` documents. Unlike the first version of this file, the product's own
 * display face is embedded directly as font bytes (`lib/media/fonts/*.ttf`, bundled at build
 * time per the Next.js `ImageResponse` "Custom fonts" guide) rather than deferred — this is a
 * visual-system upgrade, not a behavior change: same idempotent generation, same derived-asset
 * semantics, same "never touches the original" guarantee.
 *
 * The photo is placed with `object-fit: contain` inside a fixed-size tile (never `cover`) so an
 * arbitrary source orientation or aspect ratio is always shown in full — matching the same
 * "never crop unnecessarily" requirement `capture-slots.tsx`'s composing preview already honors
 * for the guest's own confirm step. Because the tile's own background is the same warm mat color
 * as the rest of the card, a mismatched aspect ratio letterboxes invisibly into the mat instead
 * of showing bars of an unrelated color.
 */

const CANVAS_WIDTH = 1080;
const MAT_TOP = 40;
const MAT_SIDE = 40;
const MAT_BOTTOM = 64;
const PHOTO_TILE_HEIGHT = 920;
const RULE_ROW_HEIGHT = 32;
const CAPTION_HEIGHT = 300;
const CANVAS_HEIGHT = MAT_TOP + PHOTO_TILE_HEIGHT + RULE_ROW_HEIGHT + CAPTION_HEIGHT + MAT_BOTTOM;
const PHOTO_TILE_WIDTH = CANVAS_WIDTH - MAT_SIDE * 2;
const PHOTO_TILE_RADIUS = 24;
const CORNER_TICK_SIZE = 26;
const CORNER_TICK_INSET = 16;
const CORNER_TICK_THICKNESS = 3;

// Matches lib/media/signage.ts's hex-converted host/guest --canvas / --ink / --accent family
// (docs/design-direction.md) — the same accepted visual identity, not a new palette.
const CANVAS = "#faf4e9";
const INK = "#3d3226";
const INK_MUTED = "#8a7c6a";
const ACCENT = "#a8632f";
const ACCENT_SOFT = "rgba(168, 99, 47, 0.35)";
const BORDER = "#ddd2c7";

const MAX_MESSAGE_LENGTH = 140;

export type ShareCardInput = {
  eventName: string;
  eventDateLabel: string | null;
  hashtag: string | null;
  message: string | null;
  photoBuffer: Buffer;
};

const bricolageBold = readFile(
  join(process.cwd(), "lib/media/fonts/bricolage-grotesque-700.ttf"),
);
const bricolageSemibold = readFile(
  join(process.cwd(), "lib/media/fonts/bricolage-grotesque-600.ttf"),
);
const interMedium = readFile(join(process.cwd(), "lib/media/fonts/inter-500.ttf"));

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const boundary = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${boundary.trimEnd()}…`;
}

/** A small accent L-bracket at one corner of the photo tile — the same quiet "viewfinder" motif
 * used on event signage (lib/media/signage.ts), not a literal camera icon. Four fully-explicit
 * variants rather than a parameterized style object: Satori's style-object parsing does not
 * tolerate `undefined` values for unused sides the way browser CSSOM does. */
const TICK_BORDER = `${CORNER_TICK_THICKNESS}px solid ${ACCENT}`;

function CornerTickTL() {
  return (
    <div
      style={{
        position: "absolute",
        top: CORNER_TICK_INSET,
        left: CORNER_TICK_INSET,
        width: CORNER_TICK_SIZE,
        height: CORNER_TICK_SIZE,
        display: "flex",
        borderTop: TICK_BORDER,
        borderLeft: TICK_BORDER,
      }}
    />
  );
}

function CornerTickTR() {
  return (
    <div
      style={{
        position: "absolute",
        top: CORNER_TICK_INSET,
        right: CORNER_TICK_INSET,
        width: CORNER_TICK_SIZE,
        height: CORNER_TICK_SIZE,
        display: "flex",
        borderTop: TICK_BORDER,
        borderRight: TICK_BORDER,
      }}
    />
  );
}

function CornerTickBL() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: CORNER_TICK_INSET,
        left: CORNER_TICK_INSET,
        width: CORNER_TICK_SIZE,
        height: CORNER_TICK_SIZE,
        display: "flex",
        borderBottom: TICK_BORDER,
        borderLeft: TICK_BORDER,
      }}
    />
  );
}

function CornerTickBR() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: CORNER_TICK_INSET,
        right: CORNER_TICK_INSET,
        width: CORNER_TICK_SIZE,
        height: CORNER_TICK_SIZE,
        display: "flex",
        borderBottom: TICK_BORDER,
        borderRight: TICK_BORDER,
      }}
    />
  );
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
          backgroundColor: CANVAS,
          padding: `${MAT_TOP}px ${MAT_SIDE}px ${MAT_BOTTOM}px`,
        }}
      >
        <div
          style={{
            position: "relative",
            width: PHOTO_TILE_WIDTH,
            height: PHOTO_TILE_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: CANVAS,
            borderRadius: PHOTO_TILE_RADIUS,
            border: `1px solid ${ACCENT_SOFT}`,
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
          <CornerTickTL />
          <CornerTickTR />
          <CornerTickBL />
          <CornerTickBR />
        </div>

        <div style={{ height: RULE_ROW_HEIGHT, display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", width: PHOTO_TILE_WIDTH, height: 1, backgroundColor: BORDER }} />
        </div>

        <div
          style={{
            height: CAPTION_HEIGHT,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 12,
            padding: "0 8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                width: 8,
                height: 8,
                borderRadius: 9999,
                backgroundColor: ACCENT,
              }}
            />
            <div
              style={{
                display: "flex",
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: 20,
                letterSpacing: 4,
                color: ACCENT,
              }}
            >
              FIVE FRAMES
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Bricolage Grotesque",
              fontWeight: 700,
              fontSize: 46,
              lineHeight: 1.15,
              color: INK,
            }}
          >
            {truncate(input.eventName, 60)}
          </div>
          {metaLine && (
            <div
              style={{
                display: "flex",
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: 24,
                color: INK_MUTED,
              }}
            >
              {metaLine}
            </div>
          )}
          {input.message && (
            <div
              style={{
                display: "flex",
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: 26,
                color: INK_MUTED,
              }}
            >
              &ldquo;{truncate(input.message, MAX_MESSAGE_LENGTH)}&rdquo;
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fonts: [
        { name: "Bricolage Grotesque", data: await bricolageBold, weight: 700, style: "normal" },
        { name: "Bricolage Grotesque", data: await bricolageSemibold, weight: 600, style: "normal" },
        { name: "Inter", data: await interMedium, weight: 500, style: "normal" },
      ],
    },
  );

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
