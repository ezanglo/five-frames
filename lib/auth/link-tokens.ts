import "server-only";

import { randomBytes } from "node:crypto";

/**
 * `event_token` / `gallery_token` generator (architecture §5): 128 bits of CSPRNG
 * randomness, base62-ish via base64url encoding, unguessable and unique-indexed at the
 * database level. Shared by activation and by host-initiated rotation so both paths mint
 * tokens the same way.
 */
export function generateLinkToken(): string {
  return randomBytes(16).toString("base64url");
}
