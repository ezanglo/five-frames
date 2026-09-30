import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { getEventThemeForHost } from "@/lib/dal/event-theme";
import { formatEventDate } from "@/lib/events/format";
import { saveLookSettingsAction } from "@/app/(host)/events/actions";
import { LookStudio } from "@/components/ff/look/look-studio";

export const metadata = { title: "Look · Settings · FiveFrames" };

/**
 * Settings · Look (design-direction "Host · Look studio"): the same studio as Create → Look,
 * without the wizard. The theme image saves on its own; color, hashtag, welcome message and
 * Guest keepsakes wait for Save changes. Theme changes never touch payment, activation, links
 * or lifecycle (architecture §7a).
 */
export default async function LookSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { eventId } = await params;
  const { saved } = await searchParams;
  const host = await requireHost();
  const event = await getEventForHost(host.id, eventId);
  if (!event) notFound();
  const theme = await getEventThemeForHost(host.id, eventId);

  return (
    <LookStudio
      mode="settings"
      eventId={eventId}
      eventName={event.name}
      dateLabel={formatEventDate(event.event_date)}
      eventDate={event.event_date}
      activated={Boolean(event.activated_at)}
      initial={{
        accent: theme?.accent ?? "violet",
        hashtag: event.hashtag ?? "",
        message: event.host_message ?? "",
        sharingEnabled: event.sharing_enabled,
        imageUrl: theme?.imageUrl ?? null,
      }}
      action={saveLookSettingsAction.bind(null, eventId)}
      saved={saved === "1"}
    />
  );
}
