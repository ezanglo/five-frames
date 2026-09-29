import { Camera, Plus } from "lucide-react";
import { requireHost } from "@/lib/auth/host-session";
import { listEventsWithPhotoCountsForHost } from "@/lib/dal/captures";
import { firstName, formatEventDate } from "@/lib/events/format";
import { ButtonLink } from "@/components/ff/button";
import { eventStatusKey, type EventStatusKey } from "@/components/ff/event-status";
import { HostFrame, HostMobileHeader, HostSheet, HostTopNav } from "@/components/ff/host/host-chrome";
import { EventsBrowser, type EventListItem } from "./events-browser";

export const metadata = { title: "Your events · FiveFrames" };

const CTA: Record<EventStatusKey, string> = {
  draft: "Finish setup",
  upcoming: "Manage event",
  open: "Open dashboard",
  closed: "Manage event",
  revealed: "View photos",
  expired: "Download photos",
  archived: "View event",
};

/** Host events (host 05 / D2 first time · D2b events). */
export default async function EventsPage() {
  const host = await requireHost();
  const rows = await listEventsWithPhotoCountsForHost(host.id);
  const name = firstName(host.name);

  const events: EventListItem[] = rows.map(({ event, photoCount }) => {
    const status = eventStatusKey(event);
    return {
      id: event.id,
      name: event.name,
      dateLabel: formatEventDate(event.event_date),
      status,
      guests: event.guest_session_count,
      photos: photoCount,
      href: status === "draft" ? `/events/${event.id}/setup` : `/events/${event.id}`,
      cta: CTA[status],
    };
  });

  const eyebrow =
    events.length === 0
      ? name
        ? `Hi, ${name} — your account is ready`
        : "Your account is ready"
      : name
        ? `Hi, ${name}`
        : "Welcome back";

  const heading = (
    <div className="flex flex-col gap-2">
      <p className="text-label font-medium text-ink-muted">{eyebrow}</p>
      <h1 className="font-heading text-page-desktop font-semibold text-ink">Your events</h1>
    </div>
  );

  return (
    <HostFrame>
      <HostTopNav host={host} active="events" />
      <HostMobileHeader host={host}>
        <p className="text-caption font-medium text-ink-inverse/85">{eyebrow}</p>
        <h1 className="font-heading text-display font-semibold">Your events</h1>
      </HostMobileHeader>
      <HostSheet>
        {events.length === 0 ? (
          <>
            <div className="hidden lg:block">{heading}</div>
            <FirstEventEmptyState />
          </>
        ) : (
          <EventsBrowser events={events} heading={heading} />
        )}
      </HostSheet>
    </HostFrame>
  );
}

const SETUP_STEPS = [
  "Name it and set the date",
  "Add a welcome message for guests",
  "Activate it and share the QR code",
];

/** Empty state (DS05, host 05 first time): illustration + 3 numbered steps + one CTA. */
function FirstEventEmptyState() {
  return (
    <section className="flex flex-1 flex-col gap-5 lg:flex-none lg:flex-row lg:items-center lg:gap-12 lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:p-12">
      <div
        aria-hidden
        className="relative flex h-[150px] items-center justify-center overflow-hidden rounded-lg bg-brand-tint lg:h-[240px] lg:w-[340px] lg:shrink-0"
      >
        <span className="absolute h-[90px] w-[76px] -translate-x-12 rotate-[-8deg] rounded-md border border-line bg-surface lg:h-[130px] lg:w-[110px] lg:-translate-x-16" />
        <span className="absolute h-[90px] w-[76px] translate-x-12 rotate-[8deg] rounded-md border border-line bg-surface lg:h-[130px] lg:w-[110px] lg:translate-x-16" />
        <span className="relative flex h-[96px] w-[80px] flex-col items-center justify-center gap-1.5 rounded-lg bg-brand text-ink-inverse shadow-glow lg:h-[140px] lg:w-[116px]">
          <Camera className="size-6" />
          <span className="text-micro font-bold">5 frames</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <h2 className="font-heading text-title font-semibold text-ink lg:text-[32px]">
          Let’s set up your first event
        </h2>
        <p className="text-body text-ink-muted">
          Birthdays, weddings, reunions, trips — add the details, activate it, and you’ll get a QR
          code to share with guests.
        </p>
        <ol className="flex flex-col gap-3 rounded-lg bg-surface-subtle p-4 lg:bg-transparent lg:p-0">
          {SETUP_STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-label font-medium text-ink">
              <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-micro font-bold text-brand">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div className="mt-auto flex flex-col items-center gap-2 pt-2 lg:mt-2 lg:flex-row lg:gap-4">
          <ButtonLink href="/events/new" className="w-full lg:w-auto">
            <Plus aria-hidden />
            Create new event
          </ButtonLink>
          <span className="text-caption font-medium text-ink-muted">Takes about 2 minutes</span>
        </div>
      </div>
    </section>
  );
}
