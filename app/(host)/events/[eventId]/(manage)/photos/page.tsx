import { requireEventAccess } from "@/lib/auth/event-session";
import { listCapturesForEventHost } from "@/lib/dal/captures";
import { getDashboardVersion } from "@/lib/dal/dashboard-live";
import { getEventThemeForHost } from "@/lib/dal/event-theme";
import { listHostFullSets } from "@/lib/dal/keepsakes";
import { buildKeepsakeContext } from "@/lib/keepsakes/context";
import { eventPlanFeatures } from "@/lib/plans/registry";
import { DashboardLive } from "../../dashboard-live";
import { PhotoManager } from "./photo-manager";

export const metadata = { title: "Photos · FiveFrames" };

/** Host Photos tab (D7 / mobile 07). Access-checked capture list with fresh signed URLs. In
 *  support access the list logs the visit and shows display derivatives only (D27). Owner and
 *  support can make a guest's Full Set keepsake and download originals here (D29, D30); the
 *  server logs support's. */
export default async function EventPhotosPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { user: host, event, role } = await requireEventAccess(eventId);

  const [version, captures, fullSets, theme] = await Promise.all([
    getDashboardVersion(host.id, eventId),
    listCapturesForEventHost(host.id, eventId).then((rows) => rows ?? []),
    listHostFullSets(host.id, eventId),
    getEventThemeForHost(host.id, eventId),
  ]);
  const keepsakes =
    fullSets
      ? {
          fullSets,
          accent: theme?.accent ?? "violet",
          context: buildKeepsakeContext(event, theme?.imageUrl ? { src: theme.imageUrl } : null),
          features: eventPlanFeatures(event),
        }
      : null;

  return (
    <>
      {version && <DashboardLive eventId={eventId} version={version} fallbackMs={15000} />}
      <PhotoManager
        eventId={eventId}
        eventName={event.name}
        timezone={event.timezone}
        captures={captures}
        support={role === "support"}
        keepsakes={keepsakes}
      />
    </>
  );
}
