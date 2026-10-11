import { linkPreviewResponse } from "@/lib/media/link-preview-route";

/** The capture link's preview image for chat apps (architecture §5 "Link previews"). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return linkPreviewResponse("capture", token);
}
