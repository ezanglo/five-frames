"use client";

import { Counter, Field, TextArea, Toggle } from "@/components/ff/field";
import { WELCOME_MAX } from "@/components/ff/event-fields";

/**
 * Welcome message (the existing host message, product.md §11.1). It greets guests on the join
 * screen and is never a keepsake or signage caption — FiveFrames adds no other caption field.
 */
export function WelcomeMessageField({
  value,
  onChange,
  existingLength = 0,
}: {
  value: string;
  onChange: (value: string) => void;
  existingLength?: number;
}) {
  return (
    <Field
      label="Welcome message"
      htmlFor="hostMessage"
      optional
      aside={<Counter value={value.length} max={WELCOME_MAX} />}
      hint="Greets guests on the join screen. It isn’t printed on keepsakes or signage."
    >
      <TextArea
        id="hostMessage"
        name="hostMessage"
        value={value}
        maxLength={Math.max(WELCOME_MAX, existingLength)}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Thanks for celebrating with us! Snap your five favorites."
      />
    </Field>
  );
}

/**
 * Guest keepsakes — the existing sharing setting (`sharing_enabled`), shown here because this is
 * where its effect is visible. One toggle for FiveFrames' own sharing; the copy never claims it
 * can stop a guest sharing what is already on their phone (product.md §10.3).
 */
export function GuestKeepsakesToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-label font-semibold text-ink">Guest keepsakes</span>
        <span className="text-caption font-medium text-ink-muted">
          Guests can share or save their own photos as keepsakes. This can’t stop anyone sharing
          photos already on their phone.
        </span>
      </span>
      <Toggle name="sharingEnabled" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
