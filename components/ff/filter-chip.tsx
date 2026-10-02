import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** A link that narrows a list (Operator Console filters). The active one is ink, the rest outlined. */
export function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "ff-focus flex h-9 shrink-0 items-center rounded-full px-4 text-label font-semibold",
        active
          ? "bg-ink text-ink-inverse"
          : "border border-line bg-surface text-ink hover:bg-surface-subtle",
      )}
    >
      {children}
    </Link>
  );
}
