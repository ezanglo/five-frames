import type { ReactNode } from "react";
import { Clock, Image as ImageIcon, Lock, ShieldCheck, Smartphone, UserX, Users } from "lucide-react";
import { getEventByToken } from "@/lib/dal/events";
import { getGuestSession, touchGuestSession } from "@/lib/dal/guest-sessions";
import { listCapturesForGuestSessionWithUrls } from "@/lib/dal/captures";
import { getGuestSessionIdFromCookie } from "@/lib/auth/guest-session";
import { deriveEventLifecycleState, hasReachedGuestCapacity } from "@/lib/events/lifecycle";
import { firstName, formatEventDate } from "@/lib/events/format";
import { Button } from "@/components/ff/button";
import { ActionFootnote, GuestShell, SheetActions } from "@/components/ff/guest-shell";
import { HighlightCard } from "@/components/ff/cards";
import { StatusPill } from "@/components/ff/pill";
import { FiveShotTeaser, SHOTS_PER_GUEST } from "@/components/ff/shots";
import { JoinForm } from "./join-form";
import { CaptureSlots } from "./capture-slots";
import { DownloadOwnPhotosButton, OwnPhotoList, type OwnPhoto } from "./own-photos";

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

  if (state === "draft" || state === "active") {
    return (
      <GuestShell
        pill={
          <StatusPill tone="frosted" icon="clock">
            Not open yet
          </StatusPill>
        }
        title={event.name}
        subtitle={dateLabel}
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
    const ownCaptures = endedSession
      ? await listCapturesForGuestSessionWithUrls(event.id, endedSession.id)
      : [];
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
          eyebrow={[event.name, dateLabel].filter(Boolean).join(" · ")}
          title={`Thanks for sharing, ${name}!`}
          subtitle="Capture has ended. Here’s what you kept."
          width="wide"
          motifPhotos={kept.flatMap((p) => (p.thumbnailUrl ? [p.thumbnailUrl] : []))}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-heading font-bold text-ink">Your moments</h2>
            <span className="tabular text-caption font-semibold text-brand">
              {kept.length} of {SHOTS_PER_GUEST} kept
            </span>
          </div>
          <OwnPhotoList
            token={token}
            eventName={event.name}
            timezone={event.timezone}
            guestName={endedSession.display_name}
            sharingEnabled={event.sharing_enabled}
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
      <GuestShell pill={pill} title={event.name} subtitle={dateLabel}>
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
          subtitle={dateLabel}
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
        subtitle={dateLabel}
      >
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-title font-semibold text-ink">
            You’ve got {SHOTS_PER_GUEST} shots.
          </h2>
          <p className="text-body whitespace-pre-line text-ink-muted">
            {event.host_message ??
              "Catch the moments that matter to you. Every shot you keep goes into this event’s gallery."}
          </p>
        </div>
        <FiveShotTeaser />
        <TrustRow />
        <JoinForm token={token} />
      </GuestShell>
    );
  }

  await touchGuestSession(event.id, session.id);
  const captures = await listCapturesForGuestSessionWithUrls(event.id, session.id);

  return (
    <CaptureSlots
      token={token}
      eventId={event.id}
      eventName={event.name}
      eventDateLabel={dateLabel}
      timezone={event.timezone}
      guestName={session.display_name}
      sharingEnabled={event.sharing_enabled}
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
    />
  );
}

/**
 * Trust cues (product.md §4 principle 9, acceptance criterion 9): no app, no account, and
 * captures follow this event's own access rules — short, and no stronger than §8 delivers.
 */
function TrustRow() {
  return (
    <ul className="flex flex-col gap-2 rounded-lg bg-surface-subtle p-4 text-caption font-medium text-ink-muted">
      <TrustItem icon={<Smartphone />}>No app to download</TrustItem>
      <TrustItem icon={<UserX />}>No account — just your first name</TrustItem>
      <TrustItem icon={<ShieldCheck />}>Your photos follow this event’s own access settings</TrustItem>
    </ul>
  );
}

function TrustItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-brand">
      {icon}
      {children}
    </li>
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
