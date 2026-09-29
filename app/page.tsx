import { ButtonLink } from "@/components/ff/button";
import { FiveShotTeaser } from "@/components/ff/shots";
import { Wordmark } from "@/components/ff/wordmark";

/**
 * Minimal public entry point. Not part of the contracted handoff's screen inventory; it uses the
 * same system (guest shell header treatment, one primary action) rather than a separate
 * marketing style.
 */
export default function Page() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-dark">
      <header className="ff-photo-header ff-safe-top flex min-h-[46dvh] flex-col px-5 pb-12 text-ink-inverse lg:px-10">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center">
          <Wordmark tone="light" />
        </div>
        <div className="mx-auto mt-auto flex w-full max-w-[1200px] flex-col gap-4">
          <h1 className="font-heading text-display font-semibold lg:text-display-desktop">
            Every guest. Five frames.
            <br />
            One shared story.
          </h1>
          <p className="max-w-xl text-body font-medium text-ink-inverse/85">
            Guests scan one QR code and capture the party from their own phones — five photos
            each, no app, no account. You reveal the gallery when the moment’s right.
          </p>
        </div>
      </header>
      <main className="relative -mt-6 flex flex-1 flex-col rounded-t-sheet bg-surface px-5 pt-8 pb-10 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <FiveShotTeaser className="w-full max-w-[420px]" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup">Create your event</ButtonLink>
            <ButtonLink href="/demo" variant="secondary">
              Try the demo
            </ButtonLink>
            <ButtonLink href="/login" variant="text" className="self-center px-3">
              Host sign in
            </ButtonLink>
          </div>
        </div>
      </main>
    </div>
  );
}
