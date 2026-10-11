import { NextResponse } from "next/server";
import { requireHost } from "@/lib/auth/host-session";
import { getOriginalDownloadUrl } from "@/lib/dal/captures";

/**
 * One original photo, for support access's download button (D30): the DAL logs the download
 * before signing, then this redirects to the signed, attachment-named URL. The owner's grid
 * still links to a pre-signed URL directly; this route admits the owner too, unlogged.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; captureId: string }> },
) {
  const { eventId, captureId } = await params;
  const host = await requireHost();
  const url = await getOriginalDownloadUrl(host.id, eventId, captureId);
  if (!url) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
