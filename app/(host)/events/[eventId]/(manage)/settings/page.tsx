import { requireEventAccess } from "@/lib/auth/event-session";
import { saveEventAndGalleryAction } from "@/app/(host)/events/actions";
import { EventGalleryForm } from "./settings-form";

export const metadata = { title: "Settings · FiveFrames" };

/** Settings · Event & gallery (D8 / mobile 06b): details, reveal timing, visibility and gallery layout. */
export default async function EventSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { eventId } = await params;
  const { saved } = await searchParams;
  const { event } = await requireEventAccess(eventId);

  return (
    <EventGalleryForm
      event={event}
      timezones={Intl.supportedValuesOf("timeZone")}
      action={saveEventAndGalleryAction.bind(null, eventId)}
      saved={saved === "1"}
    />
  );
}
