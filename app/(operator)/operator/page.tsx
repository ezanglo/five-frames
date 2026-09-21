import Link from "next/link";
import { listEventsForOperator } from "@/lib/dal/operator-events";
import {
  deriveEventLifecycleState,
  EVENT_LIFECYCLE_STATE_LABEL,
} from "@/lib/events/lifecycle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function OperatorEventListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const events = await listEventsForOperator(q);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-host-display text-xl font-semibold text-(--host-ink)">
          Events
        </h1>
        <p className="mt-0.5 text-sm text-(--host-ink-muted)">
          {q
            ? `${events.length} result${events.length === 1 ? "" : "s"} for "${q}"`
            : `${events.length} event${events.length === 1 ? "" : "s"}, across all hosts`}
        </p>
      </div>

      <form className="flex gap-2" action="/operator">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by event name, host email, or event id"
          className="flex-1 border-(--host-border) bg-(--host-canvas-raised) placeholder:text-(--host-ink-muted)"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {events.length === 0 ? (
        <p className="text-sm text-(--host-ink-muted)">No events match.</p>
      ) : (
        <ul className="flex flex-col">
          {events.map((event) => {
            const state = deriveEventLifecycleState(event);
            return (
              <li
                key={event.id}
                className="border-b border-(--host-border) last:border-b-0"
              >
                <Link
                  href={`/operator/events/${event.id}`}
                  className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-(--host-surface-quiet)/60"
                >
                  <span className="flex flex-col">
                    <span className="font-host-display text-base text-(--host-ink)">
                      {event.name}
                    </span>
                    <span className="text-xs text-(--host-ink-muted)">
                      {event.hostEmail}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-(--host-ink-muted)">
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
