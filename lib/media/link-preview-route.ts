import "server-only";

import type { Metadata } from "next";
import { getLinkPreviewSource, readThemeImageBytes, type LinkPreviewSource } from "@/lib/dal/event-theme";
import { formatEventDate } from "@/lib/events/format";
import { isGalleryOpenToLinkHolders } from "@/lib/events/lifecycle";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { LINK_PREVIEW_SIZE, renderLinkPreviewJpeg } from "./link-preview";

/**
 * The capture and gallery pages' share metadata, and the image route it points at
 * (architecture §5 "Link previews").
 */

export type SharedLink = "capture" | "gallery";

const KICKER: Record<SharedLink, string> = {
  capture: "You’re invited to add your photos",
  gallery: "Photo gallery",
};

function describe(link: SharedLink, source: LinkPreviewSource): string {
  const name = source.event.name;
  if (link === "capture") return `Add your photos to ${name}. No app needed.`;
  return isGalleryOpenToLinkHolders(source.event)
    ? `See the photos from ${name}.`
    : `The photo gallery for ${name}.`;
}

/**
 * Title, description and preview image for a token page. Never indexed. The image URL is
 * absolute on this request's own origin, so a preview deployment previews its own events.
 */
export async function linkPreviewMetadata(link: SharedLink, token: string): Promise<Metadata> {
  const robots = { index: false, follow: false };
  const source = await getLinkPreviewSource(link, token);
  if (!source) return { title: "FiveFrames", robots };

  const prefix = link === "capture" ? "e" : "g";
  const base = await getRequestBaseUrl();
  const image = {
    url: `${base}/${prefix}/${encodeURIComponent(token)}/preview-image?v=${source.imageKey}`,
    ...LINK_PREVIEW_SIZE,
    alt: `${source.event.name} on FiveFrames`,
  };
  const title = source.event.name;
  const description = describe(link, source);
  return {
    title: `${title} · FiveFrames`,
    description,
    robots,
    openGraph: { type: "website", siteName: "FiveFrames", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** The preview JPEG for a token, rendered on request and never stored. */
export async function linkPreviewResponse(link: SharedLink, token: string): Promise<Response> {
  const source = await getLinkPreviewSource(link, token);
  if (!source) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const jpeg = await renderLinkPreviewJpeg({
    eventName: source.event.name,
    kicker: KICKER[link],
    dateLabel: formatEventDate(source.event.event_date, { year: true }),
    themeImage: source.mayShowImage ? await readThemeImageBytes(source.event) : null,
  });
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      // A revoked or rotated token, or a gallery going private, must stop serving the image, so
      // nothing in between may keep a copy. Chat apps cache their own; that is outside our reach.
      "Cache-Control": "no-store",
    },
  });
}
