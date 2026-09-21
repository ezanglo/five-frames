import Link from "next/link";
import { Search, ChevronRight, SearchX } from "lucide-react";
import { listEventsForOperator } from "@/lib/dal/operator-events";
import { deriveEventLifecycleState } from "@/lib/events/lifecycle";
import { StatePill } from "@/app/(operator)/state-indicator";
import { Input } from "@/components/ui/input";

export default async function OperatorEventListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const events = await listEventsForOperator(q);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-operator-display text-lg font-semibold text-(--operator-ink)">
          Events
        </h1>
        <p className="mt-0.5 text-sm text-(--operator-ink-muted)">
          {q
            ? `${events.length} result${events.length === 1 ? "" : "s"} for "${q}"`
            : `${events.length} event${events.length === 1 ? "" : "s"}, across all hosts`}
        </p>
      </div>

      <form action="/operator">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--operator-ink-muted)"
          />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by event name, host email, or event id"
            className="h-10 rounded-lg border-(--operator-border) bg-(--operator-canvas-raised) pl-9 placeholder:text-(--operator-ink-muted)"
          />
        </div>
      </form>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-(--operator-border) bg-(--operator-canvas-raised) py-14 text-center">
          <SearchX aria-hidden className="size-6 text-(--operator-ink-muted)" />
          <p className="text-sm font-medium text-(--operator-ink)">
            No events match
          </p>
          <p className="max-w-xs text-xs text-(--operator-ink-muted)">
            {q
              ? `Nothing matched "${q}". Try an event name, host email, or event id.`
              : "No events exist yet."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {events.map((event) => {
            const state = deriveEventLifecycleState(event);
            return (
              <li key={event.id}>
                <Link
                  href={`/operator/events/${event.id}`}
                  className="group flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-(--operator-surface)"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-(--operator-ink)">
                      {event.name}
                    </span>
                    <span className="truncate text-xs text-(--operator-ink-muted)">
                      {event.hostEmail}
                    </span>
                  </div>
                  <div className="hidden shrink-0 text-xs text-(--operator-ink-muted) sm:block">
                    {event.guest_session_count}/{event.guest_session_cap} guests
                  </div>
                  <span
                    className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline-block ${
                      event.activated_at
                        ? "bg-(--operator-state-capture_open)/12 text-(--operator-state-capture_open)"
                        : "bg-(--operator-ink-muted)/12 text-(--operator-ink-muted)"
                    }`}
                  >
                    {event.activated_at ? "Paid" : "Unpaid"}
                  </span>
                  <div className="shrink-0">
                    <StatePill state={state} />
                  </div>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-(--operator-ink-muted) opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
