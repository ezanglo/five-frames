import { NextResponse, type NextRequest } from "next/server";
import { requireHost } from "@/lib/auth/host-session";
import { getTableNumberCardsDownload } from "@/lib/dal/signage";
import { getRequestBaseUrl } from "@/lib/http/base-url";

/**
 * Table-number cards, `?count=N` of them as one ZIP (product.md §11.3, criterion 78;
 * architecture §7c). Owner-only, activated with a current capture link, Standard or Premium,
 * 1 ≤ N ≤ 100; anything else is not found. Nothing is stored, the count included.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const host = await requireHost();

  const download = await getTableNumberCardsDownload(
    host.id,
    eventId,
    request.nextUrl.searchParams.get("count"),
    await getRequestBaseUrl(),
  );
  if (!download) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Blob([download.zip as Uint8Array<ArrayBuffer>]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${download.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
