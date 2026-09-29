import Link from "next/link";
import { ChevronRight, Search, SearchX } from "lucide-react";
import { listEventsForOperator } from "@/lib/dal/operator-events";
import { Card } from "@/components/ff/cards";
import { EventStatusBadge, eventStatusKey } from "@/components/ff/event-status";
import { TextInput } from "@/components/ff/field";
import { StatusPill } from "@/components/ff/pill";

/**
 * Operator event list (event-list template, DS06): title left, search right, then one white
 * card of dense rows. Aggregate facts only — name, host, guest sessions, paid, lifecycle.
 */
export default async function OperatorEventListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const events = await listEventsForOperator(q);

  return (
    <div className="flex flex-col gap-5 lg:gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-display font-semibold text-ink lg:text-page-desktop">
            Events
          </h1>
          <p className="tabular text-caption font-medium text-ink-muted">
            {q
              ? `${events.length} result${events.length === 1 ? "" : "s"} for “${q}”`
              : `${events.length} event${events.length === 1 ? "" : "s"}, across all hosts`}
          </p>
        </div>

        <form action="/operator" role="search" className="lg:w-[400px]">
          <label htmlFor="q" className="sr-only">
            Search events
          </label>
          <TextInput
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Event name, host email or event id"
            icon={<Search />}
            className="h-11 rounded-full bg-surface"
          />
        </form>
      </div>

      {events.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
            <SearchX aria-hidden className="size-5" />
          </span>
          <p className="text-[16px] leading-snug font-bold text-ink">No events match</p>
          <p className="max-w-xs text-caption font-medium text-ink-muted">
            {q
              ? `Nothing matched “${q}”. Try an event name, host email or event id.`
              : "No events exist yet."}
          </p>
        </Card>
      ) : (
        <Card as="section" className="overflow-hidden">
          <ul className="divide-y divide-line">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/operator/events/${event.id}`}
                  className="ff-focus group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-subtle lg:px-6 lg:py-4"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-label font-bold text-ink">{event.name}</span>
                    <span className="truncate text-caption font-medium text-ink-muted">
                      {event.hostEmail}
                    </span>
                  </div>
                  <span className="tabular hidden shrink-0 text-caption font-medium text-ink-muted md:block">
                    {event.guest_session_count} / {event.guest_session_cap} guests
                  </span>
                  <span className="hidden shrink-0 sm:block">
                    {event.activated_at ? (
                      <StatusPill size="sm" tone="success" icon="check">
                        Paid
                      </StatusPill>
                    ) : (
                      <StatusPill size="sm">Unpaid</StatusPill>
                    )}
                  </span>
                  <span className="shrink-0">
                    <EventStatusBadge status={eventStatusKey(event)} size="sm" />
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
