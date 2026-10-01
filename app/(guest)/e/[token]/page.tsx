import { Clock, Image as ImageIcon, Lock, Users } from "lucide-react";
import { getEventByToken } from "@/lib/dal/events";
import { getEventThemeForGuest } from "@/lib/dal/event-theme";
import { getGuestSession, touchGuestSession } from "@/lib/dal/guest-sessions";
import {
  listCapturesForGuestSessionWithUrls,
  listModeratedSlotIndexesForGuestSession,
} from "@/lib/dal/captures";
import { getGuestSessionIdFromCookie } from "@/lib/auth/guest-session";
import { deriveEventLifecycleState, hasReachedGuestCapacity } from "@/lib/events/lifecycle";
import { firstName, formatEventDate } from "@/lib/events/format";
import { Button } from "@/components/ff/button";
import { ActionFootnote, EventDateLine, GuestShell, SheetActions } from "@/components/ff/guest-shell";
import { HighlightCard } from "@/components/ff/cards";
import { StatusPill } from "@/components/ff/pill";
import { JoinIntro, TrustRow } from "@/components/ff/guest-join";
import { FiveShotTeaser, SHOTS_PER_GUEST } from "@/components/ff/shots";
import { JoinForm } from "./join-form";
import { CaptureSlots } from "./capture-slots";
import { DownloadOwnPhotosButton, OwnPhotoList, type OwnPhoto } from "./own-photos";
import type { GuestKeepsakes } from "./keepsakes";
import { getFullSetAvailability, isKeepsakeEventReachable } from "@/lib/dal/keepsakes";
import { buildKeepsakeContext } from "@/lib/keepsakes/context";
import { keptFrameCount } from "@/lib/capture/guest-slots";

/**
 * The guest event page (guest 01 Join · 02 Your Five · 04 Completion). The lifecycle drives
 * which state renders — open, not open yet (paid but the host hasn't opened capture), and
 * capture closed — exactly as before the redesign (product.md §7.3, §13). There is no
 * scheduled open/close time in FiveFrames, so no state shows a countdown; and the capture link
 * never links to the gallery, which is only reachable through its own link (product.md §13).
 */
export default async function GuestEventPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const event = await getEventByToken(token);

  if (!event) {
    return (
      <CalmState
        title="We can’t find this event"
        heading="Double-check the link"
        body="This link or QR code doesn’t match an event. Ask your host to share it again."
      />
    );
  }

  const state = deriveEventLifecycleState(event);
  const dateLabel = formatEventDate(event.event_date);
  // The event token in the path is this surface's access check (architecture §7a); the theme
  // reader re-resolves it itself before minting the image URL.
  const theme = await getEventThemeForGuest(token);
  const dateLine = <EventDateLine date={dateLabel} hashtag={theme?.hashtag} />;
  const hasDateLine = Boolean(dateLabel || theme?.hashtag);
  // Keepsakes on this page (product.md §10.3): only with the host's sharing setting on and the
  // event still reachable. The keepsake routes re-check all of it, and more, per request.
  const keepsakesFor = async (guestSessionId: string): Promise<GuestKeepsakes | null> =>
    event.sharing_enabled && isKeepsakeEventReachable(event)
      ? {
          token,
          eventName: event.name,
          accent: theme?.accent ?? "violet",
          context: buildKeepsakeContext(event, theme?.imageUrl ? { src: theme.imageUrl } : null),
          fullSet: await getFullSetAvailability(event, guestSessionId),
        }
      : null;

  if (state === "draft" || state === "active") {
    return (
      <GuestShell
        pill={
          <StatusPill tone="frosted" icon="clock">
            Not open yet
          </StatusPill>
        }
        title={event.name}
        subtitle={hasDateLine ? dateLine : undefined}
        theme={theme}
      >
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-title font-semibold text-ink">Almost time!</h2>
          <p className="text-body text-ink-muted">
            Your {SHOTS_PER_GUEST} shots unlock when your host opens capture. Come back to this
            link then — no app needed.
          </p>
        </div>
        <FiveShotTeaser />
        <HighlightCard
          icon={<Clock />}
          title="Capture opens when your host starts it"
          body="Usually once everyone has arrived. Keep this link or QR code handy."
        />
        <SheetActions>
          <Button disabled className="w-full">
            <Lock aria-hidden />
            Join opens when capture starts
          </Button>
          <ActionFootnote icon={<Clock />}>No app · No account needed</ActionFootnote>
        </SheetActions>
      </GuestShell>
    );
  }

  if (state !== "capture_open") {
    // A guest may still hold a session from before capture closed — they always keep a
    // private, downloadable view of their own captures (product.md §8.3, §13).
    const endedGuestSessionId = await getGuestSessionIdFromCookie(token, event.id);
    const endedSession = endedGuestSessionId
      ? await getGuestSession(event.id, endedGuestSessionId)
      : null;
    const [ownCaptures, endedModeratedSlotIndexes] = endedSession
      ? await Promise.all([
          listCapturesForGuestSessionWithUrls(event.id, endedSession.id),
          listModeratedSlotIndexesForGuestSession(event.id, endedSession.id),
        ])
      : [[], []];
    const kept: OwnPhoto[] = ownCaptures
      .filter((c) => c.status === "committed")
      .map((c) => ({
        id: c.id,
        slotIndex: c.slotIndex,
        message: c.message,
        capturedAt: c.capturedAt,
        thumbnailUrl: c.thumbnailUrl,
        displayUrl: c.displayUrl,
        downloadUrl: c.downloadUrl,
      }));

    const pill = (
      <StatusPill tone="frosted" icon="revealed-dot">
        Capture closed
      </StatusPill>
    );

    if (endedSession && kept.length > 0) {
      const name = firstName(endedSession.display_name) ?? endedSession.display_name;
      return (
        <GuestShell
          topRight={pill}
          eyebrow={<EventDateLine prefix={event.name} date={dateLabel} hashtag={theme?.hashtag} />}
          title={`Thanks for sharing, ${name}!`}
          subtitle="Capture has ended. Here’s what you kept."
          width="wide"
          motifPhotos={kept.flatMap((p) => (p.thumbnailUrl ? [p.thumbnailUrl] : []))}
          theme={theme}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-heading font-bold text-ink">Your moments</h2>
            <span className="tabular text-caption font-semibold text-brand-ink">
              {keptFrameCount(kept, endedModeratedSlotIndexes)} of {SHOTS_PER_GUEST} kept
            </span>
          </div>
          <OwnPhotoList
            timezone={event.timezone}
            guestName={endedSession.display_name}
            keepsakes={await keepsakesFor(endedSession.id)}
            photos={kept}
          />
          <HighlightCard
            icon={<ImageIcon />}
            title="The shared gallery has its own link"
            body="Your host shares it when it’s ready. Your own photos stay here for you."
          />
          <SheetActions>
            <DownloadOwnPhotosButton photos={kept} />
          </SheetActions>
        </GuestShell>
      );
    }

    return (
      <GuestShell
        pill={pill}
        title={event.name}
        subtitle={hasDateLine ? dateLine : undefined}
        theme={theme}
      >
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-title font-semibold text-ink">Capture has ended</h2>
          <p className="text-body text-ink-muted">
            Thanks for being part of it. Your host shares the gallery through its own link when
            it’s ready.
          </p>
        </div>
        <HighlightCard
          icon={<ImageIcon />}
          title="Looking for the photos?"
          body="Ask your host for the gallery link — this capture link doesn’t open the gallery."
        />
      </GuestShell>
    );
  }

  const guestSessionId = await getGuestSessionIdFromCookie(token, event.id);
  const session = guestSessionId ? await getGuestSession(event.id, guestSessionId) : null;

  if (!session) {
    // A guest-session-cap check here is only ever a UX nicety for a fresh visitor — the
    // atomic join_guest_session() call re-checks the same condition regardless (product.md
    // §9.5, decision D13), so a race between this read and the guest's submit can't let the
    // event grow past its cap.
    if (hasReachedGuestCapacity(event)) {
      return (
        <GuestShell
          pill={
            <StatusPill tone="frosted" icon="live">
              Capture is live
            </StatusPill>
          }
          title={event.name}
          subtitle={hasDateLine ? dateLine : undefined}
          theme={theme}
        >
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-title font-semibold text-ink">
              This event is full for now
            </h2>
            <p className="text-body text-ink-muted">
              It has reached its guest capacity. Guests who already joined can keep capturing —
              check back with your host.
            </p>
          </div>
          <HighlightCard icon={<Users />} title="Nothing went wrong on your side" />
        </GuestShell>
      );
    }

    return (
      <GuestShell
        pill={
          <StatusPill tone="frosted" icon="live">
            Capture is live
          </StatusPill>
        }
        title={event.name}
        subtitle={hasDateLine ? dateLine : undefined}
        theme={theme}
      >
        <JoinIntro message={event.host_message} />
        <FiveShotTeaser />
        <TrustRow />
        <JoinForm token={token} />
      </GuestShell>
    );
  }

  await touchGuestSession(event.id, session.id);
  const [captures, moderatedSlotIndexes] = await Promise.all([
    listCapturesForGuestSessionWithUrls(event.id, session.id),
    listModeratedSlotIndexesForGuestSession(event.id, session.id),
  ]);

  return (
    <CaptureSlots
      token={token}
      eventId={event.id}
      eventName={event.name}
      eventDateLabel={dateLabel}
      theme={theme}
      timezone={event.timezone}
      guestName={session.display_name}
      keepsakes={await keepsakesFor(session.id)}
      initialCaptures={captures.map((c) => ({
        id: c.id,
        slotIndex: c.slotIndex,
        status: c.status as "pending" | "committed",
        message: c.message,
        capturedAt: c.capturedAt,
        thumbnailUrl: c.thumbnailUrl,
        displayUrl: c.displayUrl,
        downloadUrl: c.downloadUrl,
      }))}
      moderatedSlotIndexes={moderatedSlotIndexes}
    />
  );
}

function CalmState({ title, heading, body }: { title: string; heading: string; body: string }) {
  return (
    <GuestShell title={title}>
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-title font-semibold text-ink">{heading}</h2>
        <p className="text-body text-ink-muted">{body}</p>
      </div>
    </GuestShell>
  );
}
