import { NextResponse } from "next/server";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { renderEventSignageSvg, SIGNAGE_FORMATS, type SignageFormat } from "@/lib/media/signage";
import { getRequestBaseUrl } from "@/lib/http/base-url";

/**
 * Host-authenticated signage download (product.md §11.3, architecture §8b). Ownership-
 * checked via getEventForHost, and refuses before `activated_at`/`event_token` exist —
 * signage is rendered from the real capture link, so there is nothing to render for an
 * unpaid event (invariant 7: no distributable link/QR before payment).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; format: string }> },
) {
  const { eventId, format } = await params;
  const host = await requireHost();

  const event = await getEventForHost(host.id, eventId);
  if (!event || !event.activated_at || !event.event_token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!SIGNAGE_FORMATS.includes(format as SignageFormat)) {
    return NextResponse.json({ error: "Unknown signage format" }, { status: 404 });
  }

  const baseUrl = await getRequestBaseUrl();
  const captureUrl = `${baseUrl}/e/${event.event_token}`;

  const svg = await renderEventSignageSvg(format as SignageFormat, {
    eventName: event.name,
    captureUrl,
  });

  const safeName = event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event";

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="${safeName}-${format}.svg"`,
    },
  });
}
