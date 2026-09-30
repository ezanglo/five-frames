import { NextResponse } from "next/server";
import { requireHost } from "@/lib/auth/host-session";
import { getSignageDownload } from "@/lib/dal/signage";
import { getRequestBaseUrl } from "@/lib/http/base-url";

/**
 * Host-authenticated signage download (product.md §11.3, architecture §7c). Ownership-checked,
 * and refuses before `activated_at`/`event_token` exist: a download always carries the live QR,
 * so there is nothing to download for an unpaid event (invariant 7). The Look page's inline
 * preview is the sibling `preview` route.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; format: string }> },
) {
  const { eventId, format } = await params;
  const host = await requireHost();

  const download = await getSignageDownload(host.id, eventId, format, await getRequestBaseUrl());
  if (!download) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(download.svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${download.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
