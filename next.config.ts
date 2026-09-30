import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The keepsake renderer reads its bundled TTFs from disk (lib/keepsakes/render.tsx), which the
  // file tracer can't see through `process.cwd()`. Ship them with the keepsake routes.
  outputFileTracingIncludes: {
    "/e/\\[token\\]/keepsake/**": ["./lib/media/fonts/*.ttf"],
  },
}

export default nextConfig
