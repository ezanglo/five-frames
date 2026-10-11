import "server-only";

import { CENTER_FOCUS } from "@/lib/keepsakes/crop";
import { composeJpeg, prepareImage } from "@/lib/keepsakes/render";
import { clamp } from "@/lib/keepsakes/templates/target";
import { LOGO_TONES, lockupSvg, lockupWidth, svgDataUri } from "@/lib/brand/logo";

/**
 * The link preview image chat apps show for a shared capture or gallery link (architecture §5
 * "Link previews"). It is a derivative like a keepsake: the theme image cover-cropped behind the
 * event name, or the FiveFrames night surface when the caller passes no image. The caller decides
 * whether the image may appear, with the same check its page makes. Nothing here reads a token,
 * a capture or a guest. It never shows a photo from the event.
 *
 * Satori draws nothing for an absolutely positioned box sized in percent or by insets, so every
 * layer is sized in pixels.
 */

export const LINK_PREVIEW_SIZE = { width: 1200, height: 630 };

const { width: W, height: H } = LINK_PREVIEW_SIZE;
const NIGHT = "#141414"; // color/surface/dark
const VIOLET = "#6B2BD9"; // brand/primary
const VIOLET_HIGHLIGHT = "#B58CFF"; // brand/highlight
const WHITE = "#FFFFFF";
const BRAND_HEIGHT = 40;

export type LinkPreviewInput = {
  eventName: string;
  /** Short line above the name, e.g. "Photo gallery". */
  kicker: string;
  /** Formatted event date, or null. */
  dateLabel: string | null;
  /** Theme image bytes, only when the caller's access check allows it. */
  themeImage: Buffer | null;
};

export async function renderLinkPreviewJpeg(input: LinkPreviewInput): Promise<Buffer> {
  const photo = input.themeImage ? await coverImage(input.themeImage) : null;

  const layer = { position: "absolute", top: 0, left: 0, width: W, height: H } as const;
  return composeJpeg(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        backgroundColor: NIGHT,
        // Satori rejects undefined style values, so the glow is spread in only without a photo.
        ...(photo
          ? {}
          : {
              backgroundImage: `radial-gradient(circle at 85% 15%, ${VIOLET} 0%, transparent 55%), radial-gradient(circle at 60% 120%, ${VIOLET_HIGHLIGHT}55 0%, transparent 50%)`,
            }),
        fontFamily: "Plus Jakarta Sans",
        color: WHITE,
      }}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- Satori, not the browser
        <img src={photo} alt="" width={W} height={H} style={{ ...layer, objectFit: "cover" }} />
      )}
      {photo && (
        <div
          style={{
            ...layer,
            display: "flex",
            backgroundImage:
              "linear-gradient(180deg, rgba(20,20,20,0.45) 0%, rgba(20,20,20,0) 30%, rgba(20,20,20,0.15) 50%, rgba(20,20,20,0.88) 100%)",
          }}
        />
      )}
      <div
        style={{
          ...layer,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori, not the browser */}
        <img
          src={svgDataUri(lockupSvg(LOGO_TONES.onDark))}
          alt="FiveFrames"
          width={Math.round(lockupWidth(BRAND_HEIGHT))}
          height={BRAND_HEIGHT}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, opacity: 0.85 }}>{input.kicker}</div>
          <div
            style={{
              ...clamp("export", 2),
              fontFamily: "Fraunces",
              fontSize: 76,
              lineHeight: 1.14,
              letterSpacing: "-0.02em",
              width: W - 144,
            }}
          >
            {input.eventName}
          </div>
          {input.dateLabel && (
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, opacity: 0.85 }}>{input.dateLabel}</div>
          )}
        </div>
      </div>
    </div>,
    LINK_PREVIEW_SIZE,
  );
}

async function coverImage(bytes: Buffer): Promise<string | null> {
  try {
    return (await prepareImage(bytes, LINK_PREVIEW_SIZE, CENTER_FOCUS)).src;
  } catch (error) {
    // Same failure rule as keepsakes: an unusable theme image renders the no-image treatment.
    console.warn("link preview: theme image unusable, rendering without it", error);
    return null;
  }
}
