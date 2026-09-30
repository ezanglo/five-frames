"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Camera } from "lucide-react";
import type { EventRow } from "@/lib/db/types";
import type { EventFormState } from "./actions";
import { Button } from "@/components/ff/button";
import { InfoCard, SectionCard } from "@/components/ff/cards";
import { AfterPartyFields, EventDetailsFields } from "@/components/ff/event-fields";
import { WizardActions } from "@/components/ff/host/wizard";

type StepAction = (prev: EventFormState, formData: FormData) => Promise<EventFormState>;

/**
 * Create · Details (step 1): name, date, timezone — no capture window; the host opens capture —
 * then the After the party card (reveal timing and gallery visibility), moved here from Look so
 * that Look is only the look. Same fields, same defaults; the wizard still has three steps.
 */
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
  const [timezone, setTimezone] = useState(event?.timezone ?? "Asia/Manila");
  return (
    <form action={formAction} className="flex flex-1 flex-col gap-5 lg:gap-6">
      <div className="lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:p-6">
        <div className="flex flex-col gap-5">
          <EventDetailsFields event={event} timezones={timezones} onTimezoneChange={setTimezone} />
          <InfoCard
            icon={<Camera />}
            title="Every guest gets exactly 5 shots"
            body="Capture opens only when you switch it on — usually at the venue. You can change everything else later in Settings."
            className="bg-brand-tint [&_p:last-child]:text-ink-on-tint"
          />
        </div>
      </div>
      <SectionCard
        title="After the party"
        caption="When the gallery opens and who can see it. Change it anytime."
        className="max-lg:border-0 max-lg:p-0"
      >
        <AfterPartyFields event={event} timezone={timezone} />
      </SectionCard>
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
