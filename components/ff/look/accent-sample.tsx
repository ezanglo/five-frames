import type { CSSProperties } from "react";
import { accentCssVars, type AccentKey } from "@/lib/theme/accents";

/**
 * The inline accent sample under the swatches (design-direction "Host · Look studio"): a guest
 * button and the hashtag chip on the event tint, rendered with the same scoped role variables
 * the guest screens use. It is the only immediate feedback on mobile, where the big preview is
 * further down. With no hashtag the chip is simply absent.
 */
export function AccentSample({ accent, hashtag }: { accent: AccentKey; hashtag: string | null }) {
  return (
    <div
      aria-hidden
      style={accentCssVars(accent) as CSSProperties}
      className="ff-event-theme flex items-center gap-2 rounded-xl bg-brand-tint p-1.5"
    >
      <span className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-full bg-brand px-4 text-label font-semibold text-brand-foreground shadow-glow">
        <span className="truncate">Join &amp; start shooting</span>
      </span>
      {hashtag && (
        <span className="flex h-10 max-w-[48%] items-center rounded-full bg-surface px-3.5 text-label font-bold text-brand-ink">
          <span className="truncate">#{hashtag}</span>
        </span>
      )}
    </div>
  );
}
