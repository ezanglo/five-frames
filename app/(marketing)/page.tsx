import type { CSSProperties } from "react";
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
  ImageIcon,
  Layers,
  Link2,
  Lock,
  Palette,
  Power,
  QrCode,
  Share2,
  Smile,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  WandSparkles,
} from "lucide-react";
import { ButtonLink } from "@/components/ff/button";
import { StatusPill } from "@/components/ff/pill";
import { CtaBand, FaqList, PriceCard } from "@/components/ff/marketing/blocks";
import { GuestJourney } from "@/components/ff/marketing/guest-journey";
import { KeepsakeShowcase } from "@/components/ff/marketing/keepsake-showcase";
import { FiveFramesHeroVisual } from "@/components/ff/marketing/hero-prints";
import { Reveal } from "@/components/ff/marketing/reveal";
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
import { OCCASION_PHOTOS, photoSrc, photoSrcSet } from "@/lib/marketing/photos";
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
      <KeepsakesSection />
      <HostSection />
      <StepsSection />
      <OccasionsSection />
      <DemoSection demoQr={demoQr} />
      {TESTIMONIALS.length > 0 && <TestimonialsSection />}
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
      <div className="relative mx-auto grid w-full max-w-[1200px] gap-12 px-5 pt-10 pb-20 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center xl:grid-cols-[minmax(0,1fr)_520px] lg:gap-10 lg:px-10 lg:pt-16 lg:pb-24">
        <div className="flex flex-col gap-6">
          <StatusPill tone="frosted" icon="check">
            No app · No guest account
          </StatusPill>
          <h1 id="hero-title" className="font-heading text-hero font-semibold text-balance lg:text-[60px] xl:text-hero-desktop">
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
          <FiveKeptFrames entrance="load" className="mt-4 max-w-[420px] sm:max-w-[560px] lg:hidden" />
        </div>

        {/* 1024–1279: a narrower column and a scaled stage, so the headline keeps three lines
            and the CTAs stay above the fold. Same composition and motion amplitude at every width. */}
        <div className="relative hidden h-[500px] items-center justify-center lg:flex xl:h-[640px]">
          <FiveFramesHeroVisual className="shrink-0 scale-[0.76] xl:scale-100" />
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
              body: "Everything kept goes into the host’s private collection. Guests can always see their own. Everyone else’s photos wait until you reveal the gallery and share its link.",
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
          <Reveal className="relative flex flex-1 items-center py-2">
            <FiveKeptFrames entrance="reveal" className="w-full" />
          </Reveal>
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

const KEEPSAKE_POINTS = [
  {
    icon: <Palette />,
    title: "Your look, carried through",
    body: "Add one image, pick an accent color and, if you like, a hashtag. Guest screens, signage and keepsakes all wear it. Skip it, and the FiveFrames look is ready as it is.",
  },
  {
    icon: <ImageIcon />,
    title: "One photo, or all five",
    body: "Guests choose from five keepsake styles for any photo they kept. Someone who keeps all five can also put them together in one, with five styles made for that.",
  },
  {
    icon: <Layers />,
    title: "The original stays the original",
    body: "A keepsake is a separate image. The photo itself is never cropped, filtered or changed, and it still downloads exactly as it was taken.",
  },
  {
    icon: <EyeOff />,
    title: "Only their own photos",
    body: "A keepsake never shows the guest’s name, anyone else’s photos, or a way into your event or gallery.",
  },
];

/**
 * Event Theme & Keepsakes (product.md §10): what guests take home, and the one look the host
 * sets for it. Calm on purpose — the all-five keepsake is mentioned as something a guest *can*
 * make, never as a goal (product.md §10.2.2).
 */
function KeepsakesSection() {
  return (
    <Section id="keepsakes" labelledBy="keepsakes-title">
      {/* Mobile: heading → keepsakes → points, so the picture explains before the list does.
          ≥1024: text column left, keepsakes centered on the right across both rows. */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-16">
        <SectionHeader
          id="keepsakes-title"
          eyebrow="Keepsakes"
          title="Theirs to keep, in your event’s look."
          lead="Guests can turn the photos they kept into a styled keepsake to share or save. You set the look once; FiveFrames takes care of the design."
        />
        <Reveal className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <KeepsakeShowcase className="ff-rise-reveal" />
        </Reveal>
        <ul className="grid gap-8 sm:grid-cols-2 lg:gap-x-10">
          {KEEPSAKE_POINTS.map((point) => (
            <li key={point.title}>
              <FeatureCard plain icon={point.icon} title={point.title}>
                {point.body}
              </FeatureCard>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function HostSection() {
  return (
    <Section id="for-hosts" tone="subtle" labelledBy="hosts-title">
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
      <Reveal className="mt-12 lg:mt-16">
        <figure className="ff-rise-reveal flex flex-col gap-3">
          <HostDashboardVisual wide />
          <figcaption className="text-caption font-medium text-ink-muted">
            The host dashboard, shown with a sample event.
          </figcaption>
        </figure>
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6">
        <FeatureCard icon={<QrCode />} title="Ready-made signage">
          A printable QR, a table card, a poster and a phone-screen version in your event’s
          colors, ready the moment your event is paid.
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
          Guests can make keepsakes of their own photos to share or save. Turn it off if you’d
          rather — it switches off our sharing tools, not their phones.
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
    body: "Name, date, a welcome message for guests, and your gallery and sharing settings. Add your own look if you like. Set it all up before paying.",
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
    <Section id="how-it-works" labelledBy="steps-title">
      <SectionHeader
        id="steps-title"
        eyebrow="How it works"
        title="From setup to reveal in four steps."
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
  { name: "Birthdays", photo: OCCASION_PHOTOS.birthdays, body: "From a first birthday to a ninetieth, five frames from everyone who came." },
  { name: "Parties", photo: OCCASION_PHOTOS.parties, body: "The night from every corner of the room, without anyone stuck playing photographer." },
  { name: "Reunions", photo: OCCASION_PHOTOS.reunions, body: "Every branch of the family and every old friend adds their own five." },
  { name: "Trips", photo: OCCASION_PHOTOS.trips, body: "One shared collection from the whole group, not just one person’s camera roll." },
  { name: "Team events", photo: OCCASION_PHOTOS.teamEvents, body: "Offsites, launches and year-end parties, seen by the whole team." },
  { name: "Weddings", photo: OCCASION_PHOTOS.weddings, body: "A guest’s-eye view of the day, alongside your photographer’s." },
];

function OccasionsSection() {
  return (
    <Section id="occasions" tone="subtle" labelledBy="occasions-title">
      <SectionHeader
        id="occasions-title"
        eyebrow="For any occasion"
        title="Wherever people gather."
        lead="FiveFrames isn’t built around one kind of event. If people are getting together, five frames each works the same way."
      />
      <Reveal className="mt-12 lg:mt-16">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
        {OCCASIONS.map((occasion, index) => (
          <li
            key={occasion.name}
            style={{ "--i": index } as CSSProperties}
            className="ff-rise-reveal flex flex-col overflow-hidden rounded-xl border border-line bg-surface lg:rounded-3xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from public/ */}
            <img
              src={photoSrc(occasion.photo)}
              srcSet={photoSrcSet(occasion.photo)}
              sizes="(min-width: 1024px) 384px, 50vw"
              alt={occasion.photo.alt}
              loading="lazy"
              decoding="async"
              width={occasion.photo.width}
              height={occasion.photo.height}
              style={{ objectPosition: occasion.photo.focus }}
              className="aspect-[4/3] w-full bg-surface-subtle object-cover"
            />
            <div className="flex flex-col gap-1.5 p-4 lg:p-6">
              <h3 className="text-[16px] font-bold text-ink lg:text-[19px]">{occasion.name}</h3>
              <p className="text-caption font-medium text-ink-muted lg:text-label">{occasion.body}</p>
            </div>
          </li>
        ))}
        </ul>
      </Reveal>
    </Section>
  );
}

function DemoSection({ demoQr }: { demoQr: string }) {
  return (
    <Section id="demo" labelledBy="demo-title">
      <div className="grid gap-8 overflow-hidden rounded-3xl bg-brand-tint p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center lg:gap-16 lg:rounded-[36px] lg:p-16">
        <div className="flex flex-col gap-5">
          <Eyebrow>Try before you buy</Eyebrow>
          <h2 id="demo-title" className="font-heading text-display-create font-semibold text-balance text-ink sm:text-display lg:text-page-desktop">
            Feel what five frames is like.
          </h2>
          <p className="max-w-[560px] text-body font-medium text-ink-on-tint sm:text-[17px]">
            The demo is the guest experience, right in your browser. Take five shots with your own
            camera or our sample images, add a message, keep them, and notice how it changes what
            you choose. Then try the keepsake styles on a sample look.
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

/**
 * What every event gets by design: privacy plus the frame guarantees. While there are no real,
 * permitted testimonials (TESTIMONIALS in lib/marketing/content.ts) the lead says so plainly
 * rather than inventing reviews or numbers.
 */
const TRUST = [
  {
    icon: <EyeOff />,
    title: "Hidden until you reveal it",
    body: "Before you reveal the gallery, nobody can see it — not even someone holding its link. After that: anyone with the link, or only you.",
  },
  {
    icon: <UserCheck />,
    title: "Guests keep their own view",
    body: "Each guest can see and download the photos they kept, for as long as their session and your event last.",
  },
  {
    icon: <ShieldCheck />,
    title: "No public photo addresses",
    body: "Each photo is served through a short-lived link, issued only after an access check.",
  },
  {
    icon: <Lock />,
    title: "Five means five",
    body: "Every guest session gets exactly five frames. Hosts can’t raise it, guests can’t buy more, and it’s enforced on our servers, not in the browser.",
  },
  {
    icon: <Check />,
    title: "A failed upload never costs a frame",
    body: "A frame is used only once the photo has safely arrived, and a retry never creates a duplicate.",
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
          eyebrow="Built in"
          title="Private by default. Fair by design."
          lead={
            TESTIMONIALS.length > 0
              ? "Here’s what every event gets — no bigger promises than that."
              : "FiveFrames is new, so there are no reviews here yet. Here’s what every event gets — no bigger promises than that."
          }
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
