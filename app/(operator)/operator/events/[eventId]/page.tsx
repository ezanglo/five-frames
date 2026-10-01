import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleAlert, ShieldCheck } from "lucide-react";
import { paymentAuditRows, type OperatorPaymentView } from "@/lib/payments/audit";
import { getOperatorEventDetail } from "@/lib/dal/operator-events";
import { isDuplicatePayment } from "@/lib/dal/payments";
import { formatEventDate, formatEventDateTime } from "@/lib/events/format";
import { REVEAL_MODE_LABEL, VISIBILITY_LABEL } from "@/lib/events/labels";
import { deriveEventLifecycleState, isGalleryRevealed } from "@/lib/events/lifecycle";
import { utcIsoToZonedDateTimeLocal } from "@/lib/events/timezone";
import { SectionCard, StatTile } from "@/components/ff/cards";
import { EventStatusBadge, eventStatusKey } from "@/components/ff/event-status";
import { StatusPill } from "@/components/ff/pill";
import { ManualPaymentForm } from "@/app/(operator)/operator/events/[eventId]/manual-payment-form";
import { ManualRefundForm } from "@/app/(operator)/operator/events/[eventId]/manual-refund-form";

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
  const detail = await getOperatorEventDetail(eventId);
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
                  Paid · Activated
                </StatusPill>
              ) : (
                <StatusPill size="sm">Unpaid</StatusPill>
              )
            }
          >
            {payments.length === 0 ? (
              <p className="text-caption font-medium text-ink-muted">No payment attempt yet.</p>
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
                  {event.activated_at ? "Record a manual refund" : "Confirm a manual payment"}
                </h2>
                <p className="text-caption font-medium text-ink-muted">
                  Privileged action · recorded under your operator account.
                </p>
              </div>
            </div>
            {event.activated_at ? (
              <ManualRefundForm eventId={event.id} />
            ) : (
              <ManualPaymentForm
                eventId={event.id}
                timezone={tz}
                defaultPaidAt={nowInEventTimezone(tz)}
              />
            )}
          </section>
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
