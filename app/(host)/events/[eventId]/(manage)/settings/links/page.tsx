import { notFound } from "next/navigation";
import { Camera, Images, Link2 } from "lucide-react";
import type { ReactNode } from "react";
import { requireHost } from "@/lib/auth/host-session";
import { getEventForHost } from "@/lib/dal/events";
import { isGalleryRevealed } from "@/lib/events/lifecycle";
import {
  revokeEventTokenAction,
  revokeGalleryTokenAction,
  rotateEventTokenAction,
  rotateGalleryTokenAction,
} from "@/app/(host)/events/actions";
import { ButtonLink } from "@/components/ff/button";
import { HighlightCard, SectionCard } from "@/components/ff/cards";
import { ConfirmButton } from "@/components/ff/confirm-button";
import { CopyLinkButton } from "@/components/ff/copy-button";

export const metadata = { title: "Links · Settings · FiveFrames" };

/**
 * Settings · Links (product.md §8.1): the capture and gallery links, with rotate and revoke.
 * Links only exist after payment (invariant 7), so a draft shows where they'll come from.
 */
export default async function LinksSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const host = await requireHost();
  const event = await getEventForHost(host.id, eventId);
  if (!event) notFound();

  if (!event.activated_at) {
    return (
      <div className="flex flex-col gap-4 lg:max-w-[820px]">
        <HighlightCard
          icon={<Link2 />}
          title="Your links arrive when you activate"
          body="The capture link, its QR code and the gallery link are issued the moment payment is confirmed."
        />
        <ButtonLink href={`/events/${eventId}/setup?step=share`} variant="secondary" size="md" className="self-start">
          Go to activation
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="lg:max-w-[820px]">
      <SectionCard
        title="Links"
        caption="If a link leaks, rotate it — the old one stops working immediately."
        titleFont="heading"
      >
        <LinkRow
          icon={<Camera />}
          label="Capture link"
          help="For guests at the venue — lets them join and shoot while capture is open."
          path={event.event_token ? `/e/${event.event_token}` : null}
          rotate={rotateEventTokenAction.bind(null, eventId)}
          revoke={revokeEventTokenAction.bind(null, eventId)}
        />
        <LinkRow
          icon={<Images />}
          label="Gallery link"
          help={
            !isGalleryRevealed(event)
              ? "View-only. Opens nothing until the gallery is revealed."
              : event.visibility === "only_me"
                ? "View-only. Visibility is set to only you, so it opens nothing for anyone else."
                : "View-only. Anyone with it can see the revealed gallery now."
          }
          path={event.gallery_token ? `/g/${event.gallery_token}` : null}
          rotate={rotateGalleryTokenAction.bind(null, eventId)}
          revoke={revokeGalleryTokenAction.bind(null, eventId)}
        />
      </SectionCard>
    </div>
  );
}

/**
 * One capture or gallery link (product.md §8.1). Rotate issues a new unguessable token and
 * immediately invalidates the old one; revoke clears it; rotate on a revoked link re-issues one.
 */
function LinkRow({
  icon,
  label,
  help,
  path,
  rotate,
  revoke,
}: {
  icon: ReactNode;
  label: string;
  help: string;
  path: string | null;
  rotate: () => Promise<void>;
  revoke: () => Promise<void>;
}) {
  const lower = label.toLowerCase();
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-subtle p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand [&_svg]:size-5">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-label font-bold text-ink">{label}</p>
          <p className="text-caption font-medium text-ink-muted">{help}</p>
          {path ? (
            <p className="truncate text-caption font-semibold text-ink" title={path}>
              {path}
            </p>
          ) : (
            <p className="text-caption font-semibold text-ink-muted">No link issued.</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {path && <CopyLinkButton path={path} variant="dark" size="compact" />}
        <ConfirmButton
          action={rotate}
          title={path ? `Rotate the ${lower}?` : `Create a new ${lower}?`}
          body={
            path
              ? "The current link stops working immediately. Anyone who needs it will need the new one."
              : "A new, unguessable link will be issued."
          }
          confirmLabel={path ? "Rotate link" : "Create link"}
          variant="secondary"
          size="compact"
          className="bg-surface"
        >
          {path ? "Rotate" : "Create link"}
        </ConfirmButton>
        {path && (
          <ConfirmButton
            action={revoke}
            title={`Revoke the ${lower}?`}
            body="It stops working immediately, and no link exists until you create a new one."
            confirmLabel="Revoke link"
            destructive
            variant="danger"
            size="compact"
          >
            Revoke
          </ConfirmButton>
        )}
      </div>
    </div>
  );
}
