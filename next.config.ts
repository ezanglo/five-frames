import type { NextConfig } from "next"
import { SLUG_SOURCE, TOKEN_SOURCE } from "./lib/events/links"

const nextConfig: NextConfig = {
  // The keepsake and signage renderers read their bundled TTFs from disk (lib/keepsakes/render.tsx,
  // lib/media/signage-fonts.ts), which the file tracer can't see through `process.cwd()`. Ship
  // them with those routes.
  outputFileTracingIncludes: {
    "/e/\\[token\\]/keepsake/**": ["./lib/media/fonts/*.ttf"],
    "/e/\\[token\\]/preview-image": ["./lib/media/fonts/*.ttf"],
    "/g/\\[token\\]/preview-image": ["./lib/media/fonts/*.ttf"],
    "/events/\\[eventId\\]/signage/**": ["./lib/media/fonts/*.ttf"],
  },
  // Slugged share links (lib/events/links.ts) land on the token routes. The slug is dropped
  // unread: the token alone decides what the link opens.
  async rewrites() {
    return ["e", "g"].map((prefix) => ({
      source: `/${prefix}/:slug(${SLUG_SOURCE})/:token(${TOKEN_SOURCE})`,
      destination: `/${prefix}/:token`,
    }))
  },
}

export default nextConfig
