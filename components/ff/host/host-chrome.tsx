import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import type { HostSession } from "@/lib/auth/host-session";
import { ButtonLink } from "../button";
import { Wordmark } from "../wordmark";
import { AccountMenu } from "./account-menu";
import { cn } from "@/lib/utils";

/**
 * Desktop top nav (DS04 "Desktop navigation"): 72h, white, 1px bottom border, 40px side padding.
 * The active link is a tint pill; Create is always visible; the avatar opens the account menu.
 * Shown from 1024 up — mobile host screens use the dark header instead.
 */
export function HostTopNav({ host, active }: { host: HostSession; active?: "events" }) {
  return (
    <nav
      aria-label="Host"
      className="sticky top-0 z-20 hidden h-[72px] items-center justify-between border-b border-line bg-surface px-10 lg:flex"
    >
      <div className="flex items-center gap-8">
        <Wordmark host href="/dashboard" />
        <Link
          href="/dashboard"
          aria-current={active === "events" ? "page" : undefined}
          className={cn(
            "ff-focus flex h-9 items-center rounded-full px-4 text-label font-semibold",
            active === "events" ? "bg-brand-tint text-brand" : "text-ink-muted hover:text-ink",
          )}
        >
          Events
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <ButtonLink href="/events/new" size="sm">
          <Plus aria-hidden />
          Create new event
        </ButtonLink>
        <AccountMenu name={host.name} email={host.email} />
      </div>
    </nav>
  );
}

/**
 * Mobile host header (host 05–07): the dark photo-header treatment with wordmark + HOST tag and
 * the frosted account button, then a title block pinned to the bottom. Hidden from 1024 up.
 */
export function HostMobileHeader({
  host,
  leading,
  coverUrl,
  children,
}: {
  host: HostSession;
  /** Replaces the wordmark (e.g. a back/close circle). */
  leading?: ReactNode;
  /** The event's theme image as the cover (signed after the host ownership check). */
  coverUrl?: string | null;
  children: ReactNode;
}) {
  return (
    <header className="ff-photo-header ff-safe-top relative flex min-h-[200px] flex-col px-5 pb-10 text-ink-inverse lg:hidden">
      {coverUrl && <EventCoverImage src={coverUrl} />}
      <div className="relative flex h-11 items-center justify-between gap-3">
        {leading ?? <Wordmark host tone="light" href="/dashboard" />}
        <AccountMenu name={host.name} email={host.email} tone="frosted" />
      </div>
      <div className="relative mt-auto flex flex-col gap-1.5 pt-6">{children}</div>
    </header>
  );
}

/**
 * An event's theme image as a host cover (design-direction: "the host event cover uses the
 * theme image when set"), under the same legibility gradient as guest headers. Only the image
 * changes — host chrome keeps FiveFrames violet and is never recolored by the event accent.
 */
export function EventCoverImage({ src, direction = "down" }: { src: string; direction?: "down" | "across" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
      <img src={src} alt="" className="size-full object-cover object-[50%_35%]" />
      <div
        className={cn(
          "absolute inset-0",
          direction === "down"
            ? "ff-theme-scrim"
            : "bg-[linear-gradient(90deg,rgb(20_20_20/0.88)_18%,rgb(20_20_20/0.35)_100%)]",
        )}
      />
    </div>
  );
}

/** The white sheet under a mobile header; on desktop it becomes the grey page body. */
export function HostSheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "ff-safe-bottom relative -mt-6 flex flex-1 flex-col gap-5 rounded-t-sheet bg-surface px-5 pt-6 lg:mt-0 lg:rounded-none lg:bg-transparent lg:px-10 lg:pt-10 lg:pb-16",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-5 lg:gap-8">
        {children}
      </div>
    </main>
  );
}

/** Page frame for host screens: night behind the mobile sheet, grey page on desktop. */
export function HostFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-dark lg:bg-surface-subtle">{children}</div>
  );
}
