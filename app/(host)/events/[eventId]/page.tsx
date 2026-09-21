import { notFound } from "next/navigation";
import { Camera, Images } from "lucide-react";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { getEventCaptureStats, listCapturesForEventHost } from "@/lib/dal/captures";
import {
  canOpenCapture,
  deriveEventLifecycleState,
  EVENT_LIFECYCLE_STATE_LABEL,
  isGalleryRevealed,
} from "@/lib/events/lifecycle";
import {
  closeCaptureAction,
  openCaptureAction,
  revokeEventTokenAction,
  revokeGalleryTokenAction,
  rotateEventTokenAction,
  rotateGalleryTokenAction,
  updateEvent,
} from "@/app/(host)/events/actions";
import { LinkRow } from "./link-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { utcIsoToZonedDateTimeLocal } from "@/lib/events/timezone";
import { DashboardPoller } from "./dashboard-poller";
import { GalleryGrid } from "./gallery-grid";

const REVEAL_MODE_ITEMS = [
  { value: "after_event", label: "After the event" },
  { value: "immediate", label: "Immediately" },
  { value: "custom", label: "Custom time" },
];

const VISIBILITY_ITEMS = [
  { value: "anyone_with_link", label: "Anyone with the link" },
  { value: "only_me", label: "Only me" },
];

export default async function EventEditPage({
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
  if (!event) {
    notFound();
  }

  const state = deriveEventLifecycleState(event);
  const boundUpdate = updateEvent.bind(null, eventId);
  const boundOpenCapture = openCaptureAction.bind(null, eventId);
  const boundCloseCapture = closeCaptureAction.bind(null, eventId);
  const boundRotateEventToken = rotateEventTokenAction.bind(null, eventId);
  const boundRevokeEventToken = revokeEventTokenAction.bind(null, eventId);
  const boundRotateGalleryToken = rotateGalleryTokenAction.bind(null, eventId);
  const boundRevokeGalleryToken = revokeGalleryTokenAction.bind(null, eventId);

  const stats = await getEventCaptureStats(host.id, eventId);
  const captures = await listCapturesForEventHost(host.id, eventId);

  const captureCanOpen = canOpenCapture(event);

  const isLive = state === "capture_open";

  return (
    <div className="flex flex-col gap-8">
      <DashboardPoller />

      {/* Masthead status band — the dominant operational control (structural delta plan:
          "Event status" + "Capture open/close"). State reads from color alone before any
          text is read; counts are ambient caption text, not stat widgets. */}
      <div
        className={
          "flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between " +
          (isLive
            ? "border-(--host-live)/30 bg-(--host-live)/10"
            : "border-(--host-border) bg-(--host-canvas-raised)")
        }
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={
                "size-2 rounded-full " +
                (isLive ? "bg-(--host-live) animate-pulse" : "bg-(--host-ink-muted)/50")
              }
            />
            <h1 className="font-host-display text-2xl font-semibold text-(--host-ink)">
              {event.name}
            </h1>
          </div>
          <p className="text-sm text-(--host-ink-muted)">
            {EVENT_LIFECYCLE_STATE_LABEL[state]} · {stats?.guestSessionCount ?? 0} guest
            {(stats?.guestSessionCount ?? 0) === 1 ? "" : "s"} ·{" "}
            {stats?.photoCount ?? 0} photo{(stats?.photoCount ?? 0) === 1 ? "" : "s"}
          </p>
          {state === "draft" && (
            <p className="text-xs text-(--host-ink-muted)">
              Capture opens once the event is activated.
            </p>
          )}
          {state === "capture_closed" && !captureCanOpen && (
            <p className="text-xs text-(--host-ink-muted)">
              Capture closed automatically and can&rsquo;t be reopened.
            </p>
          )}
        </div>

        {state === "capture_open" ? (
          <form action={boundCloseCapture}>
            <Button
              type="submit"
              size="lg"
              className="w-full bg-(--host-canvas-raised) text-(--host-live) ring-1 ring-(--host-live)/40 hover:bg-(--host-canvas-raised)/80 sm:w-auto"
            >
              Close capture
            </Button>
          </form>
        ) : (
          <form action={boundOpenCapture}>
            <Button
              type="submit"
              size="lg"
              disabled={!captureCanOpen}
              className="w-full bg-(--host-accent) text-(--host-accent-foreground) hover:bg-(--host-accent)/90 sm:w-auto"
            >
              Open capture
            </Button>
          </form>
        )}
      </div>

      {saved && (
        <p className="rounded-lg bg-(--host-surface) px-3 py-2 text-sm text-(--host-ink)">
          Saved.
        </p>
      )}

      {event.activated_at ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
            Links
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <LinkRow
                label="Capture link"
                icon={<Camera className="size-3.5" />}
                helpText="For guests at the venue — lets them join and capture while capture is open."
                path={event.event_token ? `/e/${event.event_token}` : null}
                rotateAction={boundRotateEventToken}
                revokeAction={boundRevokeEventToken}
              />
            </div>
            <div className="flex-1">
              <LinkRow
                label="Gallery link"
                icon={<Images className="size-3.5" />}
                helpText={
                  !isGalleryRevealed(event)
                    ? "For anyone you share it with, view-only — grants nothing until the gallery is revealed."
                    : event.visibility === "only_me"
                      ? "For anyone you share it with, view-only — but visibility is set to only me, so it grants nothing to anyone else."
                      : "For anyone you share it with, view-only — they can see the gallery now."
                }
                path={event.gallery_token ? `/g/${event.gallery_token}` : null}
                rotateAction={boundRotateGalleryToken}
                revokeAction={boundRevokeGalleryToken}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-(--host-ink-muted)">
          Links are issued once the event is activated.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
          Gallery
        </h2>
        <GalleryGrid eventId={eventId} captures={captures ?? []} />
      </div>

      <form
        action={boundUpdate}
        className="flex flex-col gap-6 rounded-2xl border border-(--host-border) bg-(--host-canvas-raised) p-5"
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
            Event details
          </h2>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Event name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={event.name}
              required
              className="border-(--host-border) bg-(--host-canvas)"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eventDate">Event date</Label>
            <Input
              id="eventDate"
              name="eventDate"
              type="date"
              defaultValue={event.event_date ?? ""}
              className="border-(--host-border) bg-(--host-canvas)"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              name="timezone"
              defaultValue={event.timezone}
              className="border-(--host-border) bg-(--host-canvas)"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hostMessage">Message to guests</Label>
            <Textarea
              id="hostMessage"
              name="hostMessage"
              defaultValue={event.host_message ?? ""}
              placeholder="Thank you for celebrating with us..."
              className="border-(--host-border) bg-(--host-canvas)"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hashtag">Hashtag</Label>
            <Input
              id="hashtag"
              name="hashtag"
              defaultValue={event.hashtag ?? ""}
              placeholder="#AnaAndMiguel2026"
              className="border-(--host-border) bg-(--host-canvas)"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-(--host-border) pt-6">
          <h2 className="text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
            Gallery reveal &amp; sharing
          </h2>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revealMode">When should the gallery reveal?</Label>
            <Select
              name="revealMode"
              items={REVEAL_MODE_ITEMS}
              defaultValue={event.reveal_mode}
            >
              <SelectTrigger id="revealMode" className="w-full border-(--host-border) bg-(--host-canvas)">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVEAL_MODE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revealAt">Custom reveal time</Label>
            <Input
              id="revealAt"
              name="revealAt"
              type="datetime-local"
              defaultValue={
                event.reveal_at
                  ? utcIsoToZonedDateTimeLocal(event.reveal_at, event.timezone)
                  : ""
              }
              className="border-(--host-border) bg-(--host-canvas)"
            />
            <p className="text-xs text-(--host-ink-muted)">
              Only used when reveal is set to &ldquo;Custom time&rdquo;.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="visibility">Who can view the gallery link?</Label>
            <Select
              name="visibility"
              items={VISIBILITY_ITEMS}
              defaultValue={event.visibility}
            >
              <SelectTrigger id="visibility" className="w-full border-(--host-border) bg-(--host-canvas)">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-(--host-surface-quiet) p-3">
            <div>
              <Label htmlFor="sharingEnabled">Allow guest sharing</Label>
              <p className="text-xs text-(--host-ink-muted)">
                Guests can share a branded card of their own photo.
              </p>
            </div>
            <Switch
              id="sharingEnabled"
              name="sharingEnabled"
              defaultChecked={event.sharing_enabled}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-(--host-accent) text-(--host-accent-foreground) hover:bg-(--host-accent)/90 sm:w-auto sm:self-start"
        >
          Save changes
        </Button>
      </form>
    </div>
  );
}
