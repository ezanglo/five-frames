"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import type { EventRow } from "@/lib/db/types";
import type { EventFormState } from "@/app/(host)/events/actions";
import { SectionCard } from "@/components/ff/cards";
import { AfterPartyFields, EventDetailsFields } from "@/components/ff/event-fields";
import { UnsavedChangesCard, useUnsavedChanges } from "@/components/ff/host/settings-sections";

function serialize(form: HTMLFormElement): string {
  return new URLSearchParams(new FormData(form) as unknown as Record<string, string>).toString();
}

/**
 * Settings · Event & gallery: what guests see when they open the link (name, date, timezone)
 * and After the party (reveal timing, visibility). The unsaved card — amber dot, Discard, Save
 * changes — appears once something changed; leaving or switching sub-section asks first.
 */
export function EventGalleryForm({
  event,
  timezones,
  action,
  saved,
}: {
  event: EventRow;
  timezones: string[];
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  saved: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const initialRef = useRef<string>("");
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [timezone, setTimezone] = useState(event.timezone);
  const [state, formAction, pending] = useActionState(action, { error: null });
  useUnsavedChanges(dirty, pending);

  // A save re-renders the page with the stored event: that is the new baseline, so nothing is
  // unsaved any more (reset during render, React's pattern for state derived from a prop).
  const [baselineEvent, setBaselineEvent] = useState(event);
  if (baselineEvent !== event) {
    setBaselineEvent(event);
    setDirty(false);
  }

  useEffect(() => {
    if (formRef.current) initialRef.current = serialize(formRef.current);
  }, [formKey, event]);

  function recheck() {
    if (formRef.current) setDirty(serialize(formRef.current) !== initialRef.current);
  }

  function discard() {
    setFormKey((k) => k + 1);
    setTimezone(event.timezone);
    setDirty(false);
  }

  return (
    <form
      key={formKey}
      ref={formRef}
      action={formAction}
      onInput={recheck}
      onChange={recheck}
      className="flex flex-col gap-5 lg:max-w-[820px] lg:gap-6"
    >
      {saved && !dirty && (
        <p
          role="status"
          className="flex items-center gap-2.5 rounded-lg bg-success-tint p-4 text-label font-semibold text-success"
        >
          <CircleCheck className="size-4" aria-hidden />
          Changes saved.
        </p>
      )}
      <SectionCard title="Event details" caption="What guests see when they open your link" titleFont="heading">
        <EventDetailsFields event={event} timezones={timezones} onTimezoneChange={setTimezone} layout="grid" />
      </SectionCard>
      <SectionCard
        title="After the party"
        caption="When the gallery opens and who can see it"
        titleFont="heading"
      >
        <AfterPartyFields event={event} timezone={timezone} />
      </SectionCard>
      {state.error && (
        <p className="text-caption font-medium text-danger" role="alert">
          {state.error}
        </p>
      )}
      {dirty && (
        <UnsavedChangesCard
          submitting={pending}
          onDiscard={discard}
          className="sticky bottom-3 z-10 shadow-[0_8px_24px_rgb(21_20_26/0.12)]"
        />
      )}
    </form>
  );
}
