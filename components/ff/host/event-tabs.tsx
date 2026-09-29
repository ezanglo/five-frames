"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Event tabs — Dashboard / Photos / Settings, same three tabs in the same order everywhere.
 * Desktop: 2.5px violet underline in a 64h bar under the cover header (DS04). Mobile: the
 * segmented track from DS03 (48h track, 40h tabs, active tab white with the active-tab shadow).
 */
export function EventTabs({
  eventId,
  photoCount,
  variant,
}: {
  eventId: string;
  photoCount: number;
  variant: "underline" | "segmented";
}) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  const tabs = [
    { href: base, label: "Dashboard", active: pathname === base },
    {
      href: `${base}/photos`,
      label: "Photos",
      count: photoCount,
      active: pathname.startsWith(`${base}/photos`),
    },
    { href: `${base}/settings`, label: "Settings", active: pathname.startsWith(`${base}/settings`) },
  ];

  if (variant === "segmented") {
    return (
      <nav aria-label="Event sections" className="grid h-12 grid-cols-3 gap-1 rounded-full bg-surface-subtle p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "ff-focus flex h-10 items-center justify-center gap-1.5 rounded-full text-label font-semibold transition-colors",
              tab.active ? "bg-surface text-ink shadow-tab" : "text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="tabular text-micro font-bold text-brand">{tab.count}</span>
            )}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Event sections" className="flex h-16 items-end gap-8">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "ff-focus flex h-full items-center gap-1.5 border-b-[2.5px] text-[15px] font-semibold transition-colors",
            tab.active
              ? "border-brand text-ink"
              : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="tabular text-micro font-bold text-brand">{tab.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
