"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowUpDown, Download, Eye, EyeOff, Star, Trash2, User } from "lucide-react";
import { moderateCaptureAction } from "@/app/(host)/events/actions";
import type { HostCaptureView, ModerationAction } from "@/lib/dal/captures";
import { formatEventTime, firstName } from "@/lib/events/format";
import { Button, ButtonAnchor } from "@/components/ff/button";
import { ConfirmButton } from "@/components/ff/confirm-button";
import { SelectInput } from "@/components/ff/field";
import { Chip, HiddenBadge } from "@/components/ff/pill";
import { cn } from "@/lib/utils";
import { BulkDownloadButton } from "../../bulk-download-button";

const PAGE_SIZE = 24;

/**
 * Host photo management (D7 / mobile 07). Toolbar: guest filter, newest/oldest, hidden-only,
 * Download all. Grid: 4 columns on desktop, 2 on mobile. Each card carries guest attribution,
 * time and message, Hide/Unhide, favorite, download original and delete. Hidden photos stay
 * visible to the host with a 55% ink overlay and a dashed border. Delete always asks first and
 * is terminal — and never returns the guest's frame (product.md §9.3, invariant 4).
 */
export function PhotoManager({
  eventId,
  timezone,
  captures,
}: {
  eventId: string;
  timezone: string;
  captures: HostCaptureView[];
}) {
  const [guest, setGuest] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const guests = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of captures) byId.set(c.guestSessionId, c.guestDisplayName);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [captures]);
  const hiddenCount = captures.filter((c) => c.hidden).length;

  const filtered = useMemo(() => {
    const list = captures.filter(
      (c) => (guest === "all" || c.guestSessionId === guest) && (!hiddenOnly || c.hidden),
    );
    return list.sort((a, b) =>
      sort === "newest"
        ? Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
        : Date.parse(a.capturedAt) - Date.parse(b.capturedAt),
    );
  }, [captures, guest, sort, hiddenOnly]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-heading font-semibold text-ink lg:text-[32px] lg:leading-tight">
              All photos
            </h2>
            <p className="tabular text-caption font-medium text-ink-muted">
              {captures.length} photo{captures.length === 1 ? "" : "s"} · {guests.length} guest
              {guests.length === 1 ? "" : "s"} · {hiddenCount} hidden from the gallery
            </p>
          </div>
          <div className="lg:hidden">
            <BulkDownloadButton eventId={eventId} disabled={captures.length === 0} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:flex lg:items-start">
          <label className="lg:w-[180px]">
            <span className="sr-only">Filter by guest</span>
            <SelectInput
              value={guest}
              onChange={(e) => setGuest(e.target.value)}
              icon={<User />}
              className="h-11 rounded-sm bg-surface text-label lg:h-11"
            >
              <option value="all">All guests</option>
              {guests.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </SelectInput>
          </label>
          <label className="lg:w-[150px]">
            <span className="sr-only">Sort photos</span>
            <SelectInput
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
              icon={<ArrowUpDown />}
              className="h-11 rounded-sm bg-surface text-label"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </SelectInput>
          </label>
          <Chip
            active={hiddenOnly}
            onClick={() => setHiddenOnly((v) => !v)}
            className="col-span-2 h-11 justify-center lg:col-span-1"
          >
            <EyeOff className="size-4" aria-hidden />
            Hidden only
          </Chip>
          <div className="hidden lg:block">
            <BulkDownloadButton eventId={eventId} disabled={captures.length === 0} className="h-11" />
          </div>
        </div>
      </div>

      {captures.length === 0 ? (
        <p className="rounded-xl bg-surface-subtle px-5 py-10 text-center text-label font-medium text-ink-muted lg:bg-surface">
          No photos yet — share the QR to get started.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl bg-surface-subtle px-5 py-10 text-center text-label font-medium text-ink-muted lg:bg-surface">
          No photos match these filters.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
          {visible.map((capture) => (
            <HostPhotoCard key={capture.id} eventId={eventId} timezone={timezone} capture={capture} />
          ))}
        </ul>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3">
          <p className="tabular text-caption font-medium text-ink-muted">
            Showing {visible.length} of {filtered.length}
          </p>
          {visible.length < filtered.length && (
            <Button
              variant="secondary"
              size="sm"
              className="bg-surface"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            >
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Host photo card · default / hidden (DS05). */
function HostPhotoCard({
  eventId,
  timezone,
  capture,
}: {
  eventId: string;
  timezone: string;
  capture: HostCaptureView;
}) {
  const [pending, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);
  const time = formatEventTime(capture.capturedAt, timezone);
  const who = firstName(capture.guestDisplayName) ?? capture.guestDisplayName;

  function act(action: ModerationAction) {
    startTransition(async () => {
      await moderateCaptureAction(eventId, capture.id, action);
    });
  }

  if (deleted) return null;

  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-lg bg-surface lg:rounded-xl",
        capture.hidden ? "ff-dashed" : "border border-line",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-subtle lg:aspect-[7/5]">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url */}
        <img
          src={capture.thumbnailUrl}
          alt={[`Photo by ${capture.guestDisplayName}`, time, capture.message].filter(Boolean).join(", ")}
          className="absolute inset-0 size-full object-cover"
        />
        {capture.hidden && (
          <span className="absolute inset-0 flex items-start justify-center bg-ink/55 pt-4">
            <HiddenBadge />
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => act(capture.favorited ? "unfavorite" : "favorite")}
          aria-label={capture.favorited ? "Remove favorite" : "Mark as favorite"}
          aria-pressed={capture.favorited}
          className={cn(
            "ff-focus ff-hit absolute top-2 right-2 flex size-8 items-center justify-center rounded-full transition-colors disabled:opacity-60",
            capture.favorited ? "bg-brand text-ink-inverse" : "ff-frosted text-ink-inverse",
          )}
        >
          <Star className="size-4" fill={capture.favorited ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 lg:p-3.5">
        <p className="flex items-baseline justify-between gap-2">
          <span className="truncate text-label font-bold text-ink">{capture.guestDisplayName}</span>
          {time && <span className="tabular shrink-0 text-micro font-medium text-ink-muted">{time}</span>}
        </p>
        <p
          className={cn(
            "line-clamp-2 text-caption font-medium",
            capture.message ? "text-ink-on-tint" : "text-ink-muted italic",
          )}
        >
          {capture.message ?? "No message"}
        </p>
        <div className="mt-auto flex items-center gap-1.5 pt-1.5">
          <Button
            variant={capture.hidden ? "primary" : "secondary"}
            size="compact"
            disabled={pending}
            onClick={() => act(capture.hidden ? "unhide" : "hide")}
            className={cn("flex-1", capture.hidden && "shadow-none")}
          >
            <Eye aria-hidden />
            {capture.hidden ? "Unhide" : "Hide"}
          </Button>
          <ButtonAnchor
            href={capture.downloadUrl}
            variant="secondary"
            size="iconCompact"
            aria-label={`Download ${who}’s original photo`}
          >
            <Download aria-hidden />
          </ButtonAnchor>
          <ConfirmButton
            action={async () => {
              await moderateCaptureAction(eventId, capture.id, "delete");
              setDeleted(true);
            }}
            title={`Delete ${who}’s photo?`}
            body="This can’t be undone. It won’t give the guest their shot back."
            confirmLabel="Delete photo"
            cancelLabel="Keep it"
            destructive
            variant="danger"
            size="iconCompact"
            ariaLabel={`Delete ${who}’s photo`}
            disabled={pending}
          >
            <Trash2 aria-hidden />
          </ConfirmButton>
        </div>
      </div>
    </li>
  );
}
