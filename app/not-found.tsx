import type { Metadata } from "next";
import Link from "next/link";
import { Link2Off } from "lucide-react";
import { ButtonLink } from "@/components/ff/button";
import { HighlightCard } from "@/components/ff/cards";
import { ActionFootnote, GuestShell, SheetActions } from "@/components/ff/guest-shell";
import { Wordmark } from "@/components/ff/wordmark";

export const metadata: Metadata = {
  title: "Page not found · FiveFrames",
};

/**
 * Root 404: unmatched URLs and every `notFound()` — including a host opening an event they
 * don't own (invariant 9), which deliberately looks the same as one that doesn't exist. Guest
 * and gallery links render their own calm "can't find this event/gallery" states instead.
 */
export default function NotFound() {
  return (
    <GuestShell
      topLeft={<Wordmark tone="light" href="/" />}
      title="We can’t find that page"
      subtitle="The link may be mistyped, or the page may no longer exist."
    >
      <HighlightCard
        icon={<Link2Off />}
        title="Got this link from a host?"
        body="Ask them to send it again — event and gallery links come from the host."
      />
      <SheetActions>
        <ButtonLink href="/" size="lg">
          Go to FiveFrames
        </ButtonLink>
        <ActionFootnote>
          Hosting an event?
          <Link
            href="/dashboard"
            className="ff-focus rounded-md font-semibold text-brand hover:underline"
          >
            Go to your events
          </Link>
        </ActionFootnote>
      </SheetActions>
    </GuestShell>
  );
}
