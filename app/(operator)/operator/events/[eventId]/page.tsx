import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { getOperatorEventDetail } from "@/lib/dal/operator-events";
import { deriveEventLifecycleState, isGalleryRevealed } from "@/lib/events/lifecycle";
import { StatePill } from "@/app/(operator)/state-indicator";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-(--operator-ink-muted)">{label}</span>
      <span className="text-sm text-(--operator-ink)">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-(--operator-border) pt-4 first:border-t-0 first:pt-0">
      <h2 className="pb-1 text-xs font-medium tracking-wide text-(--operator-ink-muted) uppercase">
        {title}
      </h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function ReservedAction({
  label,
  note,
}: {
  label: string;
  note: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-(--operator-privileged)/35 px-3 py-2.5">
      <Lock aria-hidden className="size-3.5 shrink-0 text-(--operator-privileged)/60" />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-(--operator-privileged)/80">
          {label}
        </span>
        <span className="text-xs text-(--operator-ink-muted)">{note}</span>
      </div>
    </div>
  );
}

export default async function OperatorEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const detail = await getOperatorEventDetail(eventId);
  if (!detail) notFound();

  const { event, hostEmail, captureCounts, latestPayment } = detail;
  const state = deriveEventLifecycleState(event);
  const revealed = isGalleryRevealed(event);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/operator"
          className="text-sm text-(--operator-ink-muted) hover:text-(--operator-ink)"
        >
          ← All events
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-operator-display text-lg font-semibold wrap-break-word text-(--operator-ink)">
            {event.name}
          </h1>
          <StatePill state={state} />
        </div>
        <p className="mt-0.5 truncate text-sm text-(--operator-ink-muted)">
          Host: {hostEmail} · Event id: {event.id}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <Section title="Lifecycle">
            <Row label="Activated" value={formatDate(event.activated_at)} />
            <Row label="Capture opened" value={formatDate(event.capture_opened_at)} />
            <Row label="Capture closed" value={formatDate(event.capture_closed_at)} />
            <Row
              label="Safety-net close deadline"
              value={formatDate(event.safety_net_closes_at)}
            />
            <Row label="Hosted until (expiry)" value={formatDate(event.hosted_until)} />
            <Row label="Grace period until" value={formatDate(event.grace_until)} />
          </Section>

          <Section title="Guests and capacity">
            <Row
              label="Joined guest sessions"
              value={`${event.guest_session_count} of ${event.guest_session_cap} cap`}
            />
          </Section>

          <Section title="Capture and moderation">
            <Row label="Committed photos" value={captureCounts.committed} />
            <Row label="Pending (in progress)" value={captureCounts.pending} />
            <Row label="Hidden (moderated)" value={captureCounts.hidden} />
            <Row label="Deleted (moderated)" value={captureCounts.deleted} />
            <Row label="Favorited" value={captureCounts.favorited} />
          </Section>

          <Section title="Gallery">
            <Row label="Reveal mode" value={event.reveal_mode} />
            <Row label="Revealed now" value={revealed ? "Yes" : "No"} />
            <Row
              label="Visibility"
              value={
                event.visibility === "only_me" ? "Only the host" : "Anyone with the link"
              }
            />
          </Section>
        </div>

        <aside className="flex flex-col gap-4 rounded-2xl border border-(--operator-border) bg-(--operator-canvas-raised) p-4">
          <div>
            <h2 className="pb-1 text-xs font-medium tracking-wide text-(--operator-ink-muted) uppercase">
              Payment
            </h2>
            <Row
              label="State"
              value={event.activated_at ? "Paid / activated" : "Unpaid"}
            />
            <Row
              label="Source"
              value={
                latestPayment
                  ? latestPayment.source === "provider"
                    ? "PayMongo (self-service)"
                    : "Manual — reserved for Slice 9"
                  : "No payment attempt yet"
              }
            />
            {latestPayment?.source === "provider" && (
              <>
                <Row label="Provider status" value={latestPayment.provider_status ?? "—"} />
                <Row
                  label="Amount"
                  value={
                    latestPayment.amount != null
                      ? `₱${(latestPayment.amount / 100).toLocaleString()} ${latestPayment.currency ?? ""}`
                      : "—"
                  }
                />
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-(--operator-border) pt-4">
            <h2 className="text-xs font-medium tracking-wide text-(--operator-privileged)/70 uppercase">
              Manual payment actions
            </h2>
            <ReservedAction
              label="Confirm manual payment"
              note="Reserved for Slice 9 — not yet available"
            />
            <ReservedAction
              label="Record a refund"
              note="Reserved for Slice 9 — not yet available"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
