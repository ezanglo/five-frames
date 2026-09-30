import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { saveEventAndGalleryAction } from "@/app/(host)/events/actions";
import { EventGalleryForm } from "./settings-form";

export const metadata = { title: "Settings · FiveFrames" };

/** Settings · Event & gallery (D8 / mobile 06b): details, reveal timing and visibility. */
export default async function EventSettingsPage({
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

  return (
    <EventGalleryForm
      event={event}
      timezones={Intl.supportedValuesOf("timeZone")}
      action={saveEventAndGalleryAction.bind(null, eventId)}
      saved={saved === "1"}
    />
  );
}
