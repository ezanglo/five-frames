"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import type { EventRow } from "@/lib/db/types";
import { formatEventDate } from "@/lib/events/format";
import { Button } from "@/components/ff/button";
import { SectionCard } from "@/components/ff/cards";
import { EventDetailsFields, GalleryFields, WelcomeFields } from "@/components/ff/event-fields";
import { GuestJoinPreview } from "@/components/ff/guest-preview";

function serialize(form: HTMLFormElement): string {
  const data = new FormData(form);
  if (!data.has("sharingEnabled")) data.set("sharingEnabled", "off");
  return new URLSearchParams(data as unknown as Record<string, string>).toString();
}

/**
 * Settings tab (D8 / mobile 06b). Form cards on the left; on desktop a live guest preview and,
 * sticky beneath it, the save card — which only appears once something changed (amber dot =
 * unsaved). Leaving with unsaved edits asks first. Mobile keeps one scrolling column with Save
 * at the end.
 */
export function SettingsForm({
  event,
  timezones,
  action,
  saved,
  previewStatus,
}: {
  event: EventRow;
  timezones: string[];
  action: (formData: FormData) => Promise<void>;
  saved: boolean;
  /** Present only for activated events — no guest preview before payment (product.md §7.2). */
  previewStatus: "open" | "not-open" | "closed" | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const initialRef = useRef<string>("");
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(event.name);
  const [message, setMessage] = useState(event.host_message ?? "");

  useEffect(() => {
    if (formRef.current) initialRef.current = serialize(formRef.current);
  }, [formKey]);

  useEffect(() => {
    if (!dirty || submitting) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, submitting]);

  function recheck() {
    if (formRef.current) setDirty(serialize(formRef.current) !== initialRef.current);
  }

  function discard() {
    setFormKey((k) => k + 1);
    setName(event.name);
    setMessage(event.host_message ?? "");
    setDirty(false);
  }

  const saveCard = (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 lg:rounded-3xl lg:p-5">
      <p className="flex items-center gap-2 text-label font-semibold text-ink" role="status">
        <span aria-hidden className="size-2 rounded-full bg-warning" />
        Unsaved changes
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="md" onClick={discard} disabled={submitting}>
          Discard
        </Button>
        <Button variant="dark" size="md" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );

  return (
    <form
      key={formKey}
      ref={formRef}
      action={action}
      onInput={recheck}
      onChange={recheck}
      onSubmit={() => setSubmitting(true)}
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6"
    >
      <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
        {saved && !dirty && (
          <p
            role="status"
            className="flex items-center gap-2.5 rounded-lg bg-success-tint p-4 text-label font-semibold text-success"
          >
            <CircleCheck className="size-4" aria-hidden />
            Changes saved.
          </p>
        )}
        <SectionCard
          title="Event details"
          caption="What guests see when they open your link"
          titleFont="heading"
        >
          <EventDetailsFields event={event} timezones={timezones} onNameChange={setName} layout="grid" />
        </SectionCard>
        <SectionCard
          title="Look & welcome"
          caption="Make the guest screens feel like your party"
          titleFont="heading"
        >
          <WelcomeFields event={event} onMessageChange={setMessage} />
        </SectionCard>
        <SectionCard
          title="Gallery & sharing"
          caption="When the gallery opens, who it opens for, and guest sharing"
          titleFont="heading"
        >
          <GalleryFields event={event} />
        </SectionCard>

        <div className="lg:hidden">
          <Button variant="dark" size="md" type="submit" disabled={!dirty || submitting} className="w-full">
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-[160px] flex flex-col gap-4">
          {previewStatus && (
            <>
              <p className="text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
                Guest preview
              </p>
              <GuestJoinPreview
                name={name}
                dateLabel={formatEventDate(event.event_date)}
                message={message.trim() || null}
                status={previewStatus}
              />
            </>
          )}
          {dirty && saveCard}
        </div>
      </div>
    </form>
  );
}
