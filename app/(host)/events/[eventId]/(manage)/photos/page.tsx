import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { listCapturesForEventHost } from "@/lib/dal/captures";
import { getDashboardVersion } from "@/lib/dal/dashboard-live";
import { DashboardLive } from "../../dashboard-live";
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

  const [version, captures] = await Promise.all([
    getDashboardVersion(host.id, eventId),
    listCapturesForEventHost(host.id, eventId).then((rows) => rows ?? []),
  ]);

  return (
    <>
      {version && <DashboardLive eventId={eventId} version={version} fallbackMs={15000} />}
      <PhotoManager eventId={eventId} timezone={event.timezone} captures={captures} />
    </>
  );
}
