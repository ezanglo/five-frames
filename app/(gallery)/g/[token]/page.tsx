import { notFound } from "next/navigation";
import { ImageOff, Lock } from "lucide-react";
import { getEventByGalleryToken } from "@/lib/dal/events";
import { getEventThemeForGallery } from "@/lib/dal/event-theme";
import { listCapturesForGalleryViewer } from "@/lib/dal/captures";
import { isGalleryOpenToLinkHolders, isGalleryRevealed } from "@/lib/events/lifecycle";
import type { EventRow } from "@/lib/db/types";
import { formatEventDate, formatEventDateTime } from "@/lib/events/format";
import { EventDateLine, GuestShell } from "@/components/ff/guest-shell";
import { HighlightCard } from "@/components/ff/cards";
import { StatusPill } from "@/components/ff/pill";
import { RevealCountdown } from "@/components/ff/reveal-countdown";
import { GalleryArchive } from "./gallery-archive";

/**
 * The public gallery (product.md §7.4/§8.2, guest 05 Gallery · locked / revealed). Possession of
 * the gallery token is the credential for "anyone with the link" visibility (architecture §5) —
 * there is no guest session and no host auth here. Access is decided once, right here, before
 * any capture is loaded: not found, "only me", and not-yet-revealed each render a calm state.
 *
 * The locked state deliberately shows no thumbnails (not even blurred ones) and no photo or
 * guest counts — an unrevealed gallery is never viewable (invariant 8). The only thing it can
 * say about timing is what the host configured: a countdown for a custom reveal time.
 *
 * The event theme appears only in the granted branch (product.md §10.1, criterion 43): the
 * locked and "only me" pages never load the theme reader, so they receive no theme image URL,
 * accent or hashtag and keep the FiveFrames default look.
 */
export default async function GalleryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const event = await getEventByGalleryToken(token);

  if (!event) {
    return (
      <GuestShell title="We can’t find this gallery">
        <HighlightCard
          icon={<ImageOff />}
          title="Double-check the link"
          body="This gallery link doesn’t match an event. Ask your host to share it again."
        />
      </GuestShell>
    );
  }

  const eyebrow = [event.name, formatEventDate(event.event_date)].filter(Boolean).join(" · ");

  if (event.visibility === "only_me") {
    return (
      <GuestShell
        topRight={
          <StatusPill tone="frosted" icon="lock">
            Private
          </StatusPill>
        }
        eyebrow={eyebrow}
        title="This gallery is private"
        subtitle="The host has kept this gallery visible to themselves only."
      >
        <LockedTeaser />
      </GuestShell>
    );
  }

  if (!isGalleryRevealed(event)) {
    const customReveal = upcomingCustomReveal(event);

    return (
      <GuestShell
        topRight={
          <StatusPill tone="frosted" icon="lock">
            Gallery locked
          </StatusPill>
        }
        eyebrow={eyebrow}
        title="Gallery opens soon"
        subtitle={
          event.reveal_mode === "after_event"
            ? "Everyone’s photos appear here once the event wraps up."
            : "Everyone’s photos appear here once the host reveals them."
        }
      >
        {customReveal && (
          <RevealCountdown
            revealAt={customReveal}
            label={formatEventDateTime(customReveal, event.timezone) ?? ""}
          />
        )}
        <LockedTeaser />
        <p className="text-center text-caption font-medium text-ink-muted">
          Come back to this link to see them.
        </p>
      </GuestShell>
    );
  }

  if (!isGalleryOpenToLinkHolders(event)) notFound();
  const [captures, theme] = await Promise.all([
    listCapturesForGalleryViewer(event.id),
    getEventThemeForGallery(token),
  ]);

  return (
    <GuestShell
      variant="wide"
      topRight={
        <StatusPill tone="frosted" icon="live">
          Gallery is open
        </StatusPill>
      }
      eyebrow={
        <EventDateLine
          prefix={event.name}
          date={formatEventDate(event.event_date)}
          hashtag={theme?.hashtag}
        />
      }
      theme={theme}
      title="Relive the moments"
      subtitle={
        captures.length === 0
          ? "No photos yet."
          : `${captures.length} photo${captures.length === 1 ? "" : "s"}`
      }
    >
      {event.host_message && (
        <p className="rounded-lg bg-surface-subtle px-4 py-3 text-body font-medium whitespace-pre-line text-ink md:max-w-[68ch] md:px-5 md:py-4">
          {event.host_message}
        </p>
      )}
      {captures.length === 0 ? (
        <HighlightCard
          icon={<ImageOff />}
          title="Nothing here yet"
          body="This gallery doesn’t have any photos to show."
        />
      ) : (
        <GalleryArchive captures={captures} />
      )}
    </GuestShell>
  );
}

/** A host-set custom reveal time that is still ahead — the only timing the locked page shows. */
function upcomingCustomReveal(event: EventRow): string | null {
  return event.reveal_mode === "custom" && event.reveal_at && Date.parse(event.reveal_at) > Date.now()
    ? event.reveal_at
    : null;
}

/**
 * Locked-gallery teaser (DS05). The handoff draws it with blurred thumbnails and a photo count;
 * FiveFrames renders an abstract, content-free plate instead so nothing about the unrevealed
 * gallery — not even how many photos it holds — reaches this page (invariant 8).
 */
function LockedTeaser() {
  return (
    <div className="relative flex aspect-[16/10] flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-surface-dark text-ink-inverse">
      <div
        aria-hidden
        className="ff-photo-header absolute inset-0 scale-110 opacity-90 blur-2xl"
      />
      <span className="relative flex size-12 items-center justify-center rounded-full bg-surface text-brand-ink">
        <Lock className="size-5" aria-hidden />
      </span>
      <p className="relative text-[16px] font-bold">Still under wraps</p>
      <p className="relative text-caption font-medium text-ink-inverse/80">
        Photos stay private until the reveal
      </p>
    </div>
  );
}
