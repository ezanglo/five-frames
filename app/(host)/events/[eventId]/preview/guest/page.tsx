import { requireEventAccess } from "@/lib/auth/event-session";
import { getEventThemeForHost } from "@/lib/dal/event-theme";
import { formatEventDate } from "@/lib/events/format";
import { GuestJoinPreviewScreen } from "./guest-join-preview-screen";

export const metadata = { title: "Guest preview · FiveFrames", robots: { index: false } };

/**
 * Host-only guest-screen preview for the Look studio (architecture §7c: "the real guest shell
 * components, with sample content and the event's theme, inside a scaled frame"). It is framed
 * at phone width by the host's own Look page, so the guest shell lays out exactly as on a
 * phone. Ownership is checked here; there is no token, no guest session and no guest DAL call,
 * so nothing a guest could reach is created — Draft previews included (product.md §7.2).
 */
export default async function GuestPreviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { user: host, event } = await requireEventAccess(eventId);
  const theme = await getEventThemeForHost(host.id, eventId);

  return (
    <GuestJoinPreviewScreen
      initial={{
        name: event.name,
        dateLabel: formatEventDate(event.event_date),
        message: event.host_message,
        accent: theme?.accent ?? "violet",
        hashtag: theme?.hashtag ?? null,
        imageUrl: theme?.imageUrl ?? null,
      }}
    />
  );
}
