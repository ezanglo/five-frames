"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ff/button";
import { cn } from "@/lib/utils";

type Guard = { dirty: boolean; setDirty: (dirty: boolean) => void };

const SettingsGuard = createContext<Guard>({ dirty: false, setDirty: () => {} });

/**
 * Settings sub-sections (design-direction "Settings"): Event & gallery · Look · Links, each its
 * own form with the existing unsaved-changes guard. The active form reports whether it has unsaved
 * edits; switching sub-section while it does asks first, the same as leaving the page
 * (`beforeunload`, handled by each form).
 */
export function SettingsGuardProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  return <SettingsGuard.Provider value={{ dirty, setDirty }}>{children}</SettingsGuard.Provider>;
}

/** Report a form's unsaved state to the sub-section guard, and warn before unloading. */
export function useUnsavedChanges(dirty: boolean, submitting: boolean) {
  const { setDirty } = useContext(SettingsGuard);
  useEffect(() => {
    setDirty(dirty && !submitting);
    return () => setDirty(false);
  }, [dirty, submitting, setDirty]);

  useEffect(() => {
    if (!dirty || submitting) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, submitting]);
}

export function SettingsSubnav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dirty, setDirty } = useContext(SettingsGuard);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const base = `/events/${eventId}/settings`;
  const sections = [
    { href: base, label: "Event & gallery", active: pathname === base },
    { href: `${base}/look`, label: "Look", active: pathname.startsWith(`${base}/look`) },
    { href: `${base}/links`, label: "Links", active: pathname.startsWith(`${base}/links`) },
  ];

  function onNavigate(event: MouseEvent<HTMLAnchorElement>, href: string, active: boolean) {
    if (active || !dirty) return;
    event.preventDefault();
    setPendingHref(href);
    dialogRef.current?.showModal();
  }

  function leave() {
    dialogRef.current?.close();
    setDirty(false);
    if (pendingHref) router.push(pendingHref);
  }

  return (
    <>
      <nav aria-label="Settings sections" className="flex max-w-full overflow-x-auto">
        <ul className="inline-flex h-11 gap-1 rounded-full bg-surface-subtle p-1 lg:bg-surface lg:shadow-card">
          {sections.map((section) => (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={section.active ? "page" : undefined}
                onClick={(e) => onNavigate(e, section.href, section.active)}
                className={cn(
                  "ff-focus flex h-9 items-center rounded-full px-4 text-label font-semibold whitespace-nowrap transition-colors",
                  section.active ? "bg-ink text-ink-inverse" : "text-ink-muted hover:text-ink",
                )}
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-40px)] max-w-[400px] rounded-xl bg-surface p-0 text-ink backdrop:bg-surface-dark/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading font-bold">Leave without saving?</h2>
            <p className="text-body text-ink-muted">Your changes in this section haven’t been saved.</p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" size="md" onClick={leave}>
              Leave
            </Button>
            <Button variant="dark" size="md" autoFocus onClick={() => dialogRef.current?.close()}>
              Keep editing
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** The amber unsaved-changes card: Discard and Save changes (DS06 settings pattern). */
export function UnsavedChangesCard({
  note,
  submitting,
  onDiscard,
  className,
}: {
  note?: ReactNode;
  submitting: boolean;
  onDiscard: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 lg:flex-row lg:items-center lg:justify-between lg:rounded-3xl lg:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <p className="flex items-center gap-2 text-label font-semibold text-ink" role="status">
          <span aria-hidden className="size-2 rounded-full bg-warning" />
          Unsaved changes
        </p>
        {note && <p className="text-caption font-medium text-ink-muted">{note}</p>}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-3">
        <Button variant="secondary" size="md" onClick={onDiscard} disabled={submitting}>
          Discard
        </Button>
        <Button variant="dark" size="md" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
