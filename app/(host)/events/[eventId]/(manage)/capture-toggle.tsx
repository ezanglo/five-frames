"use client";

import { useOptimistic, useTransition } from "react";
import { cn } from "@/lib/utils";

/**
 * The capture on/off switch (DS05 outlined section card, host dashboard "Capture"). Presents the
 * existing open/close actions (product.md §7.3) as a toggle; the server re-derives lifecycle
 * state before every mutation, and refuses to reopen after the automatic safety-net close.
 */
export function CaptureToggle({
  open,
  canToggle,
  openAction,
  closeAction,
}: {
  open: boolean;
  canToggle: boolean;
  openAction: () => Promise<void>;
  closeAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticOpen, setOptimisticOpen] = useOptimistic(open);

  function toggle() {
    startTransition(async () => {
      setOptimisticOpen(!optimisticOpen);
      await (optimisticOpen ? closeAction() : openAction());
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimisticOpen}
      aria-label="Guests can take photos"
      disabled={!canToggle || pending}
      onClick={toggle}
      className={cn(
        "ff-focus relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        optimisticOpen ? "bg-brand" : "bg-line",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[3px] left-[3px] size-6 rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.2)] transition-transform",
          optimisticOpen && "translate-x-[22px]",
        )}
      />
    </button>
  );
}
