import { requireHost } from "@/lib/auth/host-session";
import { makeHostFullSetKeepsake } from "@/lib/dal/keepsakes";
import { keepsakeResponse } from "@/lib/keepsakes/respond";

/**
 * The host's Full Set keepsake of one guest session (decision D29). Owner or support access;
 * support's is logged before it renders (D30). The request names the session and the style; the five
 * captures come from `getFullSetSources`, so nothing a client sends can choose or reorder them.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string; guestSessionId: string; styleId: string }> },
) {
  const { eventId, guestSessionId, styleId } = await params;
  const host = await requireHost();
  const outcome = await makeHostFullSetKeepsake(host.id, eventId, guestSessionId, styleId);
  return keepsakeResponse(outcome, request, {
    href: `/events/${encodeURIComponent(eventId)}/photos`,
    label: "Back to photos",
  });
}
