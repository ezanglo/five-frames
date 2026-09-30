"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "./button";
import { InfoCard } from "./cards";
import { ActionFootnote, GuestShell, SheetActions } from "./guest-shell";
import { Wordmark } from "./wordmark";

/**
 * Unexpected-error state (app/error.tsx, app/global-error.tsx). Uses the guest shell because an
 * error can reach any audience — a guest mid-capture as easily as a host. The only claim it
 * makes is that retrying may work; the digest lets support match the server log without
 * exposing the error itself (production error messages are generic by design).
 */
export function ErrorScreen({ digest, retry }: { digest?: string; retry: () => void }) {
  return (
    <GuestShell
      topLeft={<Wordmark tone="light" href="/" />}
      title="Something went wrong"
      subtitle="This page didn’t load. It’s usually temporary."
    >
      <InfoCard
        icon={<RefreshCw />}
        title="Try again in a moment"
        body="If it keeps happening, check your connection and reload the page."
      />
      {digest && (
        <p className="text-center text-caption font-medium text-ink-muted">
          Reference <span className="tabular">{digest}</span>
        </p>
      )}
      <SheetActions>
        <Button size="lg" onClick={() => retry()}>
          Try again
        </Button>
        <ActionFootnote>
          <Link href="/" className="ff-focus rounded-md font-semibold text-brand-ink hover:underline">
            Go to FiveFrames
          </Link>
        </ActionFootnote>
      </SheetActions>
    </GuestShell>
  );
}
