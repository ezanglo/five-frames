"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type JourneyStep = { title: string; body: string; visual: ReactNode };

/**
 * The guest journey as a tab set: the step list on one side, the matching screen on the other.
 * No autoplay — the visitor moves through it. Arrow keys, Home and End move between steps
 * (WAI-ARIA tabs pattern). Every step's text is server-rendered, so it stays crawlable and
 * readable without JavaScript; only the visual swaps.
 */
export function GuestJourney({ steps }: { steps: JourneyStep[] }) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    const next = (index + steps.length) % steps.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => select(active + 1),
      ArrowRight: () => select(active + 1),
      ArrowUp: () => select(active - 1),
      ArrowLeft: () => select(active - 1),
      Home: () => select(0),
      End: () => select(steps.length - 1),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  return (
    <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
      {/* Below 1024 the steps are a horizontal row above the visual, so a tap changes what's
          on screen; from 1024 they're a vertical list beside it. */}
      <div
        role="tablist"
        aria-label="A guest’s five frames, step by step"
        className="relative -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {steps.map((step, index) => {
          const selected = index === active;
          return (
            <button
              key={step.title}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={`${baseId}-tab-${index}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={onKeyDown}
              className={cn(
                "ff-focus group flex shrink-0 items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-left transition-colors lg:w-full lg:items-start lg:gap-4 lg:rounded-3xl lg:p-5",
                selected
                  ? "border-line bg-surface shadow-card"
                  : "border-line bg-surface lg:border-transparent lg:bg-transparent lg:hover:bg-surface",
              )}
            >
              <span
                className={cn(
                  "tabular flex size-8 shrink-0 items-center justify-center rounded-full text-label font-bold transition-colors lg:size-9",
                  selected ? "bg-brand text-ink-inverse" : "bg-surface-subtle text-ink-muted lg:bg-surface lg:ring-1 lg:ring-line",
                )}
              >
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-1 lg:pt-1.5">
                <span
                  className={cn(
                    "text-label leading-snug font-bold whitespace-nowrap lg:text-[17px] lg:whitespace-normal",
                    selected ? "text-ink" : "text-ink-muted group-hover:text-ink",
                  )}
                >
                  {step.title}
                </span>
                <span
                  className={cn(
                    "text-label font-medium text-ink-muted",
                    // Visible only for the selected step on desktop; always in the DOM so it
                    // stays crawlable and is read with the tab.
                    selected ? "sr-only lg:not-sr-only" : "sr-only",
                  )}
                >
                  {step.body}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile: the selected step's text between the row and the visual (the tab carries the
          same text for assistive tech, so this copy is hidden from it). */}
      <p aria-hidden className="min-h-[4.5em] text-body font-medium text-ink-muted lg:hidden">
        {steps[active].body}
      </p>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
        className="flex justify-center"
      >
        {steps.map((step, index) => (
          <div
            key={step.title}
            hidden={index !== active}
            className="animate-in duration-300 fade-in slide-in-from-bottom-2"
          >
            {step.visual}
          </div>
        ))}
      </div>
    </div>
  );
}
