/**
 * Canonical origin for public marketing metadata (canonical URLs, Open Graph, sitemap, robots).
 * No secrets here, so no `server-only` import.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is set by Vercel on every deployment (production and
 * preview) to the project's production domain, so previews still point canonicals at
 * production rather than at a throwaway preview host. Locally it falls back to `next dev`.
 */
export function getSiteUrl(): string {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : "http://localhost:3000";
}

export const SITE_NAME = "FiveFrames";

export const SITE_TAGLINE = "Every guest. Five frames. One shared story.";

export const SITE_DESCRIPTION =
  "Guests scan a QR code and capture five photos each from their own phones — no app, no guest account. The host receives one private collection from the event.";

/** Public marketing routes, in navigation order. `/demo` lives in its own route group (D14). */
export const MARKETING_ROUTES = ["/", "/how-it-works", "/pricing", "/faq", "/demo"] as const;

/** Public navigation, shared by the header, the mobile menu and the footer. */
export const PUBLIC_NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/demo", label: "Try the demo" },
] as const;
