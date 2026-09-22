import { notFound, redirect } from "next/navigation";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { getLatestPaymentForEvent } from "@/lib/dal/payments";
import { EVENT_PRICE_PHP, hasPendingProviderPayment, REFUND_POLICY_COPY } from "@/lib/payments/pricing";
import { startCheckoutAction } from "@/app/(host)/events/actions";
import { Button } from "@/components/ui/button";

export default async function EventCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { eventId } = await params;
  const { checkout } = await searchParams;
  const host = await requireHost();

  const event = await getEventForHost(host.id, eventId);
  if (!event) notFound();

  if (event.activated_at) {
    redirect(`/events/${eventId}`);
  }

  const latestPayment = await getLatestPaymentForEvent(host.id, eventId);
  const boundStartCheckout = startCheckoutAction.bind(null, eventId);

  const isPending = hasPendingProviderPayment(latestPayment);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-host-display text-2xl font-semibold text-(--host-ink)">
          Pay for {event.name}
        </h1>
        <p className="mt-1 text-sm text-(--host-ink-muted)">
          Your event link, printable QR, and signage are issued once payment is confirmed.
        </p>
      </div>

      {checkout === "cancelled" && (
        <p className="rounded-lg bg-(--host-surface) px-3 py-2 text-sm text-(--host-ink)">
          Payment was cancelled. Nothing was charged — you can try again below.
        </p>
      )}

      {isPending && checkout !== "cancelled" && (
        <p className="rounded-lg bg-(--host-surface) px-3 py-2 text-sm text-(--host-ink-muted)">
          You already have a payment attempt in progress for this event. Continuing below
          returns you to that same checkout — it won&rsquo;t start a second one or charge you
          twice.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-(--host-border) bg-(--host-canvas-raised) p-5">
        <h2 className="text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
          Price breakdown
        </h2>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-(--host-ink-muted)">FiveFrames event</span>
          <span className="text-sm text-(--host-ink)">₱{EVENT_PRICE_PHP.toLocaleString()}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-(--host-ink-muted)">Processing fees</span>
          <span className="text-sm text-(--host-ink)">Included — nothing extra charged</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-(--host-border) pt-3">
          <span className="text-sm font-medium text-(--host-ink)">Total charged today</span>
          <span className="text-sm font-medium text-(--host-ink)">
            ₱{EVENT_PRICE_PHP.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-(--host-ink-muted)">{REFUND_POLICY_COPY}</p>
      </div>

      <form action={boundStartCheckout}>
        <Button
          type="submit"
          size="lg"
          className="w-full bg-(--host-accent) text-(--host-accent-foreground) hover:bg-(--host-accent)/90 sm:w-auto"
        >
          Continue to payment (GCash, Maya, or card)
        </Button>
      </form>
    </div>
  );
}
