import Link from "next/link";
import { requireHost } from "@/lib/auth/host-session";
import { listEventsForHost } from "@/lib/dal/events";
import {
  deriveEventLifecycleState,
  EVENT_LIFECYCLE_STATE_LABEL,
  type EventLifecycleState,
} from "@/lib/events/lifecycle";
import { createEvent } from "@/app/(host)/events/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LIVE_STATES: EventLifecycleState[] = ["capture_open"];

export default async function DashboardPage() {
  const host = await requireHost();
  const events = await listEventsForHost(host.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-host-display text-xl font-semibold text-(--host-ink)">
          Your events
        </h1>
        <p className="mt-0.5 text-sm text-(--host-ink-muted)">
          {events.length === 0
            ? "Create your first event to get started."
            : `${events.length} event${events.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <form
        action={createEvent}
        className="flex gap-2 border-b border-(--host-border) pb-6"
      >
        <Input
          name="name"
          placeholder="e.g. Ana & Miguel's Wedding"
          required
          className="flex-1 border-(--host-border) bg-(--host-canvas-raised) placeholder:text-(--host-ink-muted)"
        />
        <Button
          type="submit"
          className="bg-(--host-accent) text-(--host-accent-foreground) hover:bg-(--host-accent)/90"
        >
          Create draft
        </Button>
      </form>

      {events.length === 0 ? (
        <p className="text-sm text-(--host-ink-muted)">
          No events yet. Create your first draft above.
        </p>
      ) : (
        <ul className="flex flex-col">
          {events.map((event) => {
            const state = deriveEventLifecycleState(event);
            const live = LIVE_STATES.includes(state);
            return (
              <li
                key={event.id}
                className="border-b border-(--host-border) last:border-b-0"
              >
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-(--host-surface-quiet)/60"
                >
                  <span className="font-host-display text-base text-(--host-ink)">
                    {event.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-(--host-ink-muted)">
                    <span
                      aria-hidden
                      className={
                        "size-1.5 rounded-full " +
                        (live ? "bg-(--host-live)" : "bg-(--host-ink-muted)/50")
                      }
                    />
                    {EVENT_LIFECYCLE_STATE_LABEL[state]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
