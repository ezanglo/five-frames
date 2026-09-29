import type { Metadata } from "next";
import { SITE_NAME } from "./site";

/**
 * Metadata for a public marketing page: title, description, canonical path, and the matching
 * Open Graph / Twitter fields. The share image itself comes from the route group's
 * opengraph-image file convention, so it is not repeated here.
 */
export function marketingMetadata({
  title,
  description,
  path,
  absoluteTitle,
}: {
  title: string;
  description: string;
  path: string;
  /** The homepage uses its own full title instead of the "· FiveFrames" template. */
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_PH",
      url: path,
      title: fullTitle,
      description,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}
