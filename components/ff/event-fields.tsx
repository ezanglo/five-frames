"use client";

import { useState } from "react";
import { Clock, Eye, Globe } from "lucide-react";
import type { EventRow } from "@/lib/db/types";
import { labelItems, REVEAL_MODE_LABEL, VISIBILITY_LABEL } from "@/lib/events/labels";
import { utcIsoToZonedDateTimeLocal } from "@/lib/events/timezone";
import { Field, SelectInput, TextInput } from "./field";

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
  onTimezoneChange,
  layout = "stack",
}: {
  event: Pick<EventRow, "name" | "event_date" | "timezone"> | null;
  timezones: string[];
  onNameChange?: (value: string) => void;
  onTimezoneChange?: (value: string) => void;
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
          onChange={(e) => onTimezoneChange?.(e.target.value)}
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

/**
 * After the party (Create · Details, Settings · Event & gallery): reveal timing and gallery
 * visibility (product.md §7.4, §8.2) — the same fields with the same defaults as before; only
 * their place moved (design-direction "Create → Look is only the look"). The sharing setting
 * lives in Look as Guest keepsakes.
 */
export function AfterPartyFields({
  event,
  timezone: timezoneOverride,
}: {
  event: Pick<EventRow, "reveal_mode" | "reveal_at" | "visibility" | "timezone"> | null;
  /** The timezone currently chosen in the same form, for the custom reveal time hint. */
  timezone?: string;
}) {
  const [revealMode, setRevealMode] = useState(event?.reveal_mode ?? "after_event");
  const timezone = timezoneOverride ?? event?.timezone ?? "Asia/Manila";

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
    </div>
  );
}
