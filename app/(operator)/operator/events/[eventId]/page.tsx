import Link from "next/link";
import { notFound } from "next/navigation";
import { getOperatorEventDetail } from "@/lib/dal/operator-events";
import {
  deriveEventLifecycleState,
  EVENT_LIFECYCLE_STATE_LABEL,
  isGalleryRevealed,
} from "@/lib/events/lifecycle";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-(--host-border) py-3 last:border-b-0">
      <span className="text-sm text-(--host-ink-muted)">{label}</span>
      <span className="text-sm text-(--host-ink)">{value}</span>
    </div>
  );
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export default async function OperatorEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const detail = await getOperatorEventDetail(eventId);
  if (!detail) notFound();

  const { event, hostEmail, captureCounts } = detail;
  const state = deriveEventLifecycleState(event);
  const revealed = isGalleryRevealed(event);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/operator"
          className="text-sm text-(--host-ink-muted) hover:text-(--host-ink)"
        >
          ← All events
        </Link>
        <h1 className="mt-1 font-host-display text-xl font-semibold text-(--host-ink)">
          {event.name}
        </h1>
        <p className="mt-0.5 text-sm text-(--host-ink-muted)">
          Host: {hostEmail} · Event id: {event.id}
        </p>
      </div>

      <section className="rounded-2xl border border-(--host-border) bg-(--host-canvas-raised) px-4">
        <h2 className="pt-4 pb-1 text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
          Lifecycle
        </h2>
        <Row label="State" value={EVENT_LIFECYCLE_STATE_LABEL[state]} />
        <Row label="Activated" value={formatDate(event.activated_at)} />
        <Row label="Capture opened" value={formatDate(event.capture_opened_at)} />
        <Row label="Capture closed" value={formatDate(event.capture_closed_at)} />
        <Row
          label="Safety-net close deadline"
          value={formatDate(event.safety_net_closes_at)}
        />
        <Row label="Hosted until (expiry)" value={formatDate(event.hosted_until)} />
        <Row label="Grace period until" value={formatDate(event.grace_until)} />
      </section>

      <section className="rounded-2xl border border-(--host-border) bg-(--host-canvas-raised) px-4">
        <h2 className="pt-4 pb-1 text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
          Payment
        </h2>
        <Row
          label="State"
          value={event.activated_at ? "Paid / activated" : "Unpaid"}
        />
        <Row
          label="Source"
          value="Not yet tracked — payment records land in Slice 8/9"
        />
      </section>

      <section className="rounded-2xl border border-(--host-border) bg-(--host-canvas-raised) px-4">
        <h2 className="pt-4 pb-1 text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
          Guests and capture
        </h2>
        <Row
          label="Joined guest sessions"
          value={`${event.guest_session_count} of ${event.guest_session_cap} cap`}
        />
        <Row
          label="Committed photos"
          value={captureCounts.committed}
        />
        <Row label="Pending (in progress)" value={captureCounts.pending} />
        <Row label="Hidden (moderated)" value={captureCounts.hidden} />
        <Row label="Deleted (moderated)" value={captureCounts.deleted} />
        <Row label="Favorited" value={captureCounts.favorited} />
      </section>

      <section className="rounded-2xl border border-(--host-border) bg-(--host-canvas-raised) px-4">
        <h2 className="pt-4 pb-1 text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
          Gallery
        </h2>
        <Row label="Reveal mode" value={event.reveal_mode} />
        <Row label="Revealed now" value={revealed ? "Yes" : "No"} />
        <Row
          label="Visibility"
          value={
            event.visibility === "only_me" ? "Only the host" : "Anyone with the link"
          }
        />
      </section>
    </div>
  );
}
