"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Plus, Search } from "lucide-react";
import { buttonClass, ButtonLink } from "@/components/ff/button";
import { Chip } from "@/components/ff/pill";
import { EventStatusBadge, type EventStatusKey } from "@/components/ff/event-status";
import { cn } from "@/lib/utils";

export type EventListItem = {
  id: string;
  name: string;
  dateLabel: string | null;
  status: EventStatusKey;
  guests: number;
  photos: number;
  href: string;
  cta: string;
};

type Filter = "all" | "live" | "upcoming" | "past";

/** Filters are views over the accepted lifecycle (decision D8) — no new state is introduced. */
const FILTER_STATUSES: Record<Exclude<Filter, "all">, EventStatusKey[]> = {
  live: ["open"],
  upcoming: ["draft", "upcoming"],
  past: ["closed", "revealed", "expired", "archived"],
};

/**
 * Host events (host 05 / D2b): filter chips (All · Live · Upcoming · Past) and — on desktop — a
 * search field that filters as you type. Desktop: 4-column card grid (3 at 1024–1279) ending in
 * the dashed "Create new event" card. Mobile: a single list with the Create button pinned low.
 */
export function EventsBrowser({
  events,
  heading,
}: {
  events: EventListItem[];
  /** Desktop page heading, rendered left of the filters in one header row (D2b). */
  heading: React.ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (filter === "all" || FILTER_STATUSES[filter].includes(e.status)) &&
        (!q || e.name.toLowerCase().includes(q)),
    );
  }, [events, filter, query]);

  const counts = {
    all: events.length,
    live: events.filter((e) => FILTER_STATUSES.live.includes(e.status)).length,
    upcoming: events.filter((e) => FILTER_STATUSES.upcoming.includes(e.status)).length,
    past: events.filter((e) => FILTER_STATUSES.past.includes(e.status)).length,
  };

  const chips = (
    <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" role="group" aria-label="Filter events">
      {(["all", "live", "upcoming", "past"] as const).map((f) => (
        <Chip
          key={f}
          active={filter === f}
          count={f === "all" ? counts.all : undefined}
          onClick={() => setFilter(f)}
        >
          {f === "all" ? "All" : f === "live" ? "Live" : f === "upcoming" ? "Upcoming" : "Past"}
        </Chip>
      ))}
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-4 lg:hidden">{chips}</div>
      <div className="hidden items-end justify-between gap-6 lg:flex">
        {heading}
        <div className="flex items-center gap-3">
        {chips}
        <label className="relative w-[240px]">
          <span className="sr-only">Search events</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events"
            className="ff-focus h-10 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-label font-medium text-ink placeholder:text-ink-placeholder"
          />
        </label>
        </div>
      </div>

      {visible.length === 0 && (
        <p className="rounded-lg bg-surface-subtle p-5 text-center text-label font-medium text-ink-muted lg:bg-surface">
          No events match this filter.
        </p>
      )}

      {/* Mobile list */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {visible.map((event) => (
          <li key={event.id}>
            <Link
              href={event.href}
              className={cn(
                "ff-focus flex items-center gap-3 rounded-xl border p-3",
                event.status === "open" ? "border-brand bg-brand-tint" : "border-line bg-surface",
              )}
            >
              <span aria-hidden className="ff-photo-header size-[72px] shrink-0 rounded-sm" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <EventStatusBadge status={event.status} size="sm" />
                <span className="truncate text-[16px] font-bold text-ink">{event.name}</span>
                {event.dateLabel && (
                  <span className="text-caption font-medium text-ink-muted">{event.dateLabel}</span>
                )}
                <Stats event={event} />
              </span>
              <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop grid */}
      <ul className="hidden gap-5 lg:grid lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((event) => {
          const live = event.status === "open";
          return (
            <li
              key={event.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-3xl border bg-surface",
                live ? "border-brand shadow-glow" : "border-line",
              )}
            >
              <div className="ff-photo-header relative h-[140px]">
                <span className="absolute top-3 left-3">
                  <EventStatusBadge status={event.status} size="sm" />
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-5">
                <h2
                  title={event.name}
                  className="line-clamp-3 font-heading text-[20px] leading-tight font-semibold break-words text-ink"
                >
                  {event.name}
                </h2>
                <p className="text-caption font-medium text-ink-muted">
                  {event.dateLabel ?? "Date not set"}
                </p>
                <Stats event={event} />
                <span className="min-h-4 flex-1" aria-hidden />
                <Link
                  href={event.href}
                  className={cn(
                    buttonClass(live ? "primary" : "outline", "sm"),
                    "mt-auto w-full",
                  )}
                >
                  {event.cta}
                  {live && <ArrowRight aria-hidden />}
                </Link>
              </div>
            </li>
          );
        })}
        <li>
          <Link
            href="/events/new"
            className="ff-focus ff-dashed flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl bg-surface text-center"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-brand text-ink-inverse shadow-glow">
              <Plus className="size-5" aria-hidden />
            </span>
            <span className="text-[16px] font-bold text-ink">Create new event</span>
            <span className="text-caption font-medium text-ink-muted">Takes about 2 minutes</span>
          </Link>
        </li>
      </ul>

      <div className="sticky bottom-0 mt-auto bg-linear-to-t from-surface via-surface to-transparent pt-4 lg:hidden">
        <ButtonLink href="/events/new" className="w-full">
          <Plus aria-hidden />
          Create new event
        </ButtonLink>
      </div>
    </>
  );
}

function Stats({ event }: { event: EventListItem }) {
  if (event.status === "draft") {
    return <span className="text-caption font-medium text-ink-muted">Not activated yet</span>;
  }
  if (event.status === "upcoming") {
    return <span className="text-caption font-medium text-ink-muted">Capture not open yet</span>;
  }
  return (
    <span
      className={cn(
        "tabular text-caption font-semibold",
        event.status === "open" ? "text-brand" : "text-ink",
      )}
    >
      {event.guests} guest{event.guests === 1 ? "" : "s"} · {event.photos} photo
      {event.photos === 1 ? "" : "s"}
    </span>
  );
}
