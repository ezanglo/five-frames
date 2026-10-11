import { linkPreviewResponse } from "@/lib/media/link-preview-route";

/**
 * The gallery link's preview image for chat apps (architecture §5 "Link previews"). The theme
 * image appears only while the gallery is granted to link holders (criterion 43).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return linkPreviewResponse("gallery", token);
}
