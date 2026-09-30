import { makeFullSetKeepsake } from "@/lib/dal/keepsakes";
import { guestSessionForToken, keepsakeResponse } from "../../respond";

/**
 * A Full Set keepsake of the requesting guest's own five (product.md §10.2.2, architecture §7b).
 * The request names only the style: the session comes from the signed cookie and the five
 * captures from `getFullSetSources`. Nothing a client sends can choose or reorder them.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; styleId: string }> }) {
  const { token, styleId } = await params;
  const guestSessionId = await guestSessionForToken(token);
  const outcome = await makeFullSetKeepsake(token, guestSessionId, styleId);
  return keepsakeResponse(outcome, request, token);
}
