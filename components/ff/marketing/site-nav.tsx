"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ButtonLink } from "@/components/ff/button";
import { PUBLIC_NAV } from "@/lib/marketing/site";
import { cn } from "@/lib/utils";

/** Desktop links: the host top nav's pill pattern — the current page is a tint pill. */
export function DesktopNavLinks() {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-1 lg:flex">
      {PUBLIC_NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "ff-focus flex h-9 items-center rounded-full px-4 text-label font-semibold transition-colors",
                active ? "bg-brand-tint text-brand" : "text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Mobile menu (< 1024): a disclosure button that opens a panel under the header. Escape and any
 * link close it and return focus to the button; opening moves focus to the first link.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when the route changes (e.g. browser back while the menu is open).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="ff-focus flex size-11 items-center justify-center rounded-full border border-line bg-surface-subtle text-ink"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-surface px-5 pt-2 pb-6 shadow-[0_24px_40px_-24px_rgb(21_20_26/0.25)]"
      >
        <nav aria-label="Menu">
          <ul className="flex flex-col">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href} className="border-b border-line last:border-0">
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "ff-focus flex h-14 items-center rounded-md text-[17px] font-semibold",
                    pathname === item.href ? "text-brand" : "text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ButtonLink href="/login" variant="secondary" size="md" onClick={() => setOpen(false)}>
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="md" onClick={() => setOpen(false)}>
            Create an event
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
