import { notFound, redirect } from "next/navigation";
import { CircleCheck, Clock, Lock, QrCode } from "lucide-react";
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
          One-time payment. Once confirmed, capture stays closed until you open it yourself.
        </p>
      </div>

      {checkout === "cancelled" && (
        <p className="rounded-lg border border-(--host-border) bg-(--host-surface) px-3 py-2.5 text-sm text-(--host-ink)">
          Payment was cancelled. Nothing was charged — you can try again below.
        </p>
      )}

      {isPending && checkout !== "cancelled" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-(--host-accent)/30 bg-(--host-accent)/8 px-3 py-2.5 text-sm text-(--host-ink)">
          <Clock className="mt-0.5 size-4 shrink-0 text-(--host-accent)" aria-hidden />
          <p>
            A payment attempt is already in progress for this event. Continuing below returns
            you to that same checkout — it won&rsquo;t start a second one or charge you twice.
          </p>
        </div>
      )}

      {/* What happens after paying — answers "what am I buying / what happens next" before the
          price, so a first-time host isn't left guessing what a "checkout" even produces here. */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-(--host-border) bg-(--host-canvas-raised) p-5">
        <h2 className="text-xs font-medium tracking-wide text-(--host-ink-muted) uppercase">
          What you get
        </h2>
        <div className="flex items-start gap-2.5 text-sm text-(--host-ink)">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-(--host-accent)" aria-hidden />
          <span>Your event link, printable QR, and signage — issued the moment payment is confirmed.</span>
        </div>
        <div className="flex items-start gap-2.5 text-sm text-(--host-ink)">
          <QrCode className="mt-0.5 size-4 shrink-0 text-(--host-accent)" aria-hidden />
          <span>Five frames per guest, for up to {event.guest_session_cap} guests — ready whenever you decide to open capture.</span>
        </div>
        <div className="flex items-start gap-2.5 text-sm text-(--host-ink-muted)">
          <Clock className="mt-0.5 size-4 shrink-0 text-(--host-ink-muted)" aria-hidden />
          <span>Guests can&rsquo;t capture yet — capture only opens when you explicitly open it, typically at the venue.</span>
        </div>
      </div>

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

      <form action={boundStartCheckout} className="flex flex-col gap-2">
        <Button
          type="submit"
          size="lg"
          className="w-full bg-(--host-accent) text-(--host-accent-foreground) hover:bg-(--host-accent)/90 sm:w-auto"
        >
          Continue to payment
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-(--host-ink-muted)">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          Pay with GCash, Maya, or card — handled securely by PayMongo. You&rsquo;ll return here
          automatically once it&rsquo;s done.
        </p>
      </form>

      {/* Informational only (product.md §7.2) — not a new state, and never a way for the
          host to declare their own payment. Always secondary to "Pay online" above. */}
      <p className="text-xs text-(--host-ink-muted)">
        Already arranged payment directly with FiveFrames? Your event will activate once we
        confirm receipt.
      </p>
    </div>
  );
}
