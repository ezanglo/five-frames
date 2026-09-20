import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { deriveEventLifecycleState } from "@/lib/events/lifecycle";
import { updateEvent } from "@/app/(host)/events/actions";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { utcIsoToZonedDateTimeLocal } from "@/lib/events/timezone";

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{event.name}</h1>
        <span className="text-xs text-muted-foreground">{state}</span>
      </div>

      {saved && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">Saved.</p>
      )}

      <form action={boundUpdate}>
        <Card>
          <CardHeader>
            <CardTitle>Event details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Event name</Label>
              <Input id="name" name="name" defaultValue={event.name} required />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eventDate">Event date</Label>
              <Input
                id="eventDate"
                name="eventDate"
                type="date"
                defaultValue={event.event_date ?? ""}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue={event.timezone}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hostMessage">Message to guests</Label>
              <Textarea
                id="hostMessage"
                name="hostMessage"
                defaultValue={event.host_message ?? ""}
                placeholder="Thank you for celebrating with us..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hashtag">Hashtag</Label>
              <Input
                id="hashtag"
                name="hashtag"
                defaultValue={event.hashtag ?? ""}
                placeholder="#AnaAndMiguel2026"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Gallery reveal</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="revealMode">When should the gallery reveal?</Label>
              <Select
                name="revealMode"
                items={REVEAL_MODE_ITEMS}
                defaultValue={event.reveal_mode}
              >
                <SelectTrigger id="revealMode" className="w-full">
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
              />
              <p className="text-xs text-muted-foreground">
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
                <SelectTrigger id="visibility" className="w-full">
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

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="sharingEnabled">Allow guest sharing</Label>
                <p className="text-xs text-muted-foreground">
                  Guests can share a branded card of their own photo.
                </p>
              </div>
              <Switch
                id="sharingEnabled"
                name="sharingEnabled"
                defaultChecked={event.sharing_enabled}
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="mt-4">
          Save changes
        </Button>
      </form>
    </div>
  );
}
