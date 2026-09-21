import { ImageOff, Lock, Clock } from "lucide-react";
import { getEventByGalleryToken } from "@/lib/dal/events";
import { listCapturesForGalleryViewer } from "@/lib/dal/captures";
import { isGalleryRevealed } from "@/lib/events/lifecycle";
import { GalleryArchive } from "./gallery-archive";

/**
 * The public gallery viewer (product.md §7.3/§8.2, roadmap Slice 5, criteria 14/15).
 * Possession of the gallery token is the credential for "anyone with the link" visibility
 * (architecture §5) — there is no guest session and no host auth here. Access is decided
 * once, right here, before any capture is ever loaded: not found, not revealed yet, and
 * "only me" visibility all render the same kind of calm denial rather than leaking whether
 * the token is merely unrevealed vs. permanently private in a way that would matter to an
 * attacker, while still telling a legitimate host-shared recipient something useful.
 */
export default async function GalleryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const event = await getEventByGalleryToken(token);

  if (!event) {
    return (
      <HeldArchivePanel
        icon={ImageOff}
        title="We can't find this gallery"
        body="Double-check the link with your host."
      />
    );
  }

  if (event.visibility === "only_me") {
    return (
      <HeldArchivePanel
        icon={Lock}
        title="This gallery is private"
        body="The host has kept this gallery visible to themselves only."
      />
    );
  }

  if (!isGalleryRevealed(event)) {
    return (
      <HeldArchivePanel
        icon={Clock}
        title="Not revealed yet"
        body="The host hasn't opened this gallery to viewers yet. Check back later."
      />
    );
  }

  const captures = await listCapturesForGalleryViewer(event.id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-guest-display text-xl font-semibold text-(--guest-ink)">
          {event.name}
        </h1>
        {event.host_message && (
          <p className="text-sm text-(--guest-ink-muted)">{event.host_message}</p>
        )}
      </div>

      {captures.length === 0 ? (
        <p className="py-16 text-center text-sm text-(--guest-ink-muted)">
          No photos yet.
        </p>
      ) : (
        <GalleryArchive captures={captures} />
      )}
    </div>
  );
}

/**
 * The calm state shared by all three access denials (not found, private, not revealed). Its
 * shape deliberately echoes the archive spread's own tiles (rounded plate, generous aspect
 * ratio) so a denied visitor still reads it as "this is the same gallery," not an error page —
 * but it stays abstract on purpose: no thumbnail, silhouette, or count, since that would leak
 * something about content the viewer isn't authorized to see.
 */
function HeldArchivePanel({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12">
      <div className="flex aspect-4/3 w-full max-w-xs flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--guest-border) bg-(--guest-surface-quiet) text-(--guest-ink-muted)">
        <Icon className="size-6" />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-guest-display text-xl font-semibold text-(--guest-ink)">{title}</h1>
        <p className="max-w-xs text-sm text-(--guest-ink-muted)">{body}</p>
      </div>
    </div>
  );
}
