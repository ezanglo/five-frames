import { NextResponse, type NextRequest } from "next/server";
import { requireHost } from "@/lib/auth/host-session";
import { getSignagePreview } from "@/lib/dal/signage";
import { getRequestBaseUrl } from "@/lib/http/base-url";

/**
 * The Look page's signage preview (architecture §7c "Routes and gating"): the production
 * renderer, host-owned, inline only. Before activation it draws the URL-less placeholder QR; it
 * never mints a token. `accent` and `hashtag` carry the host's unsaved choices and are validated
 * in the DAL like a save.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; format: string }> },
) {
  const { eventId, format } = await params;
  const host = await requireHost();
  const search = request.nextUrl.searchParams;

  const svg = await getSignagePreview(host.id, eventId, format, await getRequestBaseUrl(), {
    accent: search.get("accent"),
    hashtag: search.get("hashtag"),
  });
  if (!svg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
