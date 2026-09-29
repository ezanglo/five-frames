import Link from "next/link";
import { CtaBand, FaqList } from "@/components/ff/marketing/blocks";
import { PageHero, Section } from "@/components/ff/marketing/section";
import { FAQ_GROUPS } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "FAQ",
  description:
    "Answers about FiveFrames: guests need no app or account, why it’s five photos, when the gallery opens, downloading originals, privacy, and paying for your event.",
  path: "/faq",
});

export default function FaqPage() {
  // Built from the same answers rendered below — nothing here that isn't on the page.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer.join(" ") },
      })),
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <PageHero
        eyebrow="FAQ"
        title="Questions, answered."
        lead="How FiveFrames works for hosts and guests, what it costs, and what happens to the photos."
      />

      <Section tone="subtle" className="relative -mt-6 rounded-t-sheet">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="FAQ topics" className="lg:sticky lg:top-28 lg:self-start">
            <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
              {FAQ_GROUPS.map((group) => (
                <li key={group.id} className="shrink-0">
                  <Link
                    href={`#${group.id}`}
                    className="ff-focus flex h-10 items-center rounded-full border border-line bg-surface px-4 text-label font-semibold whitespace-nowrap text-ink hover:text-brand lg:border-0 lg:bg-transparent lg:px-3 lg:text-ink-muted"
                  >
                    {group.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-14">
            {FAQ_GROUPS.map((group) => (
              <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="flex scroll-mt-24 flex-col gap-5">
                <h2 id={`${group.id}-title`} className="font-heading text-title font-semibold text-ink lg:text-title-desktop">
                  {group.title}
                </h2>
                <FaqList items={group.items} />
              </section>
            ))}
          </div>
        </div>
      </Section>

      <CtaBand
        title="Still wondering how it feels?"
        body="The demo shows the guest side in your own browser. Nothing is uploaded, and there’s nothing to sign up for."
      />
    </>
  );
}
