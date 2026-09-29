"use client";

import { useActionState } from "react";
import { ArrowRight, Camera } from "lucide-react";
import type { EventRow } from "@/lib/db/types";
import type { EventFormState } from "./actions";
import { Button } from "@/components/ff/button";
import { InfoCard, SectionCard } from "@/components/ff/cards";
import { EventDetailsFields, GalleryFields, WelcomeFields } from "@/components/ff/event-fields";
import { WizardActions } from "@/components/ff/host/wizard";

type StepAction = (prev: EventFormState, formData: FormData) => Promise<EventFormState>;

/** Create · Details (step 1): name, date, timezone — no capture window; the host opens capture. */
export function DetailsStepForm({
  action,
  event,
  timezones,
  cancelHref,
}: {
  action: StepAction;
  event: EventRow | null;
  timezones: string[];
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction} className="flex flex-1 flex-col gap-5 lg:gap-6">
      <div className="lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:p-6">
        <div className="flex flex-col gap-5">
          <EventDetailsFields event={event} timezones={timezones} />
          <InfoCard
            icon={<Camera />}
            title="Every guest gets exactly 5 shots"
            body="Capture opens only when you switch it on — usually at the venue. You can change everything else later in Settings."
            className="bg-brand-tint [&_p:last-child]:text-ink-on-tint"
          />
        </div>
      </div>
      {state.error && (
        <p className="text-caption font-medium text-danger" role="alert">
          {state.error}
        </p>
      )}
      <WizardActions backHref={cancelHref} backLabel="Cancel">
        <Button type="submit" disabled={pending} className="w-full lg:w-auto lg:px-8">
          {pending ? "Saving…" : "Continue"}
          <ArrowRight aria-hidden />
        </Button>
      </WizardActions>
    </form>
  );
}

/** Create · Look (step 2): welcome message, hashtag, and the gallery/sharing defaults. */
export function LookStepForm({
  action,
  event,
  backHref,
}: {
  action: StepAction;
  event: EventRow;
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction} className="flex flex-1 flex-col gap-5 lg:gap-6">
      <SectionCard title="Welcome" caption="What guests read before they join" className="max-lg:border-0 max-lg:p-0">
        <WelcomeFields event={event} />
      </SectionCard>
      <SectionCard
        title="After the party"
        caption="When the gallery opens and who can see it. Change it anytime."
        className="max-lg:border-0 max-lg:p-0"
      >
        <GalleryFields event={event} />
      </SectionCard>
      {state.error && (
        <p className="text-caption font-medium text-danger" role="alert">
          {state.error}
        </p>
      )}
      <WizardActions backHref={backHref}>
        <Button type="submit" disabled={pending} className="w-full lg:w-auto lg:px-8">
          {pending ? "Saving…" : "Continue"}
          <ArrowRight aria-hidden />
        </Button>
      </WizardActions>
    </form>
  );
}
