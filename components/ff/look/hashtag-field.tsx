"use client";

import { useId } from "react";
import { HASHTAG_ERROR, HASHTAG_MAX, normalizeHashtag } from "@/lib/theme/hashtag";
import { Counter, fieldControlClass } from "@/components/ff/field";
import { cn } from "@/lib/utils";

/**
 * Hashtag (design-direction "Hashtag"): a fixed "#" inside the field, so a typed one is stripped;
 * a counter to 30 (the same server-side constant); the helper text; and an explicit invalid
 * state — danger border plus the reason in words, tied to the input. One hashtag only, printed
 * text only: no social integration of any kind.
 */
export function HashtagField({
  value,
  onChange,
  name = "hashtag",
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const result = normalizeHashtag(value);
  const error = result.ok ? null : HASHTAG_ERROR[result.reason];
  const length = [...value.trim()].length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label font-semibold text-ink">
          Hashtag<span className="ml-1.5 font-medium text-ink-muted">optional</span>
        </label>
        <Counter value={length} max={HASHTAG_MAX} />
      </div>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[16px] font-semibold text-ink-muted"
        >
          #
        </span>
        <input
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/^\s*#+/, ""))}
          placeholder="e.g. DaniTurns40"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={HASHTAG_MAX + 10}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={cn(fieldControlClass, "h-12 pr-4 pl-9")}
        />
      </div>
      {error ? (
        <p id={messageId} role="alert" className="text-caption font-medium text-danger">
          {error}
        </p>
      ) : (
        <p id={messageId} className="text-caption font-medium text-ink-muted">
          Printed on keepsakes and signage. Leave it empty and nothing takes its place.
        </p>
      )}
    </div>
  );
}
