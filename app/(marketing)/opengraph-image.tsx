import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LOGO_TONES, lockupSvg, lockupWidth, svgDataUri } from "@/lib/brand/logo";

/**
 * Share image for the public marketing pages. Same fonts as the keepsake renderer (bundled
 * TTFs, lib/media/fonts) and the photo-header treatment: night surface with the violet glow.
 * Colors mirror the semantic tokens in app/globals.css (Satori can't read CSS variables).
 */
export const alt = "FiveFrames — Every guest. Five frames. One shared story.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NIGHT = "#141414"; // color/surface/dark
const VIOLET = "#6B2BD9"; // brand/primary
const VIOLET_HIGHLIGHT = "#B58CFF"; // brand/highlight
const WHITE = "#FFFFFF"; // color/text/inverse
const ON_DARK = "#A9A6B5"; // color/text/on-dark-muted
const DASHED = "#C9C2DC"; // color/border/dashed

const ROTATIONS = [-6, 3, -2, 6, -3];
const BRAND_HEIGHT = 44;

export default async function OpenGraphImage() {
  const [fraunces, jakartaBold, jakartaExtraBold] = await Promise.all([
    readFile(join(process.cwd(), "lib/media/fonts/fraunces-600.ttf")),
    readFile(join(process.cwd(), "lib/media/fonts/plus-jakarta-sans-700.ttf")),
    readFile(join(process.cwd(), "lib/media/fonts/plus-jakarta-sans-800.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: NIGHT,
          backgroundImage: `radial-gradient(circle at 85% 15%, ${VIOLET} 0%, transparent 55%), radial-gradient(circle at 60% 120%, ${VIOLET_HIGHLIGHT}55 0%, transparent 50%)`,
          fontFamily: "Plus Jakarta Sans",
          color: WHITE,
        }}
      >
        <img
          src={svgDataUri(lockupSvg(LOGO_TONES.onDark))}
          alt="FiveFrames"
          width={Math.round(lockupWidth(BRAND_HEIGHT))}
          height={BRAND_HEIGHT}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Fraunces",
              fontSize: 84,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
            }}
          >
            <span>Every guest. Five frames.</span>
            <span>One shared story.</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: ON_DARK }}>
            No app. No guest account. One private collection.
          </div>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          {ROTATIONS.map((rotation, i) => (
            <div
              key={i}
              style={{
                width: 78,
                height: 98,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                border: `3px dashed ${i === 0 ? VIOLET_HIGHLIGHT : DASHED}`,
                backgroundColor: i === 0 ? `${VIOLET}66` : "rgba(255,255,255,0.08)",
                transform: `rotate(${rotation}deg)`,
                fontSize: 30,
                fontWeight: 800,
                color: i === 0 ? WHITE : ON_DARK,
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
        { name: "Plus Jakarta Sans", data: jakartaBold, weight: 700, style: "normal" },
        { name: "Plus Jakarta Sans", data: jakartaExtraBold, weight: 800, style: "normal" },
      ],
    },
  );
}
