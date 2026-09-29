import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/marketing/site";

/**
 * Crawl the public marketing pages; keep crawlers out of everything behind a link or an
 * account. Listing these prefixes reveals nothing — event and gallery tokens are never in it —
 * and it is a courtesy to crawlers, not an access control (that stays in the DAL).
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/e/", "/g/", "/dashboard", "/events", "/operator", "/api/", "/auth/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
