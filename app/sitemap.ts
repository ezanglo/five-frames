import type { MetadataRoute } from "next";
import { getSiteUrl, MARKETING_ROUTES } from "@/lib/marketing/site";

/** Public pages only. Event, gallery, host and operator routes are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return MARKETING_ROUTES.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
