import { makeSingleKeepsake } from "@/lib/dal/keepsakes";
import { guestSessionForToken, keepsakeResponse } from "../../../respond";

/**
 * A Single-photo keepsake of one of the requesting guest's own captures (product.md §10.2.1,
 * architecture §7b). All authorization is in `makeSingleKeepsake`; this only reads the signed
 * cookie and shapes the response.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; captureId: string; styleId: string }> },
) {
  const { token, captureId, styleId } = await params;
  const guestSessionId = await guestSessionForToken(token);
  const outcome = await makeSingleKeepsake(token, guestSessionId, captureId, styleId);
  return keepsakeResponse(outcome, request, token);
}
