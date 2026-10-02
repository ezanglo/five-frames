"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/operator", label: "Events" },
  { href: "/operator/payments", label: "Payments" },
];

/** Operator Console sections. An event's detail page belongs to Events. */
export function OperatorNav() {
  const pathname = usePathname();
  const current = pathname.startsWith("/operator/payments") ? "/operator/payments" : "/operator";

  return (
    <div className="flex items-center gap-1">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === current ? "page" : undefined}
          className={cn(
            "ff-focus flex h-9 items-center rounded-full px-3 text-label font-semibold sm:px-4",
            item.href === current ? "bg-brand-tint text-brand" : "text-ink-muted hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
