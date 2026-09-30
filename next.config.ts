import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The keepsake and signage renderers read their bundled TTFs from disk (lib/keepsakes/render.tsx,
  // lib/media/signage-fonts.ts), which the file tracer can't see through `process.cwd()`. Ship
  // them with those routes.
  outputFileTracingIncludes: {
    "/e/\\[token\\]/keepsake/**": ["./lib/media/fonts/*.ttf"],
    "/events/\\[eventId\\]/signage/**": ["./lib/media/fonts/*.ttf"],
  },
}

export default nextConfig
