"use client";

import { useEffect, useState } from "react";
import { Clock, User } from "lucide-react";
import { Button } from "@/components/ff/button";
import { Field, TextInput } from "@/components/ff/field";
import { JoinIntro, TrustRow } from "@/components/ff/guest-join";
import { ActionFootnote, EventDateLine, GuestShell, SheetActions } from "@/components/ff/guest-shell";
import { StatusPill } from "@/components/ff/pill";
import { FiveShotTeaser } from "@/components/ff/shots";
import { parseLookPreviewMessage, type LookPreviewState } from "@/lib/theme/preview";

/**
 * The real open Join screen (guest 01) with the host's live Look state. Updates arrive by
 * `postMessage` from the parent Look page, same origin only, and are validated before use.
 * Nothing here is interactive: it is a picture of the guest screen, not a way into it.
 */
export function GuestJoinPreviewScreen({ initial }: { initial: LookPreviewState }) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const next = parseLookPreviewMessage(event.data);
      if (next) setState(next);
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "ff-look-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const theme = { accent: state.accent, hashtag: state.hashtag, imageUrl: state.imageUrl };

  return (
    <div inert className="pointer-events-none select-none">
      <GuestShell
        pill={
          <StatusPill tone="frosted" icon="live">
            Capture is live
          </StatusPill>
        }
        title={state.name}
        subtitle={
          state.dateLabel || state.hashtag ? (
            <EventDateLine date={state.dateLabel} hashtag={state.hashtag} />
          ) : undefined
        }
        theme={theme}
      >
        <JoinIntro message={state.message} />
        <FiveShotTeaser />
        <TrustRow />
        <div className="flex flex-1 flex-col gap-5">
          <Field label="What should we call you?" htmlFor="preview-name">
            <TextInput id="preview-name" readOnly tabIndex={-1} placeholder="Your first name" icon={<User />} />
          </Field>
          <SheetActions>
            <Button tabIndex={-1} className="w-full">
              Join &amp; start shooting
            </Button>
            <ActionFootnote icon={<Clock />}>
              Open until your host closes capture · No app needed
            </ActionFootnote>
          </SheetActions>
        </div>
      </GuestShell>
    </div>
  );
}
