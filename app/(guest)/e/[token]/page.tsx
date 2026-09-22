import type { ReactNode } from "react";
import { getEventByToken } from "@/lib/dal/events";
import { getGuestSession, touchGuestSession } from "@/lib/dal/guest-sessions";
import { listCapturesForGuestSessionWithUrls } from "@/lib/dal/captures";
import { getGuestSessionIdFromCookie } from "@/lib/auth/guest-session";
import { deriveEventLifecycleState, hasReachedGuestCapacity } from "@/lib/events/lifecycle";
import { JoinForm } from "./join-form";
import { CaptureSlots } from "./capture-slots";
import { OwnCaptures } from "./own-captures";

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
        title="We can't find this event"
        body="Double-check the link or QR code with your host."
      />
    );
  }

  const state = deriveEventLifecycleState(event);

  if (state === "draft" || state === "active") {
    return (
      <CalmState
        title="Not open yet"
        body="Capture hasn't started for this event. Check back once your host opens it."
      />
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

    return (
      <CalmState
        title="Capture has ended"
        body="Thanks for being part of this. Your host will share the gallery when it's ready."
      >
        <OwnCaptures
          token={token}
          eventName={event.name}
          sharingEnabled={event.sharing_enabled}
          captures={ownCaptures
            .filter((c) => c.thumbnailUrl && c.downloadUrl)
            .map((c) => ({ id: c.id, thumbnailUrl: c.thumbnailUrl!, downloadUrl: c.downloadUrl! }))}
        />
      </CalmState>
    );
  }

  const guestSessionId = await getGuestSessionIdFromCookie(token, event.id);
  const session = guestSessionId
    ? await getGuestSession(event.id, guestSessionId)
    : null;

  if (!session) {
    // A guest-session-cap check here is only ever a UX nicety for a fresh visitor — the
    // atomic join_guest_session() call re-checks the same condition regardless (product.md
    // §9.5, decision D13), so a race between this read and the guest's submit can't let the
    // event grow past its cap.
    if (hasReachedGuestCapacity(event)) {
      return (
        <CalmState
          title="This event is full"
          body="This event has reached its guest capacity for now. Guests who already joined can keep capturing — check back with your host."
        />
      );
    }

    return (
      <div className="flex flex-1 flex-col gap-8">
        <EventIdentity name={event.name} hostMessage={event.host_message} />
        <JoinForm token={token} />
      </div>
    );
  }

  await touchGuestSession(event.id, session.id);
  const captures = await listCapturesForGuestSessionWithUrls(event.id, session.id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <EventIdentity name={event.name} hostMessage={session.display_name} isGuestLine />
      <CaptureSlots
        token={token}
        eventId={event.id}
        eventName={event.name}
        sharingEnabled={event.sharing_enabled}
        initialCaptures={captures.map((c) => ({
          id: c.id,
          slotIndex: c.slotIndex,
          status: c.status as "pending" | "committed",
          thumbnailUrl: c.thumbnailUrl,
          downloadUrl: c.downloadUrl,
        }))}
      />
    </div>
  );
}

/** Compact, quiet identity — the five frames are the hero, not the event header. */
function EventIdentity({
  name,
  hostMessage,
  isGuestLine,
}: {
  name: string;
  hostMessage: string | null;
  isGuestLine?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <h1 className="font-guest-display text-xl font-semibold text-(--guest-ink)">{name}</h1>
      {hostMessage && (
        <p className="text-sm text-(--guest-ink-muted)">
          {isGuestLine ? `Capturing as ${hostMessage}` : hostMessage}
        </p>
      )}
    </div>
  );
}

function CalmState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-guest-display text-xl font-semibold text-(--guest-ink)">{title}</h1>
        <p className="max-w-xs text-sm text-(--guest-ink-muted)">{body}</p>
      </div>
      {children}
    </div>
  );
}
