import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  Camera,
  CircleCheck,
  Clock,
  Download,
  Image as ImageIcon,
  Link2,
  Lock,
  Printer,
  QrCode,
} from "lucide-react";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { getLatestPaymentForEvent } from "@/lib/dal/payments";
import { firstName, formatEventDate } from "@/lib/events/format";
import { getRequestBaseUrl } from "@/lib/http/base-url";
import { qrSvgDataUri } from "@/lib/media/qr";
import {
  EVENT_PRICE_PHP,
  hasPendingProviderPayment,
  REFUND_POLICY_COPY,
} from "@/lib/payments/pricing";
import { saveDetailsStepAction, saveLookStepAction, startCheckoutAction } from "../../actions";
import { DetailsStepForm, LookStepForm } from "../../wizard-forms";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ff/button";
import { CopyLinkButton } from "@/components/ff/copy-button";
import {
  NextStepsTimeline,
  WizardActions,
  WizardShell,
  type WizardStep,
} from "@/components/ff/host/wizard";

export const metadata = { title: "Set up event · FiveFrames" };

/**
 * Create wizard for an existing event (D3 Details · D4 Look · D5 Share). Mapped onto the
 * accepted lifecycle without inventing states: Details and Look edit the draft; Share is where
 * a draft is activated by paying (product.md §7.2 — the link and QR only exist after payment,
 * invariant 7), and, once activated, where the QR and link are handed over.
 */
export default async function EventSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ step?: string; checkout?: string }>;
}) {
  const { eventId } = await params;
  const { step: stepParam, checkout } = await searchParams;
  const host = await requireHost();
  const event = await getEventForHost(host.id, eventId);
  if (!event) notFound();

  const activated = Boolean(event.activated_at);
  const requested = stepParam === "look" ? 2 : stepParam === "share" ? 3 : 1;
  // After activation, details and look live in Settings; the wizard only hands over the QR.
  if (activated && requested !== 3) redirect(`/events/${eventId}/settings`);
  const step: WizardStep = requested;

  const stepHref = (s: WizardStep) =>
    `/events/${eventId}/setup?step=${s === 1 ? "details" : s === 2 ? "look" : "share"}`;
  const shared = {
    step,
    closeHref: activated ? `/events/${eventId}` : "/dashboard",
    stepHref: activated ? undefined : stepHref,
    status: activated ? "Event activated" : "Draft saved",
    statusTone: activated ? ("success" as const) : ("muted" as const),
  };

  const timeline = [
    {
      title: "Now · Set it up",
      body: "Name it, add a welcome, then activate it.",
      icon: <CalendarCheck />,
      done: step > 1 || activated,
    },
    {
      title: "After payment · Share",
      body: "Print the QR or send the link.",
      icon: <Link2 />,
      done: activated,
    },
    { title: "On the day · Open capture", body: "Guests shoot once you switch it on.", icon: <Camera /> },
    { title: "After · Reveal", body: "Review, hide any photo, then reveal.", icon: <ImageIcon /> },
  ];

  if (step === 1) {
    return (
      <WizardShell
        {...shared}
        title="What’s the occasion?"
        subtitle="Name your event and pick its date."
        aside={<NextStepsTimeline items={timeline} />}
      >
        <DetailsStepForm
          action={saveDetailsStepAction.bind(null, eventId)}
          event={event}
          timezones={Intl.supportedValuesOf("timeZone")}
          cancelHref="/dashboard"
        />
      </WizardShell>
    );
  }

  if (step === 2) {
    return (
      <WizardShell
        {...shared}
        title="Make it yours"
        subtitle="Say hello to your guests and choose when the gallery opens."
        aside={<NextStepsTimeline items={timeline} />}
      >
        <LookStepForm
          action={saveLookStepAction.bind(null, eventId)}
          event={event}
          backHref={stepHref(1)}
        />
      </WizardShell>
    );
  }

  const dateLabel = formatEventDate(event.event_date, { year: true });
  const summary = (
    <div className="flex items-center gap-3 rounded-lg bg-surface-subtle p-3">
      <span aria-hidden className="ff-photo-header size-14 shrink-0 rounded-sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-heading text-[18px] leading-tight font-semibold break-words text-ink">
          {event.name}
        </p>
        <p className="text-caption font-medium text-ink-muted">
          {[dateLabel, event.timezone].filter(Boolean).join(" · ")}
        </p>
      </div>
      {!activated && (
        <Link
          href={stepHref(1)}
          className="ff-focus shrink-0 rounded-md text-label font-semibold text-brand hover:underline"
        >
          Edit
        </Link>
      )}
    </div>
  );

  if (!activated) {
    const latestPayment = await getLatestPaymentForEvent(host.id, eventId);
    const isPending = hasPendingProviderPayment(latestPayment);
    const name = firstName(host.name);

    return (
      <WizardShell
        {...shared}
        title={`Ready to activate${name ? `, ${name}` : ""}?`}
        subtitle="Pay once to get your event link and QR code. Capture stays closed until you open it."
        aside={<NextStepsTimeline items={timeline} />}
      >
        <div className="flex flex-col gap-5 lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:p-6">
          {summary}

          {checkout === "cancelled" && (
            <p role="status" className="rounded-lg border border-line p-4 text-label font-medium text-ink">
              Payment was cancelled. Nothing was charged — you can try again below.
            </p>
          )}
          {isPending && checkout !== "cancelled" && (
            <p role="status" className="flex items-start gap-3 rounded-lg bg-brand-tint p-4 text-label font-medium text-ink">
              <Clock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              A payment attempt is already in progress. Continuing returns you to that same
              checkout — it won’t start a second one or charge you twice.
            </p>
          )}

          <ul className="flex flex-col gap-2.5">
            <Benefit icon={<QrCode />}>
              Your event link, printable QR and signage — issued the moment payment is confirmed.
            </Benefit>
            <Benefit icon={<Camera />}>
              Five shots per guest, for up to {event.guest_session_cap} guests.
            </Benefit>
            <Benefit icon={<Clock />} muted>
              Guests can’t shoot yet — capture opens only when you switch it on.
            </Benefit>
          </ul>

          <dl className="flex flex-col gap-3 rounded-lg bg-surface-subtle p-4">
            <PriceRow label="FiveFrames event" value={`₱${EVENT_PRICE_PHP.toLocaleString()}`} />
            <PriceRow label="Processing fees" value="Included — nothing extra" />
            <div className="border-t border-line pt-3">
              <PriceRow label="Total today" value={`₱${EVENT_PRICE_PHP.toLocaleString()}`} strong />
            </div>
            <p className="text-caption font-medium text-ink-muted">{REFUND_POLICY_COPY}</p>
          </dl>
        </div>

        <form action={startCheckoutAction.bind(null, eventId)} className="contents">
          <WizardActions backHref={stepHref(2)}>
            <div className="flex flex-col gap-2 lg:items-end">
              <Button type="submit" className="w-full lg:w-auto lg:px-8">
                Pay online · ₱{EVENT_PRICE_PHP.toLocaleString()}
                <ArrowRight aria-hidden />
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-caption font-medium text-ink-muted">
                <Lock className="size-3.5" aria-hidden />
                GCash, Maya or card — handled securely by PayMongo.
              </p>
            </div>
          </WizardActions>
        </form>

        {/* Informational only (product.md §7.2) — not a state, and never a way for the host to
            declare their own payment. Always secondary to "Pay online". */}
        <p className="text-center text-caption font-medium text-ink-muted lg:text-left">
          Already arranged payment directly with FiveFrames? Your event will activate once we
          confirm receipt.
        </p>
      </WizardShell>
    );
  }

  const baseUrl = await getRequestBaseUrl();
  const capturePath = event.event_token ? `/e/${event.event_token}` : null;
  const qr = capturePath ? await qrSvgDataUri(`${baseUrl}${capturePath}`) : null;
  const displayHost = baseUrl.replace(/^https?:\/\//, "");
  const name = firstName(host.name);

  return (
    <WizardShell
      {...shared}
      title={`You’re all set${name ? `, ${name}` : ""}!`}
      subtitle="Share the QR code or link so guests can join on the day."
      aside={<NextStepsTimeline items={timeline} />}
    >
      <div className="flex flex-col gap-5 lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:p-6">
        {summary}
        {capturePath && qr ? (
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered QR data URI */}
            <img
              src={qr}
              alt="QR code for the guest capture link"
              className="size-[180px] shrink-0 rounded-lg border border-line bg-surface p-4"
            />
            <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
              <p className="text-label font-semibold text-ink">Event link</p>
              <div className="flex items-center gap-2 rounded-md border border-line bg-surface-subtle p-1.5 pl-4">
                <span className="min-w-0 flex-1 truncate text-label font-medium text-ink" title={`${displayHost}${capturePath}`}>
                  {displayHost}
                  {capturePath}
                </span>
                <CopyLinkButton path={capturePath} label="Copy" size="compact" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ButtonAnchor href={`/events/${eventId}/signage/qr`} download variant="secondary" size="sm">
                  <Download aria-hidden />
                  Download QR
                </ButtonAnchor>
                <ButtonAnchor href={`/events/${eventId}/signage/table-card`} download variant="secondary" size="sm">
                  <Printer aria-hidden />
                  Table card
                </ButtonAnchor>
              </div>
              <p className="text-caption font-medium text-ink-muted">
                Tip: print the QR on table cards or show it on a screen near the entrance. A poster
                and phone-screen version are on your dashboard.
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-surface-subtle p-4 text-label font-medium text-ink-muted">
            The capture link is currently revoked. Create a new one in Settings → Links.
          </p>
        )}
      </div>
      <WizardActions>
        <ButtonLink href={`/events/${eventId}`} className="w-full lg:w-auto lg:px-8">
          Go to event dashboard
          <ArrowRight aria-hidden />
        </ButtonLink>
      </WizardActions>
      <p className="flex items-center justify-center gap-1.5 text-caption font-medium text-ink-muted lg:justify-start">
        <CircleCheck className="size-3.5 text-success" aria-hidden />
        Guests who scan early will see a calm “not open yet” screen until you open capture.
      </p>
    </WizardShell>
  );
}

function Benefit({
  icon,
  muted,
  children,
}: {
  icon: React.ReactNode;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`flex items-start gap-3 text-label font-medium [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 ${
        muted ? "text-ink-muted [&_svg]:text-ink-muted" : "text-ink [&_svg]:text-brand"
      }`}
    >
      {icon}
      <span>{children}</span>
    </li>
  );
}

function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "text-label font-bold text-ink" : "text-label font-medium text-ink-muted"}>
        {label}
      </dt>
      <dd className={`tabular text-label ${strong ? "font-extrabold text-ink" : "font-semibold text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}
