import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  Download,
  Eye,
  EyeOff,
  Focus,
  Link2,
  Lock,
  Power,
  QrCode,
  Share2,
  Smile,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Users,
  WandSparkles,
} from "lucide-react";
import { ButtonLink } from "@/components/ff/button";
import { StatusPill } from "@/components/ff/pill";
import { CtaBand, FaqList, PriceCard } from "@/components/ff/marketing/blocks";
import { GuestJourney } from "@/components/ff/marketing/guest-journey";
import {
  CollectionScreen,
  FiveKeptFrames,
  HostDashboardVisual,
  JoinScreen,
  PreviewScreen,
  TableCardVisual,
  YourFiveScreen,
} from "@/components/ff/marketing/product-screens";
import { Eyebrow, FeatureCard, Section, SectionHeader } from "@/components/ff/marketing/section";
import { qrSvgDataUri } from "@/lib/media/qr";
import {
  FRAMES,
  HOME_FAQ_IDS,
  HOSTED_ACCESS_LABEL,
  PAYMENT_METHODS_SENTENCE,
  PRICE_LABEL,
  TESTIMONIALS,
  faqItemsById,
} from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { scene } from "@/lib/marketing/sample-scenes";
import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/marketing/site";

export const metadata = marketingMetadata({
  title: "FiveFrames — Every guest. Five frames. One shared story.",
  description: SITE_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

/**
 * Public homepage — a complete discovery-to-conversion page on its own (docs/design-direction.md
 * → "Marketing site"). Static; the only computed value is the QR that opens the public demo.
 */
export default async function HomePage() {
  const siteUrl = getSiteUrl();
  const demoQr = await qrSvgDataUri(`${siteUrl}/demo`);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    description: SITE_DESCRIPTION,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output of a static object — no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Hero />
      <JourneySection demoQr={demoQr} />
      <WhyFiveSection />
      <HostSection />
      <StepsSection />
      <OccasionsSection />
      <DemoSection demoQr={demoQr} />
      {TESTIMONIALS.length > 0 ? <TestimonialsSection /> : <PromisesSection />}
      <TrustSection />
      <PricingSection />
      <FaqSection />
      <CtaBand
        title="Give every guest five frames."
        body="Set up your event, share one QR code, and let the day be seen from everyone’s point of view."
      />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-surface-dark text-ink-inverse">
      <div aria-hidden className="ff-photo-header absolute inset-0 lg:hidden" />
      <div aria-hidden className="ff-photo-header-desktop absolute inset-0 hidden lg:block" />
      <div className="relative mx-auto grid w-full max-w-[1200px] gap-12 px-5 pt-10 pb-20 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:gap-10 lg:px-10 lg:pt-16 lg:pb-24">
        <div className="flex flex-col gap-6">
          <StatusPill tone="frosted" icon="check">
            No app · No guest account
          </StatusPill>
          <h1 id="hero-title" className="font-heading text-hero font-semibold text-balance lg:text-hero-desktop">
            <span className="block">Every guest.</span>
            <span className="block">Five frames.</span>
            <span className="block">One shared story.</span>
          </h1>
          <p className="max-w-[560px] text-body font-medium text-ink-inverse/85 sm:text-[18px] sm:leading-relaxed">
            Guests scan your QR code and capture the day from their own phones — exactly {FRAMES}{" "}
            photos each, chosen with care. You get one private collection, revealed when you’re
            ready.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup">
              Create your event
              <ArrowRight aria-hidden />
            </ButtonLink>
            <ButtonLink href="/demo" variant="frosted">
              Try the demo
            </ButtonLink>
          </div>
          <p className="text-caption font-semibold text-ink-on-dark">
            <span className="text-ink-inverse">{PRICE_LABEL}</span> per event, paid once · Guests
            never pay
          </p>
          <FiveKeptFrames className="mt-4 max-w-[420px] lg:hidden" />
        </div>

        <div aria-hidden className="relative hidden h-[640px] lg:block">
          <div className="absolute top-10 left-0 origin-bottom-right -rotate-6 scale-[0.9] opacity-90 motion-reduce:rotate-0">
            <PreviewScreen />
          </div>
          <div className="absolute top-0 right-0">
            <YourFiveScreen taken={2} />
          </div>
        </div>
      </div>
    </section>
  );
}

function JourneySection({ demoQr }: { demoQr: string }) {
  return (
    <Section id="how-guests-join" labelledBy="journey-title" className="relative -mt-6 rounded-t-sheet">
      <SectionHeader
        id="journey-title"
        eyebrow="For guests"
        title="Scan, choose, keep. That’s the whole idea."
        lead="Here’s exactly what a guest sees, from the QR code on the table to the shared collection. Step through it."
      />
      <div className="mt-12 lg:mt-16">
        <GuestJourney
          steps={[
            {
              title: "Scan the QR or open the link",
              body: "Your QR code sits on tables, a poster or a screen. Guests point their camera at it and the event opens in their browser. (This card opens the demo — try it with your phone.)",
              visual: <TableCardVisual qrSrc={demoQr} />,
            },
            {
              title: "Type a first name",
              body: "No app to install, no account, no email. A first name is all it takes, and the join screen says so up front.",
              visual: <JoinScreen />,
            },
            {
              title: `See their ${FRAMES} frames`,
              body: `Every guest session gets exactly ${FRAMES}. The next frame is highlighted and the rest wait quietly — no timers, no reminders.`,
              visual: <YourFiveScreen taken={2} />,
            },
            {
              title: "Preview and add a message",
              body: "Before anything counts, guests see their photo, can add a short message, and can retake it as often as they like.",
              visual: <PreviewScreen />,
            },
            {
              title: "Keep it — for good",
              body: "Tapping Keep uses the frame, and it’s final. If an upload fails on weak signal, the frame isn’t used and they simply try again.",
              visual: <YourFiveScreen taken={3} justKept />,
            },
            {
              title: "Become part of the collection",
              body: "Everything kept goes into the host’s private collection. When you reveal the gallery and share its link, everyone can relive the day together.",
              visual: <CollectionScreen />,
            },
          ]}
        />
      </div>
    </Section>
  );
}

function WhyFiveSection() {
  return (
    <Section id="why-five" tone="subtle" labelledBy="why-five-title">
      <SectionHeader
        id="why-five-title"
        eyebrow="Why five"
        title="Five is a choice, not a limit."
        lead="FiveFrames isn’t a storage plan with a cap. The small number is the whole idea — it changes how people take photos, and what you end up with."
      />
      <div className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <div aria-hidden className="grid grid-cols-10 gap-1 opacity-70 sm:gap-1.5">
            {Array.from({ length: 60 }, (_, i) => (
              <span
                key={i}
                className={`aspect-square rounded-[4px] ${i % 7 === 0 ? "bg-line-dashed" : i % 3 === 0 ? "bg-line" : "bg-surface-subtle"}`}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-[19px] font-bold text-ink">A shared folder with no limit</h3>
            <p className="text-label font-medium text-ink-muted">
              Bursts, near-duplicates and blurry near-misses, all waiting to be sorted. Easy to
              fill, hard to look back through.
            </p>
          </div>
        </div>
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl bg-surface-dark p-6 text-ink-inverse sm:p-8">
          <div aria-hidden className="ff-photo-header-desktop absolute inset-0" />
          <FiveKeptFrames className="relative flex-1 py-2" offset={3} />
          <div className="relative flex flex-col gap-2">
            <h3 className="text-[19px] font-bold">{FRAMES} from every guest</h3>
            <p className="text-label font-medium text-ink-on-dark">
              Each photo was chosen. Together they show the day from everyone’s point of view.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-10">
        <FeatureCard plain icon={<Focus />} title="Fewer, more intentional photos">
          With five to spend, guests wait for the moments that matter to them — the toast, the
          hug at the door, the view.
        </FeatureCard>
        <FeatureCard plain icon={<Smile />} title="Phones back in pockets">
          No pressure to document everything. Take a few, then be there.
        </FeatureCard>
        <FeatureCard plain icon={<Users />} title="Every guest adds a view">
          Each person’s five is a small, personal perspective. Together they show the day from
          all over the room.
        </FeatureCard>
        <FeatureCard plain icon={<Check />} title="Unused frames are fine">
          Two photos, or none at all, is a perfectly good way to take part. FiveFrames never asks
          guests to finish.
        </FeatureCard>
      </div>
    </Section>
  );
}

function HostSection() {
  return (
    <Section id="for-hosts" labelledBy="hosts-title">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          id="hosts-title"
          eyebrow="For hosts"
          title="Everything you need for the day, and after it."
          lead="One dashboard: set up, share the QR, open capture when everyone’s there, then review, reveal and download."
        />
        <ButtonLink href="/how-it-works" variant="secondary" size="md" className="self-start lg:self-auto">
          How it works
          <ArrowRight aria-hidden />
        </ButtonLink>
      </div>
      <figure className="mt-12 flex flex-col gap-3 lg:mt-16">
        <HostDashboardVisual wide />
        <figcaption className="text-caption font-medium text-ink-muted">
          The host dashboard, shown with a sample event.
        </figcaption>
      </figure>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6">
        <FeatureCard icon={<QrCode />} title="Ready-made signage">
          A printable QR, a table card, a poster and a phone-screen version, ready the moment your
          event is paid.
        </FeatureCard>
        <FeatureCard icon={<Power />} title="You open capture">
          Guests can’t shoot until you switch capture on. Close it whenever you like — it also
          closes on its own after your event date.
        </FeatureCard>
        <FeatureCard icon={<Activity />} title="Counts that keep up">
          Guests joined and photos taken refresh on their own every few seconds while your
          dashboard is open.
        </FeatureCard>
        <FeatureCard icon={<EyeOff />} title="Hide, delete, favorite">
          Moderate any photo before or after the gallery opens. Hidden photos disappear from the
          guest’s view too.
        </FeatureCard>
        <FeatureCard icon={<Eye />} title="Reveal on your terms">
          Open the gallery after the event, right away, or at a time you set. Until then, it
          stays hidden.
        </FeatureCard>
        <FeatureCard icon={<Link2 />} title="Links you control">
          Share the gallery with anyone who has its link, or keep it to yourself. Replace or turn
          off either link at any time.
        </FeatureCard>
        <FeatureCard icon={<Download />} title="Every original">
          Download the untouched originals one by one or all at once, whenever you like.
        </FeatureCard>
        <FeatureCard icon={<Share2 />} title="Sharing is your call">
          Guests can share a FiveFrames card of their own photos. Turn it off if you’d rather —
          it switches off our sharing tools, not their phones.
        </FeatureCard>
        <FeatureCard icon={<CalendarClock />} title={`Hosted for ${HOSTED_ACCESS_LABEL}`}>
          Your collection stays in your dashboard for {HOSTED_ACCESS_LABEL} after activation,
          with a heads-up before it ends.
        </FeatureCard>
      </div>
    </Section>
  );
}

const STEPS = [
  {
    title: "Create your event",
    body: "Name, date, a welcome message for guests, and your gallery and sharing settings. Set it all up before paying.",
  },
  {
    title: "Activate and share the QR",
    body: `Pay ${PRICE_LABEL} once and your event link, QR code and signage are ready. Capture stays closed until you open it.`,
  },
  {
    title: "Open capture on the day",
    body: `When everyone’s there, switch capture on. Each guest gets exactly ${FRAMES} frames.`,
  },
  {
    title: "Reveal and keep",
    body: "Review the photos, reveal the gallery when it feels right, and download the originals.",
  },
];

function StepsSection() {
  return (
    <Section id="how-it-works" tone="subtle" labelledBy="steps-title">
      <SectionHeader
        id="steps-title"
        eyebrow="How it works"
        title="From setup to keepsake in four steps."
      />
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-6">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 lg:rounded-3xl lg:p-6">
            <span
              className={`tabular flex size-10 items-center justify-center rounded-full text-label font-extrabold ${
                index === 2 ? "bg-brand text-ink-inverse" : "bg-brand-tint text-brand"
              }`}
            >
              {index + 1}
            </span>
            <h3 className="text-[17px] leading-snug font-bold text-ink">{step.title}</h3>
            <p className="text-label font-medium text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
      <Link
        href="/how-it-works"
        className="ff-focus mt-8 inline-flex items-center gap-1.5 rounded-md text-label font-semibold text-brand underline-offset-4 hover:underline"
      >
        See the full walkthrough for hosts and guests
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Section>
  );
}

const OCCASIONS = [
  { name: "Birthdays", scene: 1, focus: "50% 75%", body: "From a first birthday to a ninetieth, five frames from everyone who came." },
  { name: "Parties", scene: 4, focus: "50% 50%", body: "The night from every corner of the room, without anyone stuck playing photographer." },
  { name: "Reunions", scene: 7, focus: "50% 0%", body: "Every branch of the family and every old friend adds their own five." },
  { name: "Trips", scene: 5, focus: "50% 55%", body: "One shared collection from the whole group, not just one person’s camera roll." },
  { name: "Team events", scene: 6, focus: "50% 45%", body: "Offsites, launches and year-end parties, seen by the whole team." },
  { name: "Weddings", scene: 3, focus: "50% 70%", body: "A guest’s-eye view of the day, alongside your photographer’s." },
];

function OccasionsSection() {
  return (
    <Section id="occasions" labelledBy="occasions-title">
      <SectionHeader
        id="occasions-title"
        eyebrow="For any occasion"
        title="Wherever people gather."
        lead="FiveFrames isn’t built around one kind of event. If people are getting together, five frames each works the same way."
      />
      <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-16 lg:grid-cols-3 lg:gap-6">
        {OCCASIONS.map((occasion) => (
          <li key={occasion.name} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface lg:rounded-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG illustration */}
            <img
              src={scene(occasion.scene).src}
              alt=""
              style={{ objectPosition: occasion.focus }}
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="flex flex-col gap-1.5 p-4 lg:p-6">
              <h3 className="text-[16px] font-bold text-ink lg:text-[19px]">{occasion.name}</h3>
              <p className="text-caption font-medium text-ink-muted lg:text-label">{occasion.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DemoSection({ demoQr }: { demoQr: string }) {
  return (
    <Section id="demo" tone="subtle" labelledBy="demo-title">
      <div className="grid gap-8 overflow-hidden rounded-3xl bg-brand-tint p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center lg:gap-16 lg:rounded-[36px] lg:p-16">
        <div className="flex flex-col gap-5">
          <Eyebrow>Try before you buy</Eyebrow>
          <h2 id="demo-title" className="font-heading text-display-create font-semibold text-balance text-ink sm:text-display lg:text-page-desktop">
            Feel what five frames is like.
          </h2>
          <p className="max-w-[560px] text-body font-medium text-ink-on-tint sm:text-[17px]">
            The demo is the guest experience, right in your browser. Take five shots with your own
            camera or our sample images, add a message, keep them, and notice how it changes what
            you choose.
          </p>
          <ul className="flex flex-col gap-2.5">
            {[
              "Nothing is uploaded or saved — it all stays on your device",
              "It isn’t an event: there’s no link or QR to share",
              "No account needed",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-label font-semibold text-ink">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <ButtonLink href="/demo" className="mt-2 self-start">
            <Sparkles aria-hidden />
            Try the demo
          </ButtonLink>
        </div>
        <div className="hidden flex-col items-center gap-4 rounded-3xl bg-surface p-8 text-center lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered QR data URI */}
          <img src={demoQr} alt="QR code that opens the FiveFrames demo" className="size-[200px]" />
          <p className="text-label font-semibold text-ink">On a computer?</p>
          <p className="-mt-2 text-caption font-medium text-ink-muted">
            Scan to open the demo on your phone, the way guests would.
          </p>
        </div>
      </div>
    </Section>
  );
}

const PROMISES = [
  {
    icon: <Lock />,
    title: "Five means five",
    body: "Every guest session gets exactly five frames. Hosts can’t raise it, guests can’t buy more, and it’s enforced on our servers, not in the browser.",
  },
  {
    icon: <ShieldCheck />,
    title: "A failed upload never costs a frame",
    body: "A frame is used only once the photo has safely arrived, and a retry never creates a duplicate.",
  },
  {
    icon: <Download />,
    title: "Your originals, untouched",
    body: "Previews and share cards are separate files. You can download every original until your photos are deleted.",
  },
  {
    icon: <Check />,
    title: "Nothing to chase",
    body: "No streaks, badges or reminders to use up frames. Unused frames are a perfectly good outcome.",
  },
];

/**
 * Stands in for social proof until real, permitted testimonials exist (TESTIMONIALS in
 * lib/marketing/content.ts). It says so plainly rather than inventing reviews or numbers.
 */
function PromisesSection() {
  return (
    <Section id="our-promises" labelledBy="promises-title">
      <SectionHeader
        id="promises-title"
        eyebrow="Before you trust us with your day"
        title="No reviews yet. Just what we’ve built in."
        lead="FiveFrames is new, so you won’t find ratings or quotes here that we don’t have. Here’s what every event gets, by design."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-6">
        {PROMISES.map((promise) => (
          <FeatureCard key={promise.title} icon={promise.icon} title={promise.title} className="bg-surface-subtle border-transparent">
            {promise.body}
          </FeatureCard>
        ))}
      </div>
    </Section>
  );
}

/** Renders only once TESTIMONIALS holds real, permitted quotes. */
function TestimonialsSection() {
  return (
    <Section id="from-hosts" labelledBy="testimonials-title">
      <SectionHeader id="testimonials-title" eyebrow="From our hosts" title="In their words." />
      <ul className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-3 lg:gap-6">
        {TESTIMONIALS.map((testimonial) => (
          <li key={testimonial.quote}>
            <figure className="flex h-full flex-col gap-4 rounded-3xl border border-line bg-surface p-6 lg:p-8">
              <blockquote className="font-heading text-[22px] leading-snug font-semibold text-ink">
                “{testimonial.quote}”
              </blockquote>
              <figcaption className="mt-auto text-label font-semibold text-ink-muted">
                {testimonial.attribution}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const TRUST = [
  {
    icon: <EyeOff />,
    title: "Hidden until you reveal it",
    body: "Before you reveal the gallery, nobody can see it — not even someone holding its link.",
  },
  {
    icon: <Link2 />,
    title: "You choose who sees it",
    body: "Anyone with the gallery link, or only you. It’s separate from the guest link, and either one can be replaced or turned off.",
  },
  {
    icon: <ShieldCheck />,
    title: "No public photo addresses",
    body: "Each photo is served through a short-lived link, issued only after an access check.",
  },
  {
    icon: <Smartphone />,
    title: "No app, no guest accounts",
    body: "Guests give a first name and nothing else. No email, no phone number, no install.",
  },
  {
    icon: <UserCheck />,
    title: "Guests keep their own view",
    body: "Each guest can see and download the photos they kept, for as long as their session and your event last.",
  },
  {
    icon: <WandSparkles />,
    title: "No AI in the capture flow",
    body: "Photos aren’t edited, faces aren’t altered and captions aren’t generated.",
  },
];

function TrustSection() {
  return (
    <Section id="privacy" tone="dark" labelledBy="trust-title" className="relative overflow-hidden">
      <div aria-hidden className="ff-photo-header-desktop absolute inset-0 opacity-80" />
      <div className="relative">
        <SectionHeader
          id="trust-title"
          tone="dark"
          eyebrow="Privacy"
          title="Private by default."
          lead="Photos from your event belong to your event. Here’s exactly how that works — no bigger promises than that."
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6">
          {TRUST.map((item) => (
            <li key={item.title} className="ff-frosted flex flex-col gap-3 rounded-3xl p-5 lg:p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-surface text-brand [&_svg]:size-5">
                {item.icon}
              </span>
              <h3 className="text-[17px] font-bold text-ink-inverse">{item.title}</h3>
              <p className="text-label font-medium text-ink-on-dark">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function PricingSection() {
  return (
    <Section id="pricing" labelledBy="pricing-title">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:gap-20">
        <div className="flex flex-col gap-8">
          <SectionHeader
            id="pricing-title"
            eyebrow="Pricing"
            title="One event. One price."
            lead="No tiers to compare and nothing to add on. Set up your event first, then pay once when you’re ready to share your QR code."
          />
          <ul className="flex flex-col gap-3">
            {[
              "Guests never pay, and there are no extra frames to buy",
              `Pay online with ${PAYMENT_METHODS_SENTENCE}`,
              "Paying activates your event — you still choose when capture opens",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-body font-medium text-ink">
                <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <Link
            href="/pricing"
            className="ff-focus inline-flex w-fit items-center gap-1.5 rounded-md text-label font-semibold text-brand underline-offset-4 hover:underline"
          >
            Pricing details, payment and refunds
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <PriceCard />
      </div>
    </Section>
  );
}

function FaqSection() {
  return (
    <Section id="faq" tone="subtle" labelledBy="faq-title">
      <div className="grid gap-10 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <SectionHeader id="faq-title" eyebrow="FAQ" title="Questions, answered." />
          <ButtonLink href="/faq" variant="secondary" size="md" className="self-start">
            See all questions
            <ArrowRight aria-hidden />
          </ButtonLink>
        </div>
        <FaqList items={faqItemsById(HOME_FAQ_IDS)} />
      </div>
    </Section>
  );
}
