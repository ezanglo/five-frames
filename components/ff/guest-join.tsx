import type { ReactNode } from "react";
import { ShieldCheck, Smartphone, UserX } from "lucide-react";
import { SHOTS_PER_GUEST } from "./shots";

export const DEFAULT_WELCOME =
  "Catch the moments that matter to you. Every shot you keep goes into this event’s gallery.";

/**
 * The open Join screen's greeting (guest 01): the allowance stated plainly, then the host's
 * welcome message. Shared by the real guest page and the host's Look preview so the preview is
 * the actual screen, not a drawing of it.
 */
export function JoinIntro({ message }: { message: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-heading text-title font-semibold text-ink">
        You’ve got {SHOTS_PER_GUEST} shots.
      </h2>
      <p className="text-body whitespace-pre-line text-ink-muted">{message ?? DEFAULT_WELCOME}</p>
    </div>
  );
}

/**
 * Trust cues (product.md §4 principle 9, acceptance criterion 9): no app, no account, and
 * captures follow this event's own access rules — short, and no stronger than §8 delivers.
 */
export function TrustRow() {
  return (
    <ul className="flex flex-col gap-2 rounded-lg bg-surface-subtle p-4 text-caption font-medium text-ink-muted">
      <TrustItem icon={<Smartphone />}>No app to download</TrustItem>
      <TrustItem icon={<UserX />}>No account — just your first name</TrustItem>
      <TrustItem icon={<ShieldCheck />}>Your photos follow this event’s own access settings</TrustItem>
    </ul>
  );
}

function TrustItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-brand-ink">
      {icon}
      {children}
    </li>
  );
}
