import { getEventByToken } from "@/lib/dal/events";
import { getGuestSession, touchGuestSession } from "@/lib/dal/guest-sessions";
import { listCapturesForGuestSession } from "@/lib/dal/captures";
import { getGuestSessionIdFromCookie } from "@/lib/auth/guest-session";
import { deriveEventLifecycleState } from "@/lib/events/lifecycle";
import { JoinForm } from "./join-form";
import { CaptureSlots } from "./capture-slots";

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
    return (
      <CalmState
        title="Capture has ended"
        body="Thanks for being part of this. Your host will share the gallery when it's ready."
      />
    );
  }

  const guestSessionId = await getGuestSessionIdFromCookie(token, event.id);
  const session = guestSessionId
    ? await getGuestSession(event.id, guestSessionId)
    : null;

  if (!session) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">{event.name}</h1>
          {event.host_message && (
            <p className="mt-1 text-sm text-muted-foreground">{event.host_message}</p>
          )}
        </div>
        <JoinForm token={token} />
      </div>
    );
  }

  await touchGuestSession(event.id, session.id);
  const captures = await listCapturesForGuestSession(event.id, session.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">{event.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capturing as {session.display_name}
        </p>
      </div>
      <CaptureSlots
        token={token}
        eventId={event.id}
        initialCaptures={captures.map((c) => ({
          id: c.id,
          slotIndex: c.slot_index,
          status: c.status as "pending" | "committed",
        }))}
      />
    </div>
  );
}

function CalmState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
