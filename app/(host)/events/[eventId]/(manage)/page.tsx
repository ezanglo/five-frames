import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CircleCheck,
  Clock,
  Download,
  Image as ImageIcon,
  Link2,
  Printer,
} from "lucide-react";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { getEventCaptureStats, listCapturesForEventHost } from "@/lib/dal/captures";
import { getLatestPaymentForEvent } from "@/lib/dal/payments";
import { getDashboardVersion } from "@/lib/dal/dashboard-live";
import {
  canOpenCapture,
  deriveEventLifecycleState,
  getExpiryWarning,
  isGalleryRevealed,
} from "@/lib/events/lifecycle";
import { formatEventDateTime, formatEventTime } from "@/lib/events/format";
import { hasPendingProviderPayment } from "@/lib/payments/pricing";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { qrSvgDataUri } from "@/lib/media/qr";
import {
  closeCaptureAction,
  openCaptureAction,
  revealGalleryNowAction,
} from "@/app/(host)/events/actions";
import { ButtonAnchor, ButtonLink, buttonClass } from "@/components/ff/button";
import { GroupLabel, HighlightCard, SectionCard, StatTile } from "@/components/ff/cards";
import { ConfirmButton } from "@/components/ff/confirm-button";
import { CopyLinkButton } from "@/components/ff/copy-button";
import { LivePill } from "@/components/ff/pill";
import { SHOTS_PER_GUEST } from "@/components/ff/shots";
import { DashboardLive } from "../dashboard-live";
import { CaptureToggle } from "./capture-toggle";

/**
 * Host dashboard tab (D6 / mobile 06). Desktop: a main column (stat tiles, latest photos) and a
 * 380px side column (capture, share with guests, reveal). Mobile: the same cards stacked into
 * groups — Live now, Share with guests, After the party. Every number and state is read from the
 * real event; nothing is illustrative. Counts refresh live over the app's own SSE stream, with
 * polling as the fallback (decision D21).
 */
export default async function EventDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { eventId } = await params;
  const { checkout } = await searchParams;
  const host = await requireHost();
  const event = await getEventForHost(host.id, eventId);
  if (!event) notFound();

  const state = deriveEventLifecycleState(event);
  const [version, stats, captures, latestPayment] = await Promise.all([
    getDashboardVersion(host.id, eventId),
    getEventCaptureStats(host.id, eventId),
    listCapturesForEventHost(host.id, eventId),
    state === "draft" ? getLatestPaymentForEvent(host.id, eventId) : Promise.resolve(null),
  ]);

  const guests = stats?.guestSessionCount ?? 0;
  const photos = stats?.photoCount ?? 0;
  const isOpen = state === "capture_open";
  const captureCanOpen = canOpenCapture(event);
  const revealed = isGalleryRevealed(event);
  const expiryWarning = getExpiryWarning(event);
  const isPaymentPending = hasPendingProviderPayment(latestPayment);
  const tz = event.timezone;

  const baseUrl = await getRequestBaseUrl();
  const capturePath = event.activated_at && event.event_token ? `/e/${event.event_token}` : null;
  const galleryPath = event.activated_at && event.gallery_token ? `/g/${event.gallery_token}` : null;
  const qr = capturePath ? await qrSvgDataUri(`${baseUrl}${capturePath}`) : null;
  const displayHost = baseUrl.replace(/^https?:\/\//, "");

  const boundOpen = openCaptureAction.bind(null, eventId);
  const boundClose = closeCaptureAction.bind(null, eventId);
  const boundReveal = revealGalleryNowAction.bind(null, eventId);

  // ── Notices ────────────────────────────────────────────────────────────────────────────
  const notices: ReactNode[] = [];
  if ((checkout === "pending" || isPaymentPending) && !event.activated_at) {
    notices.push(
      <Notice key="pay" icon={<Clock className="animate-pulse" />} tone="tint">
        Payment received — confirming with PayMongo. This page updates automatically once your
        event is activated; capture still stays closed until you open it.
      </Notice>,
    );
  }
  if (state === "expired") {
    notices.push(
      <Notice key="expired" icon={<Clock />}>
        Hosted access for this event has expired and the gallery is read-only. You can still
        download your photos until{" "}
        {event.grace_until ? formatEventDateTime(event.grace_until, tz) : "the end of the grace period"}.
        After that, they’re permanently deleted.
      </Notice>,
    );
  }
  if (state === "archived") {
    notices.push(
      <Notice key="archived" icon={<Clock />}>
        {event.media_deleted_at
          ? "This event’s hosted access has ended and its photos have been permanently deleted."
          : "This event’s hosted access and download grace period have ended. Photos are scheduled for permanent deletion."}
      </Notice>,
    );
  }
  if (expiryWarning) {
    notices.push(
      <Notice key="expiry" icon={<Clock />} tone="tint">
        Hosted access expires in {expiryWarning.daysRemaining} day
        {expiryWarning.daysRemaining === 1 ? "" : "s"}. Download your photos anytime before then —
        downloads stay available through the grace period after expiry too.
      </Notice>,
    );
  }

  // ── Cards ──────────────────────────────────────────────────────────────────────────────
  const guestsTile = (
    <StatTile
      tone="tint"
      value={guests}
      label="Guests joined"
      caption={`Up to ${event.guest_session_cap} guests`}
      labelFirst
      className="lg:rounded-3xl lg:p-5"
    />
  );
  const possible = guests * SHOTS_PER_GUEST;
  const photosTile = (
    <StatTile tone="white" value={photos} label="Photos taken" labelFirst className="max-lg:bg-surface-subtle max-lg:border-0">
      {possible > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.min(100, Math.round((photos / possible) * 100))}%` }}
            />
          </div>
          <p className="tabular text-micro font-medium text-ink-muted">
            of {possible} possible shots
          </p>
        </div>
      )}
    </StatTile>
  );
  const captureStatusTile = (
    <StatTile
      tone="white"
      value={isOpen ? "Open" : state === "draft" ? "—" : "Closed"}
      label="Capture"
      labelFirst
      caption={captureStatusCaption()}
      className="hidden lg:flex"
    />
  );

  function captureStatusCaption(): string {
    if (state === "draft") return "Opens after activation";
    if (isOpen) {
      const since = formatEventTime(event!.capture_opened_at, tz);
      return since ? `Open since ${since}` : "Guests can take photos";
    }
    if (state === "active") return "Open it when guests arrive";
    if (captureCanOpen) return "You can reopen it";
    return "Closed for good";
  }

  const captureCard = (
    <SectionCard
      title="Capture"
      caption={isOpen ? "Guests can take photos" : "Guests can’t take photos right now"}
      action={
        <CaptureToggle
          open={isOpen}
          canToggle={isOpen || captureCanOpen}
          openAction={boundOpen}
          closeAction={boundClose}
        />
      }
    >
      <p className="flex items-start gap-2.5 rounded-md bg-surface-subtle px-4 py-3 text-caption font-medium text-ink-muted">
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{captureDetail()}</span>
      </p>
    </SectionCard>
  );

  function captureDetail(): string {
    const safetyNet = formatEventDateTime(event!.safety_net_closes_at, tz);
    if (state === "draft") return "Capture can be opened once your event is activated.";
    if (state === "active")
      return "Switch it on at the venue when guests arrive. The event date doesn’t open it automatically.";
    if (isOpen)
      return safetyNet
        ? `Close it when the party winds down. If you forget, it closes automatically ${safetyNet}.`
        : "Close it when the party winds down.";
    if (state === "capture_closed" && captureCanOpen)
      return safetyNet
        ? `Closed. You can reopen it until ${safetyNet}.`
        : "Closed. You can reopen it if guests are still shooting.";
    return "Capture has closed for good. Moderation, downloads and sharing still work.";
  }

  const shareCard = capturePath ? (
    <SectionCard title="Share with guests" caption="Guests scan or open this to join.">
      <div className="flex gap-4">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- server-rendered QR data URI
          <img
            src={qr}
            alt="QR code for the guest capture link"
            className="size-[96px] shrink-0 rounded-sm border border-line bg-surface p-2"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-caption font-semibold text-ink" title={`${displayHost}${capturePath}`}>
            {displayHost}
            {capturePath}
          </p>
          <CopyLinkButton path={capturePath} className="w-full" />
          <ButtonAnchor
            href={`/events/${eventId}/signage/qr`}
            download
            variant="secondary"
            size="sm"
            className="w-full"
          >
            <Download aria-hidden />
            Download QR
          </ButtonAnchor>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-caption font-semibold">
        <span className="text-ink-muted">More signage:</span>
        <SignageLink eventId={eventId} format="table-card" label="Table card" />
        <SignageLink eventId={eventId} format="poster" label="Poster" />
        <SignageLink eventId={eventId} format="digital" label="Digital" />
      </div>
    </SectionCard>
  ) : (
    <SectionCard title="Share with guests" caption="Your link and QR code appear once the event is activated.">
      <p className="flex items-start gap-2.5 rounded-md bg-surface-subtle px-4 py-3 text-caption font-medium text-ink-muted">
        <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        Nothing can be shared before payment — so no one can join an event that isn’t active.
      </p>
    </SectionCard>
  );

  const revealCard = event.activated_at ? (
    revealed ? (
      <HighlightCard
        icon={<CircleCheck />}
        title="Gallery revealed"
        body={
          event.visibility === "only_me"
            ? "Visibility is set to only you, so the gallery link doesn’t open it for anyone else. Change this in Settings."
            : "Anyone with the gallery link can see every photo you haven’t hidden."
        }
      >
        {galleryPath && event.visibility !== "only_me" && (
          <CopyLinkButton path={galleryPath} label="Copy gallery link" variant="onTint" size="md" className="w-full" />
        )}
      </HighlightCard>
    ) : (
      <HighlightCard
        icon={<ImageIcon />}
        title="Reveal gallery"
        body={revealBody()}
      >
        <div className="flex flex-col gap-2">
          <ConfirmButton
            action={boundReveal}
            title="Reveal the gallery now?"
            body={
              event.visibility === "only_me"
                ? "Your visibility is set to only you, so the gallery link still won’t admit anyone else."
                : "Anyone with the gallery link will see every photo you haven’t hidden."
            }
            confirmLabel="Reveal gallery"
            variant="primary"
            size="md"
            className="w-full"
          >
            Reveal gallery
          </ConfirmButton>
          <ButtonLink href={`/events/${eventId}/photos`} variant="onTint" size="md" className="w-full">
            Review photos first
          </ButtonLink>
        </div>
      </HighlightCard>
    )
  ) : null;

  function revealBody(): string {
    if (event!.reveal_mode === "custom" && event!.reveal_at) {
      return `Scheduled to reveal ${formatEventDateTime(event!.reveal_at, tz)}. Guests see every photo you haven’t hidden.`;
    }
    return "It reveals automatically when capture closes. Guests see every photo you haven’t hidden.";
  }

  const latest = (captures ?? []).slice(0, 6);
  const latestCard = (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 lg:rounded-3xl lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="font-heading text-heading font-semibold text-ink lg:text-[22px]">
            Latest photos
          </h2>
          {isOpen && <LivePill />}
        </div>
        {photos > 0 && (
          <Link
            href={`/events/${eventId}/photos`}
            className="ff-focus flex items-center gap-1 rounded-md text-label font-semibold text-brand hover:underline"
          >
            View all {photos}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {latest.length === 0 ? (
        <p className="rounded-md bg-surface-subtle px-4 py-6 text-center text-label font-medium text-ink-muted">
          {event.activated_at
            ? "No photos yet — share the QR to get started."
            : "Photos appear here once guests start shooting."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {latest.map((capture) => (
            <li key={capture.id} className="flex flex-col gap-1.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-surface-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url */}
                <img
                  src={capture.thumbnailUrl}
                  alt={`Photo by ${capture.guestDisplayName}, ${formatEventTime(capture.capturedAt, tz)}`}
                  className={`size-full object-cover ${capture.hidden ? "opacity-45" : ""}`}
                />
              </div>
              <p className="flex items-baseline justify-between gap-2 text-caption">
                <span className="truncate font-semibold text-ink">{capture.guestDisplayName}</span>
                <span className="tabular shrink-0 font-medium text-ink-muted">
                  {formatEventTime(capture.capturedAt, tz)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const setupCard =
    state === "draft" ? (
      <section className="flex flex-col gap-4 rounded-xl border border-brand bg-surface p-5 shadow-glow lg:flex-row lg:items-center lg:justify-between lg:rounded-3xl lg:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-bold text-ink">
            {isPaymentPending ? "Payment is being confirmed" : "Finish setting up"}
          </h2>
          <p className="text-caption font-medium text-ink-muted">
            {isPaymentPending
              ? "Your link and QR code appear as soon as PayMongo confirms."
              : "Activate your event to get its link and QR code. Capture stays closed until you open it."}
          </p>
        </div>
        <ButtonLink href={`/events/${eventId}/setup?step=share`} size="md" className="shrink-0">
          {isPaymentPending ? "View payment status" : "Continue setup"}
          <ArrowRight aria-hidden />
        </ButtonLink>
      </section>
    ) : null;

  return (
    <>
      {version && <DashboardLive eventId={eventId} version={version} />}

      {/* Mobile: grouped stack */}
      <div className="flex flex-col gap-5 lg:hidden">
        {notices}
        {setupCard}
        <GroupLabel>{isOpen ? "Live now" : "Overview"}</GroupLabel>
        <div className="-mt-2 grid grid-cols-2 gap-3">
          {guestsTile}
          {photosTile}
        </div>
        {captureCard}
        <GroupLabel>Share with guests</GroupLabel>
        <div className="-mt-2">{shareCard}</div>
        {revealCard && (
          <>
            <GroupLabel>After the party</GroupLabel>
            <div className="-mt-2">{revealCard}</div>
          </>
        )}
        {latestCard}
      </div>

      {/* Desktop: main column + 380 side column */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {notices}
          {setupCard}
          <div className="grid grid-cols-3 gap-4">
            {guestsTile}
            {photosTile}
            {captureStatusTile}
          </div>
          {latestCard}
        </div>
        <div className="flex flex-col gap-6">
          {captureCard}
          {shareCard}
          {revealCard}
        </div>
      </div>
    </>
  );
}

function Notice({
  icon,
  tone = "subtle",
  children,
}: {
  icon: ReactNode;
  tone?: "subtle" | "tint";
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={`flex items-start gap-3 rounded-lg p-4 text-label font-medium [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 ${
        tone === "tint" ? "bg-brand-tint text-ink [&_svg]:text-brand" : "border border-line bg-surface text-ink [&_svg]:text-ink-muted"
      }`}
    >
      {icon}
      <span>{children}</span>
    </p>
  );
}

function SignageLink({ eventId, format, label }: { eventId: string; format: string; label: string }) {
  return (
    <a
      href={`/events/${eventId}/signage/${format}`}
      download
      className={buttonClass("text", "sm", "flex items-center gap-1 text-caption")}
    >
      <Printer className="size-3.5" aria-hidden />
      {label}
    </a>
  );
}
