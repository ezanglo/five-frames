import { LifeBuoy } from "lucide-react";

/**
 * Shown on every host event page an operator opens in support access (product.md §5.1.3,
 * criterion 89), so a customer's event is never mistaken for the operator's own. Names the
 * event's host. Rendered only for the `support` role; the owner never sees it.
 */
export function SupportBanner({ hostEmail }: { hostEmail: string | null }) {
  return (
    <div
      role="status"
      className="border-b border-line bg-brand-tint px-5 py-2.5 text-ink lg:px-10"
    >
      <p className="mx-auto flex max-w-[1280px] items-start gap-2.5 text-caption font-semibold">
        <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Support access · You’re working on{" "}
          <span className="break-all">{hostEmail ?? "a customer"}</span>’s event as FiveFrames
          support. Every change and photo view is logged and shown to the host.
        </span>
      </p>
    </div>
  );
}
