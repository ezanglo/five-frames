import { requireEventAccess } from "@/lib/auth/event-session";
import { listCapturesForEventHost } from "@/lib/dal/captures";
import { getDashboardVersion } from "@/lib/dal/dashboard-live";
import { DashboardLive } from "../../dashboard-live";
import { PhotoManager } from "./photo-manager";

export const metadata = { title: "Photos · FiveFrames" };

/** Host Photos tab (D7 / mobile 07). Access-checked capture list with fresh signed URLs. In
 *  support access the list logs the visit and carries display derivatives only (D27). */
export default async function EventPhotosPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { user: host, event, role } = await requireEventAccess(eventId);

  const [version, captures] = await Promise.all([
    getDashboardVersion(host.id, eventId),
    listCapturesForEventHost(host.id, eventId).then((rows) => rows ?? []),
  ]);

  return (
    <>
      {version && <DashboardLive eventId={eventId} version={version} fallbackMs={15000} />}
      <PhotoManager
        eventId={eventId}
        eventName={event.name}
        timezone={event.timezone}
        captures={captures}
        support={role === "support"}
      />
    </>
  );
}
