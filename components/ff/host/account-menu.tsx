import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { initialsFor } from "../avatar";
import { cn } from "@/lib/utils";

/**
 * Account button (DS04 host bar / desktop nav): initials circle that opens the account menu
 * (email + sign out). A native <details> disclosure, so it works before hydration too.
 */
export function AccountMenu({
  name,
  email,
  tone = "dark",
}: {
  name: string | null;
  email: string;
  tone?: "dark" | "frosted";
}) {
  return (
    <details className="group relative">
      <summary
        aria-label="Account menu"
        className={cn(
          "ff-focus flex size-10 cursor-pointer list-none items-center justify-center rounded-full text-micro font-bold [&::-webkit-details-marker]:hidden",
          tone === "dark" ? "bg-ink text-ink-inverse" : "ff-frosted text-ink-inverse",
        )}
      >
        {initialsFor(name ?? email)}
      </summary>
      <div className="absolute top-12 right-0 z-30 flex w-64 flex-col gap-1 rounded-lg border border-line bg-surface p-2 text-ink shadow-[0_12px_32px_rgb(21_20_26/0.14)]">
        <div className="flex flex-col px-3 py-2">
          {name && <span className="truncate text-label font-bold">{name}</span>}
          <span className="truncate text-caption font-medium text-ink-muted">{email}</span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="ff-focus flex h-11 w-full items-center gap-2 rounded-sm px-3 text-label font-semibold hover:bg-surface-subtle"
          >
            <LogOut className="size-4 text-ink-muted" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
