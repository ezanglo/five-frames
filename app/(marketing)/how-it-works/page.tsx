import type { ReactNode } from "react";
import Link from "next/link";
import {
  Check,
  Fingerprint,
  Hourglass,
  Lock,
  Power,
  Smile,
  WifiLow,
} from "lucide-react";
import { ButtonLink } from "@/components/ff/button";
import { StatusPill, type PillIcon } from "@/components/ff/pill";
import { CtaBand } from "@/components/ff/marketing/blocks";
import {
  HostDashboardVisual,
  JoinScreen,
  YourFiveScreen,
} from "@/components/ff/marketing/product-screens";
import { FeatureCard, PageHero, Section, SectionHeader } from "@/components/ff/marketing/section";
import { FRAMES, HOSTED_ACCESS_LABEL, PAYMENT_COPY, PRICE_LABEL } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "How it works",
  description:
    "How FiveFrames works for hosts and guests: create your event, pay once, share the QR, open capture on the day, and reveal a private collection of five photos from every guest.",
  path: "/how-it-works",
});

/** The event lifecycle as hosts see it — the same status names as the host dashboard badges. */
const LIFECYCLE: { status: string; icon: PillIcon; host: string; guests: string }[] = [
  {
    status: "Draft",
    icon: "draft",
    host: "Set up your event and change anything you like.",
    guests: "Nothing yet — there’s no link or QR code until you pay.",
  },
  {
    status: "Upcoming",
    icon: "clock",
    host: "Paid and active. Your link, QR code and signage are ready.",
    guests: "Anyone who scans early sees a calm “not open yet” screen.",
  },
  {
    status: "Open",
    icon: "live",
    host: "You’ve opened capture. Counts refresh as guests join and keep photos.",
    guests: `Guests join with a first name and take up to ${FRAMES} photos each.`,
  },
  {
    status: "Closed",
    icon: "lock",
    host: "Capture has ended. Review, hide or favorite photos.",
    guests: "Guests can still see and download the photos they kept.",
  },
  {
    status: "Gallery revealed",
    icon: "check",
    host: `Share the gallery link and download originals for ${HOSTED_ACCESS_LABEL}.`,
    guests: "Anyone you share the gallery link with can view it, if you allow that.",
  },
];

const HOST_STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Create and configure",
    body: "Give your event a name, date and timezone, write a welcome message for guests, and choose when the gallery opens, who can see it, and whether guests can share. If you like, give it a look: one image, an accent color and a hashtag. Everything can be set up before you pay.",
  },
  {
    title: "Pay once to activate",
    body: PAYMENT_COPY.hostStep,
  },
  {
    title: "Get your link, QR and signage",
    body: "The moment payment is confirmed, your event link and QR code exist, along with a table card, a poster and a phone-screen version to print or send.",
  },
  {
    title: "Open capture when you’re ready",
    body: "Paying doesn’t open capture, and neither does your event date. You switch it on — usually once everyone has arrived — and can close it again whenever you like.",
  },
  {
    title: "Watch it come together",
    body: "Your dashboard shows how many guests have joined and how many photos they’ve kept, refreshing on its own every few seconds.",
  },
  {
    title: "Look after the photos",
    body: "Hide, unhide, delete or favorite any photo. Hiding or deleting also removes it from that guest’s own view.",
  },
  {
    title: "Reveal the gallery",
    body: "By default it opens once capture closes. You can also reveal it right away or at a time you set, and choose between anyone with the gallery link or only you. Pick how it’s laid out, too: Masonry keeps every photo in its own shape, Rows lines them up across the page, and Grid shows even squares.",
  },
  {
    title: "Download and keep",
    body: `Download every original, one at a time or all at once. Your collection stays in your dashboard for ${HOSTED_ACCESS_LABEL}, with a warning before it ends.`,
  },
];

const GUEST_STEPS: { title: string; body: string }[] = [
  {
    title: "Scan the QR or open the link",
    body: "The event opens in the phone’s browser. There’s nothing to install.",
  },
  {
    title: "Enter a first name",
    body: "That’s the whole sign-up — no account, no email, no code.",
  },
  {
    title: `Get exactly ${FRAMES} frames`,
    body: "Frames are shown quietly and factually. There’s no timer and nothing to finish.",
  },
  {
    title: "Take a photo and preview it",
    body: "Retakes are free. Nothing counts until the guest decides to keep it.",
  },
  {
    title: "Add a message, if they like",
    body: "Each photo can carry one short note — a name, an inside joke, a wish.",
  },
  {
    title: "Keep it",
    body: "Keeping a photo uses the frame for good. It can’t be undone or swapped.",
  },
  {
    title: "Come back to their own photos",
    body: "On the same phone, guests can revisit and download what they kept, and make keepsakes of them if you allow sharing.",
  },
  {
    title: "See the gallery, when it’s shared",
    body: "Guests see everyone’s photos only through the gallery link, once you reveal it: one page to scroll through, in the layout you chose, with any photo opening whole.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="Simple for guests. In your hands as the host."
        lead="Two sides of the same five frames: what you do as the host, and what your guests see on their phones."
      >
        <nav aria-label="On this page" className="flex flex-wrap gap-2 pt-2">
          {[
            { href: "#lifecycle", label: "Start to finish" },
            { href: "#host", label: "For hosts" },
            { href: "#guests", label: "For guests" },
            { href: "#differences", label: "What’s different" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="ff-focus ff-frosted inline-flex h-10 items-center rounded-full px-4 text-label font-semibold text-ink-inverse hover:bg-white/25"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </PageHero>

      <Section id="lifecycle" labelledBy="lifecycle-title" className="relative -mt-6 rounded-t-sheet">
        <SectionHeader
          id="lifecycle-title"
          eyebrow="Start to finish"
          title="Your event, stage by stage."
          lead="The same stages you’ll see on your dashboard, and what each one means for your guests."
        />
        <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-4 xl:grid-cols-5">
          {LIFECYCLE.map((stage, index) => (
            <li
              key={stage.status}
              className="relative flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 lg:rounded-3xl"
            >
              <div className="flex items-center justify-between gap-2">
                <StatusPill icon={stage.icon} tone={stage.icon === "check" ? "tint" : "light"}>
                  {stage.status}
                </StatusPill>
                <span className="tabular text-caption font-bold text-ink-placeholder">{index + 1}/5</span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">You</p>
                <p className="text-label font-medium text-ink">{stage.host}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">Guests</p>
                <p className="text-label font-medium text-ink-muted">{stage.guests}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="host" tone="subtle" labelledBy="host-title">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="flex flex-col gap-10">
            <SectionHeader
              id="host-title"
              eyebrow="For hosts"
              title="You set the pace."
              lead="Only hosts have accounts. Everything about when guests can shoot and who sees the photos is yours to decide."
            />
            <Timeline steps={HOST_STEPS} />
          </div>
          <figure className="flex flex-col gap-3 lg:sticky lg:top-28 lg:self-start">
            <HostDashboardVisual />
            <figcaption className="text-caption font-medium text-ink-muted">
              The host dashboard, shown with a sample event.
            </figcaption>
          </figure>
        </div>
      </Section>

      <Section id="guests" labelledBy="guests-title">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="flex flex-col gap-10 lg:order-2">
            <SectionHeader
              id="guests-title"
              eyebrow="For guests"
              title="Five frames, no fuss."
              lead="Guests don’t need to learn anything. The whole experience fits on one screen and one decision per photo."
            />
            <Timeline steps={GUEST_STEPS} />
          </div>
          <div aria-hidden className="flex justify-center lg:sticky lg:top-28 lg:order-1 lg:self-start">
            <div className="relative flex w-full max-w-[520px] justify-center lg:h-[680px]">
              <div className="hidden lg:absolute lg:top-16 lg:left-0 lg:block lg:-rotate-6 lg:scale-90 motion-reduce:rotate-0">
                <JoinScreen />
              </div>
              <div className="lg:absolute lg:top-0 lg:right-0">
                <YourFiveScreen taken={2} />
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section id="differences" tone="subtle" labelledBy="differences-title">
        <SectionHeader
          id="differences-title"
          eyebrow="Good to know"
          title="A few things work differently, on purpose."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6">
          <FeatureCard icon={<Lock />} title="Five is fixed">
            Every guest session gets exactly {FRAMES} frames, at every event. Hosts can’t change the
            number and guests can’t buy more.
          </FeatureCard>
          <FeatureCard icon={<Smile />} title="No pressure to finish">
            FiveFrames never reminds guests to use their frames. Leaving some unused is a
            perfectly good way to take part.
          </FeatureCard>
          <FeatureCard icon={<Fingerprint />} title="Frames belong to a browser session">
            There are no guest accounts, so frames live in the phone browser that joined. A guest
            who clears their browser or switches phones starts again with a new {FRAMES}.
          </FeatureCard>
          <FeatureCard icon={<Check />} title="Keeping is final">
            Once a guest keeps a photo, it can’t be deleted or replaced by them — even if you hide
            it later, the frame stays used.
          </FeatureCard>
          <FeatureCard icon={<WifiLow />} title="Weak signal is expected">
            A frame is only used once the photo has safely arrived. Failed uploads can be retried
            without losing the frame or creating a duplicate.
          </FeatureCard>
          <FeatureCard icon={<Power />} title="Capture waits for you">
            Paying and your event date never open capture by themselves. If you forget to close
            it, it closes on its own a set time after your event date.
          </FeatureCard>
        </div>
        <div className="mt-12 grid gap-6 rounded-3xl bg-brand-tint p-6 sm:p-8 lg:mt-16 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand">
              <Hourglass className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-[17px] font-bold text-ink">See it from the guest’s side</h3>
              <p className="text-label font-medium text-ink-on-tint">
                The demo runs in your browser. Nothing is uploaded, and it isn’t an event you can
                share.
              </p>
            </div>
          </div>
          <ButtonLink href="/demo" variant="onTint" size="md">
            Try the demo
          </ButtonLink>
        </div>
      </Section>

      <CtaBand
        title="Ready when you are."
        body={`Create your event now and pay ${PRICE_LABEL} only when you’re ready to share the QR code.`}
      />
    </>
  );
}

function Timeline({ steps }: { steps: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="relative flex flex-col gap-6 before:absolute before:top-5 before:bottom-5 before:left-[19px] before:w-px before:bg-line">
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-4">
          <span className="tabular relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-label font-bold text-brand">
            {index + 1}
          </span>
          <div className="flex flex-col gap-1 pt-2">
            <h3 className="text-[17px] leading-snug font-bold text-ink">{step.title}</h3>
            <p className="text-label font-medium text-ink-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
