"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Props for the panel a SegmentedTabs tab controls. */
export function tabPanelProps(idBase: string, tab: string) {
  return {
    role: "tabpanel" as const,
    id: `${idBase}-${tab}-panel`,
    "aria-labelledby": `${idBase}-${tab}-tab`,
  };
}

/**
 * Segmented control with the ARIA tabs pattern (DS03 segmented track): arrow keys, Home and End
 * move between tabs with a roving tabindex, and each tab controls the panel rendered with
 * `tabPanelProps(idBase, tab)`.
 */
export function SegmentedTabs<T extends string>({
  idBase,
  label,
  tabs,
  value,
  onChange,
  size = "md",
  className,
}: {
  idBase: string;
  label: string;
  tabs: readonly { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  /** `responsive`: compact below 1280, full size from 1280 (the studio stage header). */
  size?: "md" | "sm" | "responsive";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-subtle p-1 [scrollbar-width:none]",
        size === "md" ? "h-12" : size === "sm" ? "h-11" : "h-11 xl:h-12",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${idBase}-${tab.id}-tab`}
            aria-selected={selected}
            aria-controls={`${idBase}-${tab.id}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "ff-focus flex shrink-0 grow items-center justify-center rounded-full px-4 font-semibold whitespace-nowrap transition-colors",
              size === "md"
                ? "h-10 text-label"
                : size === "sm"
                  ? "h-9 text-caption"
                  : "h-9 px-3 text-caption xl:h-10 xl:px-4 xl:text-label",
              selected ? "bg-surface text-ink shadow-tab" : "text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
