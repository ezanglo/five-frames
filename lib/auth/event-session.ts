import "server-only";

import { notFound } from "next/navigation";
import { requireHost, type HostSession } from "@/lib/auth/host-session";
import { getEventAccessFor, type EventAccess, type EventRole } from "@/lib/dal/event-access";

/**
 * A host event page's gate (D27, architecture §5b): a verified signed-in user, then their role on
 * this event. A role the page doesn't admit is not found, exactly like another host's event, so
 * an account without an operator grant learns nothing by requesting a support address.
 * Owner-only pages (the Create wizard, the Share step and checkout) pass `["owner"]`.
 */
export async function requireEventAccess(
  eventId: string,
  roles: readonly EventRole[] = ["owner", "support"],
): Promise<EventAccess & { user: HostSession }> {
  const user = await requireHost();
  const access = await getEventAccessFor(user.id, eventId, roles);
  if (!access) notFound();
  return { ...access, user };
}
