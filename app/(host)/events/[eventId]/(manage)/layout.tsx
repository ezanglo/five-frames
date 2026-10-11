import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { requireEventAccess } from "@/lib/auth/event-session";
import { getEventCaptureStats } from "@/lib/dal/captures";
import { getEventThemeForHost } from "@/lib/dal/event-theme";
import { getSupportedHostEmail } from "@/lib/dal/support-actions";
import { formatEventDate } from "@/lib/events/format";
import { buttonClass } from "@/components/ff/button";
import { EventStatusBadge, eventStatusKey } from "@/components/ff/event-status";
import { EventTabs } from "@/components/ff/host/event-tabs";
import { SupportBanner } from "@/components/ff/host/support-banner";
import {
  EventCoverImage,
  HostFrame,
  HostMobileHeader,
  HostSheet,
  HostTopNav,
} from "@/components/ff/host/host-chrome";
import { captureLinkPath } from "@/lib/events/links";

/**
 * Event pages (D6 Dashboard · D7 Photos · D8 Settings; mobile 06 / 06b / 07). Desktop: top nav
 * 72 · cover header 260 (left-to-right gradient, Fraunces 48) · 64h underline tab bar · page
 * body. Mobile: the dark header with the status pill and event name, then segmented tabs at the
 * top of the white sheet. Access (owner or support, D27) is checked here and again by every page
 * and action. In support access every page carries the support banner naming the host.
 */
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { user: host, event, role } = await requireEventAccess(eventId);

  const [stats, theme, supportedHostEmail] = await Promise.all([
    getEventCaptureStats(host.id, eventId),
    getEventThemeForHost(host.id, eventId),
    role === "support" ? getSupportedHostEmail(host.id, eventId) : Promise.resolve(null),
  ]);
  const coverUrl = theme?.imageUrl ?? null;
  const status = eventStatusKey(event);
  const meta = [formatEventDate(event.event_date, { year: true }), event.timezone]
    .filter(Boolean)
    .join(" · ");
  const guestPath = event.activated_at ? captureLinkPath(event) : null;

  return (
    <HostFrame>
      {role === "support" && <SupportBanner hostEmail={supportedHostEmail} />}
      <HostTopNav host={host} active="events" />

      <HostMobileHeader host={host} coverUrl={coverUrl}>
        <EventStatusBadge status={status} onPhoto />
        <h1 className="font-heading text-display font-semibold break-words">{event.name}</h1>
        {meta && <p className="text-caption font-medium text-ink-inverse/85">{meta}</p>}
      </HostMobileHeader>

      <header className="ff-photo-header-desktop relative hidden text-ink-inverse lg:block">
        {coverUrl && <EventCoverImage src={coverUrl} direction="across" />}
        <div className="relative mx-auto flex min-h-[260px] max-w-[1280px] items-end justify-between gap-8 px-10 pt-12 pb-10">
          <div className="flex min-w-0 flex-col gap-3">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-caption font-medium">
              {/* In support access the way back is the Console's event page, not the
                  operator's own event list. */}
              <Link
                href={role === "support" ? `/operator/events/${eventId}` : "/dashboard"}
                className="ff-focus rounded-md text-ink-inverse/75 hover:text-ink-inverse"
              >
                {role === "support" ? "Operator Console" : "Events"}
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
