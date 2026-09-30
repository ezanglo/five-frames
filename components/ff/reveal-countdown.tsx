"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { splitDuration } from "@/lib/events/format";

/**
 * Reveal countdown (DS05): locked gallery only, for a host-set custom reveal time. Seconds in
 * violet, tabular numbers so digits don't jitter. The visual ticks every second, but screen
 * readers hear a polite announcement at most once a minute (DS06 accessibility). When the
 * reveal time passes, the route refreshes — the server re-checks reveal, nothing client-side
 * ever unlocks the gallery.
 */
export function RevealCountdown({ revealAt, label }: { revealAt: string; label: string }) {
  const router = useRouter();
  const target = Date.parse(revealAt);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const remaining = now === null ? null : target - now;

  useEffect(() => {
    if (remaining !== null && remaining <= 0) router.refresh();
  }, [remaining !== null && remaining <= 0, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const parts = splitDuration(remaining ?? 0);
  const units =
    parts.days > 0
      ? [
          { value: parts.days, unit: "days" },
          { value: parts.hours, unit: "hours" },
          { value: parts.minutes, unit: "mins", accent: true },
        ]
      : [
          { value: parts.hours, unit: "hours" },
          { value: parts.minutes, unit: "mins" },
          { value: parts.seconds, unit: "secs", accent: true },
        ];
  const minuteAnnouncement =
    parts.days > 0
      ? `${parts.days} days ${parts.hours} hours left`
      : `${parts.hours} hours ${parts.minutes} minutes left`;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-brand-tint p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-label font-semibold text-brand-ink">Reveal in</p>
        <p className="text-caption font-medium text-ink-on-tint">{label}</p>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-hidden>
        {units.map((u) => (
          <div key={u.unit} className="flex flex-col items-center rounded-sm bg-surface py-3">
            <span
              className={`tabular text-[26px] leading-none font-extrabold ${u.accent ? "text-brand-ink" : "text-ink"}`}
            >
              {now === null ? "–" : String(u.value).padStart(2, "0")}
            </span>
            <span className="mt-1 text-micro font-medium text-ink-muted">{u.unit}</span>
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {now === null ? "" : minuteAnnouncement}
      </p>
    </div>
  );
}
