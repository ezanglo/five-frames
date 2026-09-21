import type { EventLifecycleState } from "@/lib/events/lifecycle";
import { EVENT_LIFECYCLE_STATE_LABEL } from "@/lib/events/lifecycle";

/**
 * Presentation-only color mapping for lifecycle state dots/pills. Deliberately kept in the
 * operator UI rather than lib/events/lifecycle.ts, which holds product logic, not styling.
 */
export function StateDot({ state }: { state: EventLifecycleState }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: `var(--operator-state-${state})` }}
    />
  );
}

export function StatePill({ state }: { state: EventLifecycleState }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--operator-border) bg-(--operator-canvas-raised) px-2 py-0.5 text-xs font-medium text-(--operator-ink)">
      <StateDot state={state} />
      {EVENT_LIFECYCLE_STATE_LABEL[state]}
    </span>
  );
}
