import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { listCapturesForEventHost } from "@/lib/dal/captures";
import { DashboardPoller } from "../../dashboard-poller";
import { PhotoManager } from "./photo-manager";

export const metadata = { title: "Photos · FiveFrames" };

/** Host Photos tab (D7 / mobile 07). Ownership-checked capture list with fresh signed URLs. */
export default async function EventPhotosPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const host = await requireHost();
  const event = await getEventForHost(host.id, eventId);
  if (!event) notFound();

  const captures = (await listCapturesForEventHost(host.id, eventId)) ?? [];

  return (
    <>
      <DashboardPoller intervalMs={15000} />
      <PhotoManager eventId={eventId} timezone={event.timezone} captures={captures} />
    </>
  );
}
