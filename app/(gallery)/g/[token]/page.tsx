import { getEventByGalleryToken } from "@/lib/dal/events";
import { listCapturesForGalleryViewer } from "@/lib/dal/captures";
import { isGalleryRevealed } from "@/lib/events/lifecycle";

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
      <CalmState
        title="We can't find this gallery"
        body="Double-check the link with your host."
      />
    );
  }

  if (event.visibility === "only_me") {
    return (
      <CalmState
        title="This gallery is private"
        body="The host has kept this gallery visible to themselves only."
      />
    );
  }

  if (!isGalleryRevealed(event)) {
    return (
      <CalmState
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {captures.map((capture) => (
            <div
              key={capture.id}
              className="aspect-square overflow-hidden rounded-xl bg-(--guest-surface)"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url, not a static asset */}
              <img
                src={capture.imageUrl}
                alt=""
                className="size-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalmState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <h1 className="font-guest-display text-xl font-semibold text-(--guest-ink)">{title}</h1>
      <p className="max-w-xs text-sm text-(--guest-ink-muted)">{body}</p>
    </div>
  );
}
