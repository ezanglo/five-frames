import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { getEventCaptureStats } from "@/lib/dal/captures";
import { formatEventDate } from "@/lib/events/format";
import { buttonClass } from "@/components/ff/button";
import { EventStatusBadge, eventStatusKey } from "@/components/ff/event-status";
import { EventTabs } from "@/components/ff/host/event-tabs";
import {
  HostFrame,
  HostMobileHeader,
  HostSheet,
  HostTopNav,
} from "@/components/ff/host/host-chrome";

/**
 * Event pages (D6 Dashboard · D7 Photos · D8 Settings; mobile 06 / 06b / 07). Desktop: top nav
 * 72 · cover header 260 (left-to-right gradient, Fraunces 48) · 64h underline tab bar · page
 * body. Mobile: the dark header with the status pill and event name, then segmented tabs at the
 * top of the white sheet. Ownership is checked here and again by every page and action.
 */
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const host = await requireHost();
  const event = await getEventForHost(host.id, eventId);
  if (!event) notFound();

  const stats = await getEventCaptureStats(host.id, eventId);
  const status = eventStatusKey(event);
  const meta = [formatEventDate(event.event_date, { year: true }), event.timezone]
    .filter(Boolean)
    .join(" · ");
  const guestPath = event.activated_at && event.event_token ? `/e/${event.event_token}` : null;

  return (
    <HostFrame>
      <HostTopNav host={host} active="events" />

      <HostMobileHeader host={host}>
        <EventStatusBadge status={status} onPhoto />
        <h1 className="font-heading text-display font-semibold break-words">{event.name}</h1>
        {meta && <p className="text-caption font-medium text-ink-inverse/85">{meta}</p>}
      </HostMobileHeader>

      <header className="ff-photo-header-desktop hidden text-ink-inverse lg:block">
        <div className="mx-auto flex min-h-[260px] max-w-[1280px] items-end justify-between gap-8 px-10 pt-12 pb-10">
          <div className="flex min-w-0 flex-col gap-3">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-caption font-medium">
              <Link href="/dashboard" className="ff-focus rounded-md text-ink-inverse/75 hover:text-ink-inverse">
                Events
              </Link>
              <ChevronRight className="size-3.5 text-ink-inverse/50" aria-hidden />
              <span className="truncate font-semibold" aria-current="page">
                {event.name}
              </span>
            </nav>
            <EventStatusBadge status={status} onPhoto />
            <h1 className="font-heading text-display-desktop font-semibold break-words">
              {event.name}
            </h1>
            {meta && <p className="text-label font-medium text-ink-inverse/85">{meta}</p>}
          </div>
          {guestPath && (
            <a
              href={guestPath}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("frosted", "sm", "shrink-0")}
            >
              <ExternalLink aria-hidden />
              Open guest page
            </a>
          )}
        </div>
      </header>
      <div className="sticky top-[72px] z-10 hidden border-b border-line bg-surface lg:block">
        <div className="mx-auto max-w-[1280px] px-10">
          <EventTabs eventId={eventId} photoCount={stats?.photoCount ?? 0} variant="underline" />
        </div>
      </div>

      <HostSheet>
        <div className="lg:hidden">
          <EventTabs eventId={eventId} photoCount={stats?.photoCount ?? 0} variant="segmented" />
        </div>
        {children}
      </HostSheet>
    </HostFrame>
  );
}
