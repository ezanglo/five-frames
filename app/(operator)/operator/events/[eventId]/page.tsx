import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleAlert, ShieldCheck } from "lucide-react";
import { paymentAuditRows, type OperatorPaymentView } from "@/lib/payments/audit";
import { getOperatorEventDetail } from "@/lib/dal/operator-events";
import {
  listCapacityOverridesForOperator,
  MAX_GUEST_SESSION_CAP,
  MAX_OVERRIDE_REASON_LENGTH,
  type CapacityOverrideView,
} from "@/lib/dal/capacity-overrides";
import { requireOperator } from "@/lib/auth/operator-session";
import { isDuplicatePayment } from "@/lib/dal/payments";
import { formatEventDate, formatEventDateTime } from "@/lib/events/format";
import { REVEAL_MODE_LABEL, VISIBILITY_LABEL } from "@/lib/events/labels";
import { deriveEventLifecycleState, isGalleryRevealed } from "@/lib/events/lifecycle";
import { utcIsoToZonedDateTimeLocal } from "@/lib/events/timezone";
import { isPaidPlanId, PAID_PLANS, PLANS } from "@/lib/plans/registry";
import { SectionCard, StatTile } from "@/components/ff/cards";
import { EventStatusBadge, eventStatusKey } from "@/components/ff/event-status";
import { StatusPill } from "@/components/ff/pill";
import { ManualPaymentForm } from "@/app/(operator)/operator/events/[eventId]/manual-payment-form";
import { ManualRefundForm } from "@/app/(operator)/operator/events/[eventId]/manual-refund-form";
import { CapacityOverrideForm } from "@/app/(operator)/operator/events/[eventId]/capacity-override-form";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-caption font-medium text-ink-muted">{label}</dt>
      <dd className="text-right text-label font-semibold break-words text-ink">{value}</dd>
    </div>
  );
}

/** "Now" in the event's timezone, as a datetime-local value — computed on the server so the
 * form's default can't drift with the operator's browser timezone. */
function nowInEventTimezone(timezone: string): string {
  return utcIsoToZonedDateTimeLocal(new Date().toISOString(), timezone);
}

export default async function OperatorEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [operator, detail, overrides] = await Promise.all([
    requireOperator(),
    getOperatorEventDetail(eventId),
    listCapacityOverridesForOperator(eventId),
  ]);
  if (!detail) notFound();

  const { event, hostEmail, captureCounts, payments } = detail;
  const tz = event.timezone;
  const when = (iso: string | null) => formatEventDateTime(iso, tz, { year: true }) ?? "—";
  const duplicatePayments = payments.filter((p) => isDuplicatePayment(p, event));
  const state = deriveEventLifecycleState(event);
  const revealed = isGalleryRevealed(event);
  const eventDate = formatEventDate(event.event_date, { year: true });

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/operator"
          className="ff-focus flex w-fit items-center gap-1 rounded-md text-label font-medium text-ink-muted hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          All events
        </Link>
        <EventStatusBadge status={eventStatusKey(event)} />
        <h1 className="font-heading text-display font-semibold break-words text-ink lg:text-page-desktop">
          {event.name}
        </h1>
        <p className="text-caption font-medium break-all text-ink-muted">
          {[eventDate, `Host ${hostEmail}`, `Event id ${event.id}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5 lg:gap-6">
          <SectionCard title="Capture and moderation" caption="Aggregate counts only.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile tone="tint" value={captureCounts.committed} label="Committed photos" />
              <StatTile
                value={`${event.guest_session_count}`}
                label={`Guest sessions of ${event.guest_session_cap}`}
              />
              <StatTile value={captureCounts.pending} label="Pending uploads" />
              <StatTile value={captureCounts.hidden} label="Hidden" />
              <StatTile value={captureCounts.deleted} label="Deleted" />
              <StatTile value={captureCounts.favorited} label="Favorited" />
            </div>
          </SectionCard>

          <SectionCard title="Lifecycle" caption={`Times in ${tz.replaceAll("_", " ")}.`}>
            <dl className="flex flex-col">
              <Row label="Plan" value={event.plan ? PLANS[event.plan].label : "Not chosen"} />
              <Row label="Activated" value={when(event.activated_at)} />
              <Row label="Capture opened" value={when(event.capture_opened_at)} />
              <Row label="Capture closed" value={when(event.capture_closed_at)} />
              <Row label="Safety-net close" value={when(event.safety_net_closes_at)} />
              <Row label="Hosted until" value={when(event.hosted_until)} />
              <Row label="Grace period until" value={when(event.grace_until)} />
              <Row
                label="Permanent deletion"
                value={
                  event.media_deleted_at
                    ? `Completed ${when(event.media_deleted_at)}`
                    : state === "archived"
                      ? "Pending (grace period ended)"
                      : "Not yet eligible"
                }
              />
            </dl>
          </SectionCard>

          <SectionCard title="Gallery">
            <dl className="flex flex-col">
              <Row label="Reveal timing" value={REVEAL_MODE_LABEL[event.reveal_mode]} />
              {event.reveal_mode === "custom" && (
                <Row label="Reveal time" value={when(event.reveal_at)} />
              )}
              <Row label="Revealed now" value={revealed ? "Yes" : "No"} />
              <Row label="Visibility" value={VISIBILITY_LABEL[event.visibility]} />
            </dl>
          </SectionCard>
        </div>

        <aside className="flex flex-col gap-5 lg:gap-6">
          <SectionCard
            title="Payment"
            caption={`Times in ${tz.replaceAll("_", " ")}.`}
            action={
              event.activated_at ? (
                <StatusPill size="sm" tone="success" icon="check">
                  {event.plan === "free" ? "Free · Activated" : "Paid · Activated"}
                </StatusPill>
              ) : (
                <StatusPill size="sm">Unpaid</StatusPill>
              )
            }
          >
            {payments.length === 0 ? (
              <p className="text-caption font-medium text-ink-muted">
                {event.activated_at && event.plan === "free"
                  ? "The host activated their account’s Free event. No payment was made."
                  : "No payment attempt yet."}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {payments.map((payment) => (
                  <PaymentAttempt
                    key={payment.id}
                    payment={payment}
                    duplicate={isDuplicatePayment(payment, event)}
                    timezone={tz}
                  />
                ))}
              </ul>
            )}
            {duplicatePayments.length > 0 && (
              <div className="flex gap-3 rounded-lg border border-danger-line bg-danger-tint p-4">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
                <p className="text-caption font-medium text-ink">
                  <span className="font-bold text-danger">
                    {duplicatePayments.length} duplicate payment
                    {duplicatePayments.length === 1 ? "" : "s"}.
                  </span>{" "}
                  The event activated from a different payment, so this one never activated
                  anything. Follow up manually (provider: PayMongo&rsquo;s own dashboard; manual:
                  return the funds outside FiveFrames) per product.md §15.1 — no automatic refund
                  is issued.
                </p>
              </div>
            )}
          </SectionCard>

          <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 lg:rounded-3xl lg:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                <ShieldCheck aria-hidden className="size-5" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2 className="text-[16px] leading-snug font-bold text-ink">
                  {event.activated_at
                    ? event.plan === "free"
                      ? "Nothing to refund"
                      : "Record a manual refund"
                    : "Confirm a manual payment"}
                </h2>
                <p className="text-caption font-medium text-ink-muted">
                  Privileged action · recorded under your operator account.
                </p>
              </div>
            </div>
            {event.activated_at && event.plan === "free" ? (
              // Nothing was paid, so there is nothing to refund (recordManualRefund refuses too).
              <p className="text-caption font-medium text-ink-muted">
                This is a Free event. There is no payment to refund.
              </p>
            ) : event.activated_at ? (
              <ManualRefundForm eventId={event.id} />
            ) : isPaidPlanId(event.plan) ? (
              <ManualPaymentForm
                eventId={event.id}
                plan={event.plan}
                timezone={tz}
                defaultPaidAt={nowInEventTimezone(tz)}
              />
            ) : (
              <p className="text-caption font-medium text-ink-muted">
                {event.plan === "free"
                  ? "The host chose Free, which they activate themselves. "
                  : "The host hasn’t chosen a paid plan yet. "}
                Payment can be confirmed once they choose{" "}
                {PAID_PLANS.map((p) => p.label).join(" or ")} on their Share step.
              </p>
            )}
          </section>

          <SectionCard
            title="Capacity"
            caption={`Times in ${tz.replaceAll("_", " ")}.`}
            action={
              <span className="text-label font-semibold text-ink tabular">
                {event.guest_session_count} of {event.guest_session_cap} guests
              </span>
            }
          >
            {!event.activated_at ? (
              <p className="text-caption font-medium text-ink-muted">
                Capacity comes from the plan when the event is activated. It can be raised after
                that.
              </p>
            ) : event.host_id === operator.id ? (
              // overrideGuestCapacity refuses this too; the form isn't offered.
              <p className="text-caption font-medium text-ink-muted">
                You own this event, so you can&rsquo;t raise its capacity. Ask another operator.
              </p>
            ) : (
              <CapacityOverrideForm
                eventId={event.id}
                currentCap={event.guest_session_cap}
                maxCap={MAX_GUEST_SESSION_CAP}
                maxReasonLength={MAX_OVERRIDE_REASON_LENGTH}
              />
            )}
            {event.activated_at && (
              <CapacityHistory
                overrides={overrides}
                currentCap={event.guest_session_cap}
                planLabel={event.plan ? PLANS[event.plan].label : null}
                when={when}
              />
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

function PaymentAttempt({
  payment,
  duplicate,
  timezone,
}: {
  payment: OperatorPaymentView;
  duplicate: boolean;
  timezone: string;
}) {
  return (
    <li
      className={
        duplicate
          ? "rounded-lg border border-danger-line bg-surface p-3"
          : "rounded-lg bg-surface-subtle p-3"
      }
    >
      <dl className="flex flex-col">
        {paymentAuditRows(payment, { duplicate, timezone }).map((row) => (
          <Row
            key={row.label}
            label={row.label}
            value={
              row.danger ? (
                <span className="text-danger">{row.value}</span>
              ) : row.label === "Amount" ? (
                <span className="tabular">{row.value}</span>
              ) : (
                row.value
              )
            }
          />
        ))}
      </dl>
    </li>
  );
}

/**
 * Newest first, ending at the cap the event started with (product.md §5.1). The starting cap is
 * read from the log itself (the oldest entry's previous cap), not from today's registry, which
 * may have changed since this event was activated.
 */
function CapacityHistory({
  overrides,
  currentCap,
  planLabel,
  when,
}: {
  overrides: CapacityOverrideView[];
  currentCap: number;
  planLabel: string | null;
  when: (iso: string | null) => string;
}) {
  const startingCap = overrides.at(-1)?.previous_cap ?? currentCap;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="text-label font-semibold text-ink">History</h3>
      <ol className="flex flex-col gap-2">
        {overrides.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1 rounded-lg bg-surface-subtle p-3">
            <p className="text-label font-semibold text-ink tabular">
              {entry.previous_cap} → {entry.new_cap} guests
            </p>
            <p className="text-caption font-medium break-words text-ink">{entry.reason}</p>
            <p className="text-caption font-medium break-all text-ink-muted">
              {when(entry.created_at)} · {entry.operatorEmail ?? "Unknown operator"}
            </p>
          </li>
        ))}
        <li className="rounded-lg border border-line p-3">
          <p className="text-caption font-medium text-ink-muted">
            <span className="font-semibold text-ink tabular">{startingCap} guests</span>,{" "}
            {planLabel ? `the ${planLabel} plan’s capacity` : "the plan’s capacity"} at activation
          </p>
        </li>
      </ol>
    </div>
  );
}
