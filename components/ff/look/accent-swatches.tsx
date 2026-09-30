"use client";

import { Check } from "lucide-react";
import { ACCENTS, DEFAULT_ACCENT, accentFor, type AccentKey } from "@/lib/theme/accents";
import { cn } from "@/lib/utils";

/**
 * Event color (docs/design-direction.md → "Color"): the seven curated swatches as native radio
 * buttons in one group, so arrow keys move the selection and it posts with the form as
 * `accentColor`. Each target is 44 × 44. The selected swatch carries a check (ink on marigold,
 * white otherwise) and a ring, and the label beside the row names the color, so selection is
 * never shown by color alone. There is deliberately no hex field or free picker.
 */
export function AccentSwatches({
  value,
  onChange,
  name = "accentColor",
  describedBy,
}: {
  value: AccentKey;
  onChange: (key: AccentKey) => void;
  name?: string;
  describedBy?: string;
}) {
  const selected = accentFor(value);
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={describedBy}>
      <legend className="mb-2 text-label font-semibold text-ink">Event color</legend>
      <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1">
        {ACCENTS.map((accent) => {
          const checked = accent.key === value;
          return (
            <label key={accent.key} className="relative flex size-11 cursor-pointer items-center justify-center">
              <input
                type="radio"
                name={name}
                value={accent.key}
                checked={checked}
                onChange={() => onChange(accent.key)}
                className="peer sr-only"
              />
              <span className="sr-only">
                {accent.label}
                {accent.key === DEFAULT_ACCENT ? " (default)" : ""}
              </span>
              <span
                aria-hidden
                style={{ backgroundColor: accent.roles.base, color: accent.roles.fillText }}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-[box-shadow,transform] duration-150",
                  "peer-focus-visible:shadow-[0_0_0_6px_var(--color-surface-base),0_0_0_8px_var(--color-text-primary)]",
                )}
              >
                {checked && <Check className="size-4" strokeWidth={3} />}
              </span>
              {checked && (
                <span
                  aria-hidden
                  style={{ boxShadow: `0 0 0 2px ${accent.roles.base}` }}
                  className="pointer-events-none absolute inset-[3px] rounded-full"
                />
              )}
            </label>
          );
        })}
      </div>
      <p aria-hidden className="pl-1.5 text-label font-medium text-ink-muted">
        {selected.label}
        {selected.key === DEFAULT_ACCENT ? " · default" : ""}
      </p>
    </fieldset>
  );
}
