import { StatusPill } from "./pill";
import { FiveShotTeaser, SHOTS_PER_GUEST } from "./shots";

/**
 * Guest preview (DS05, desktop Settings right column): a 300×560 phone with an 8px ink bezel
 * mirroring the real Join screen's composition, updating live as the host edits. Non-interactive
 * and host-only — it is a picture, not a guest link, and it is only shown for activated events
 * (product.md §7.2: no guest-experience preview before payment).
 */
export function GuestJoinPreview({
  name,
  dateLabel,
  message,
  status,
}: {
  name: string;
  dateLabel: string | null;
  message: string | null;
  status: "open" | "not-open" | "closed";
}) {
  return (
    <div
      aria-label="Preview of the guest join screen"
      role="img"
      className="mx-auto flex h-[560px] w-[300px] flex-col overflow-hidden rounded-[40px] border-8 border-ink bg-surface-dark shadow-[0_24px_48px_rgb(21_20_26/0.18)]"
    >
      <div className="ff-photo-header flex h-[190px] shrink-0 flex-col justify-end gap-1.5 px-4 pb-8 text-ink-inverse">
        <StatusPill
          tone="frosted"
          size="sm"
          icon={status === "open" ? "live" : status === "closed" ? "revealed-dot" : "clock"}
        >
          {status === "open" ? "Capture is live" : status === "closed" ? "Capture closed" : "Not open yet"}
        </StatusPill>
        <p className="font-heading text-[22px] leading-tight font-semibold break-words">
          {name || "Your event"}
        </p>
        {dateLabel && <p className="text-[11px] font-medium text-ink-inverse/85">{dateLabel}</p>}
      </div>
      <div className="relative -mt-5 flex flex-1 flex-col gap-3 rounded-t-[22px] bg-surface px-4 pt-4 pb-4">
        <p className="font-heading text-[17px] font-semibold text-ink">
          You’ve got {SHOTS_PER_GUEST} shots.
        </p>
        <FiveShotTeaser size="sm" />
        {message ? (
          <p className="line-clamp-3 rounded-md bg-brand-tint px-3 py-2 text-[11px] font-medium text-ink-on-tint">
            “{message}”
          </p>
        ) : (
          <p className="h-9 rounded-md bg-surface-subtle" />
        )}
        <span className="mt-auto flex h-10 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-ink-inverse">
          Join &amp; start shooting
        </span>
      </div>
    </div>
  );
}
