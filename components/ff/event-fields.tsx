"use client";

import { useState } from "react";
import { Clock, Eye, Globe, Hash } from "lucide-react";
import type { EventRow } from "@/lib/db/types";
import { labelItems, REVEAL_MODE_LABEL, VISIBILITY_LABEL } from "@/lib/events/labels";
import { utcIsoToZonedDateTimeLocal } from "@/lib/events/timezone";
import { Counter, Field, SelectInput, TextArea, TextInput, Toggle } from "./field";

/** Welcome message limit (DS04: max 140 welcome). */
export const WELCOME_MAX = 140;

const REVEAL_MODE_ITEMS = labelItems(REVEAL_MODE_LABEL);
const VISIBILITY_ITEMS = labelItems(VISIBILITY_LABEL);

/**
 * Event details fields (Create · Details, Settings · Event details): name, date, timezone.
 * The date is a calendar date; the timezone is the event's own, used for every event-local
 * time (lib/events/timezone.ts). There are no capture open/close times — capture is opened and
 * closed by the host (product.md §7.3).
 */
export function EventDetailsFields({
  event,
  timezones,
  onNameChange,
  layout = "stack",
}: {
  event: Pick<EventRow, "name" | "event_date" | "timezone"> | null;
  timezones: string[];
  onNameChange?: (value: string) => void;
  layout?: "stack" | "grid";
}) {
  return (
    <div className={layout === "grid" ? "grid gap-5 lg:grid-cols-2" : "flex flex-col gap-5"}>
      <Field
        label="Event name"
        htmlFor="name"
        hint="Guests see this on the join screen."
        className={layout === "grid" ? "lg:col-span-2" : undefined}
      >
        <TextInput
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={event?.name ?? ""}
          placeholder="e.g. Leo’s Graduation Party"
          onChange={(e) => onNameChange?.(e.target.value)}
        />
      </Field>
      <Field label="Date" htmlFor="eventDate" optional>
        <TextInput
          id="eventDate"
          name="eventDate"
          type="date"
          defaultValue={event?.event_date ?? ""}
        />
      </Field>
      <Field label="Timezone" htmlFor="timezone">
        <SelectInput
          id="timezone"
          name="timezone"
          defaultValue={event?.timezone ?? "Asia/Manila"}
          icon={<Globe />}
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </SelectInput>
      </Field>
    </div>
  );
}

/** Welcome message + hashtag (Create · Look "Make it yours", Settings · Look & welcome). */
export function WelcomeFields({
  event,
  onMessageChange,
}: {
  event: Pick<EventRow, "host_message" | "hashtag"> | null;
  onMessageChange?: (value: string) => void;
}) {
  const [message, setMessage] = useState(event?.host_message ?? "");
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Welcome message"
        htmlFor="hostMessage"
        optional
        aside={<Counter value={message.length} max={WELCOME_MAX} />}
        hint="Shown to guests on the join screen and at the top of the gallery."
      >
        <TextArea
          id="hostMessage"
          name="hostMessage"
          value={message}
          maxLength={Math.max(WELCOME_MAX, event?.host_message?.length ?? 0)}
          onChange={(e) => {
            setMessage(e.target.value);
            onMessageChange?.(e.target.value);
          }}
          placeholder="Thanks for celebrating with us! Snap your five favorites."
        />
      </Field>
      <Field label="Hashtag" htmlFor="hashtag" optional hint="Printed on the share cards guests create.">
        <TextInput
          id="hashtag"
          name="hashtag"
          defaultValue={event?.hashtag ?? ""}
          placeholder="#LeoGrad2026"
          icon={<Hash />}
        />
      </Field>
    </div>
  );
}

/** Reveal timing, gallery visibility and the sharing toggle (product.md §7.4, §8.2, §10). */
export function GalleryFields({
  event,
}: {
  event: Pick<
    EventRow,
    "reveal_mode" | "reveal_at" | "visibility" | "sharing_enabled" | "timezone"
  > | null;
}) {
  const [revealMode, setRevealMode] = useState(event?.reveal_mode ?? "after_event");
  const timezone = event?.timezone ?? "Asia/Manila";

  return (
    <div className="flex flex-col gap-5">
      <Field label="When should the gallery reveal?" htmlFor="revealMode">
        <SelectInput
          id="revealMode"
          name="revealMode"
          value={revealMode}
          onChange={(e) => setRevealMode(e.target.value as typeof revealMode)}
          icon={<Clock />}
        >
          {REVEAL_MODE_ITEMS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectInput>
      </Field>
      {revealMode === "custom" && (
        <Field
          label="Reveal time"
          htmlFor="revealAt"
          hint={`In the event’s timezone (${timezone.replaceAll("_", " ")}).`}
        >
          <TextInput
            id="revealAt"
            name="revealAt"
            type="datetime-local"
            required
            defaultValue={
              event?.reveal_at ? utcIsoToZonedDateTimeLocal(event.reveal_at, timezone) : ""
            }
          />
        </Field>
      )}
      <Field label="Who can open the gallery link?" htmlFor="visibility">
        <SelectInput
          id="visibility"
          name="visibility"
          defaultValue={event?.visibility ?? "anyone_with_link"}
          icon={<Eye />}
        >
          {VISIBILITY_ITEMS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectInput>
      </Field>
      <label className="flex items-center justify-between gap-4 rounded-lg bg-surface-subtle p-4">
        <span className="flex flex-col gap-0.5">
          <span className="text-label font-semibold text-ink">Guest sharing</span>
          <span className="text-caption font-medium text-ink-muted">
            Lets guests share a FiveFrames card of their own photos. It can’t stop anyone sharing
            photos already on their phone.
          </span>
        </span>
        <Toggle name="sharingEnabled" defaultChecked={event?.sharing_enabled ?? true} />
      </label>
    </div>
  );
}
