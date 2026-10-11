import Link from "next/link";
import { PageHero, Section } from "@/components/ff/marketing/section";
import { LEGAL_UPDATED, type LegalBlock, type LegalDocument } from "@/lib/marketing/legal";

/** Linkifies the contact addresses in a legal paragraph; everything else is plain text. */
function Text({ value }: { value: string }) {
  const parts = value.split(/([a-z]+@fiveframes\.app)/);
  return (
    <>
      {parts.map((part, i) =>
        /@fiveframes\.app$/.test(part) ? (
          <a key={i} href={`mailto:${part}`} className="ff-focus font-semibold text-brand-ink underline underline-offset-2">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return (
      <p className="text-body text-ink-muted">
        <Text value={block} />
      </p>
    );
  }
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-ink-muted marker:text-ink-muted">
      {block.list.map((item) => (
        <li key={item}>
          <Text value={item} />
        </li>
      ))}
    </ul>
  );
}

/** A Terms or Privacy page: hero, a contents list (sticky on desktop), then the sections. */
export function LegalDocumentPage({ doc, other }: { doc: LegalDocument; other: { href: string; label: string } }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={doc.title} lead={doc.lead}>
        <p className="text-caption font-medium text-ink-inverse/70">Last updated {LEGAL_UPDATED}</p>
      </PageHero>

      <Section tone="subtle" className="relative -mt-6 rounded-t-sheet">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="Contents" className="lg:sticky lg:top-28 lg:self-start">
            <ol className="flex flex-col gap-1 text-label font-semibold">
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <Link href={`#${section.id}`} className="ff-focus inline-flex min-h-9 items-center rounded-md text-ink-muted hover:text-brand">
                    {section.title}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex max-w-[720px] flex-col gap-10">
            {doc.sections.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="flex scroll-mt-24 flex-col gap-3">
                <h2 id={`${section.id}-title`} className="font-heading text-title font-semibold text-ink">
                  {section.title}
                </h2>
                {section.body.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </section>
            ))}
            <p className="border-t border-line pt-6 text-label font-medium text-ink-muted">
              See also our{" "}
              <Link href={other.href} className="ff-focus font-semibold text-brand-ink underline underline-offset-2">
                {other.label}
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
