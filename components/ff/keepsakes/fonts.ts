import localFont from "next/font/local";

/**
 * The keepsake previews' fonts: the exact TTFs the server export hands Satori
 * (lib/media/fonts/), so a DOM preview wraps and measures text the way the exported JPEG does.
 * Exposed as the CSS variables the templates' `preview` target reads (lib/keepsakes/templates/
 * target.ts). Loaded lazily with the picker/Look chunks that use them.
 */
const heading = localFont({
  src: "../../../lib/media/fonts/fraunces-600.ttf",
  weight: "600",
  variable: "--ff-keepsake-heading",
  display: "block",
  preload: false,
});

const body = localFont({
  src: [
    { path: "../../../lib/media/fonts/plus-jakarta-sans-500.ttf", weight: "500" },
    { path: "../../../lib/media/fonts/plus-jakarta-sans-600.ttf", weight: "600" },
    { path: "../../../lib/media/fonts/plus-jakarta-sans-700.ttf", weight: "700" },
    { path: "../../../lib/media/fonts/plus-jakarta-sans-800.ttf", weight: "800" },
  ],
  variable: "--ff-keepsake-body",
  display: "block",
  preload: false,
});

export const keepsakeFontVariables = `${heading.variable} ${body.variable}`;
