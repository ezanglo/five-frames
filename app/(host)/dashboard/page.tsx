import Link from "next/link";
import { requireHost } from "@/lib/auth/host-session";
import { listEventsForHost } from "@/lib/dal/events";
import { deriveEventLifecycleState } from "@/lib/events/lifecycle";
import { createEvent } from "@/app/(host)/events/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATE_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  capture_open: "Capture open",
  capture_closed: "Capture closed",
  expired: "Expired",
  archived: "Archived",
};

export default async function DashboardPage() {
  const host = await requireHost();
  const events = await listEventsForHost(host.id);

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>New event</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createEvent} className="flex gap-2">
            <Input
              name="name"
              placeholder="e.g. Ana & Miguel's Wedding"
              required
              className="flex-1"
            />
            <Button type="submit">Create draft</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Your events
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No events yet. Create your first draft above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted"
                >
                  <span>{event.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {STATE_LABEL[deriveEventLifecycleState(event)]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
