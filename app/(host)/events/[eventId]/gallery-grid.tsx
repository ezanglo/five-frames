"use client";

import { useState, useTransition } from "react";
import { Download, Eye, EyeOff, Star, Trash2 } from "lucide-react";
import { moderateCaptureAction } from "@/app/(host)/events/actions";
import type { HostCaptureView, ModerationAction } from "@/lib/dal/captures";

/**
 * Gallery grid with hide/unhide/delete/favorite (product.md §11.2). Deleting removes a
 * capture from this list on the next refresh but never returns the guest's frame — the
 * DAL only ever touches hidden_at/deleted_at/favorited_at, never slot_index or status.
 *
 * Contact-sheet composition anchored on Photo Mechanic (dense, gutter-only grid, no per-tile
 * card border, status iconography lives on the photo itself) with Picflow's warm mat/rounded
 * photo-object treatment (docs/design-direction.md, "Host experience"). Favorite and hide are
 * one-tap reversible icon toggles, always visible (no hover-only affordances — this is a touch
 * surface); delete is deliberately a separate, harder-to-reach control so it never carries the
 * same visual weight as the reversible actions.
 */
export function GalleryGrid({
  eventId,
  captures,
}: {
  eventId: string;
  captures: HostCaptureView[];
}) {
  if (captures.length === 0) {
    return (
      <p className="text-sm text-(--host-ink-muted)">
        No captures yet. They&rsquo;ll appear here as guests confirm photos.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
      {captures.map((capture) => (
        <GalleryTile key={capture.id} eventId={eventId} capture={capture} />
      ))}
    </div>
  );
}

function GalleryTile({
  eventId,
  capture,
}: {
  eventId: string;
  capture: HostCaptureView;
}) {
  const [pending, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function act(action: ModerationAction) {
    startTransition(async () => {
      await moderateCaptureAction(eventId, capture.id, action);
      if (action === "delete") setDeleted(true);
    });
  }

  function requestDelete() {
    if (!window.confirm("Delete this capture? This can't be undone.")) {
      return;
    }
    act("delete");
  }

  if (deleted) return null;

  return (
    <div className="group/tile relative">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-(--host-surface) shadow-[0_1px_3px_rgb(0_0_0/0.08)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed url, not worth next/image's remote-pattern config for a host-only dashboard */}
        <img
          src={capture.thumbnailUrl}
          alt={`Capture by ${capture.guestDisplayName}`}
          className={
            "size-full object-cover transition-opacity " +
            (capture.hidden ? "opacity-40" : "opacity-100")
          }
        />

        {/* Persistent, always-visible status iconography on the photo itself (Photo Mechanic
            pattern) rather than a button row beneath it. Touch targets are >=44px. */}
        <button
          type="button"
          disabled={pending}
          onClick={() => act(capture.favorited ? "unfavorite" : "favorite")}
          aria-label={capture.favorited ? "Unfavorite" : "Favorite"}
          aria-pressed={capture.favorited}
          className={
            "absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors disabled:opacity-50 " +
            (capture.favorited
              ? "bg-(--host-accent) text-(--host-accent-foreground)"
              : "bg-black/35 text-white hover:bg-black/50")
          }
        >
          <Star
            className="size-4"
            fill={capture.favorited ? "currentColor" : "none"}
          />
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => act(capture.hidden ? "unhide" : "hide")}
          aria-label={capture.hidden ? "Unhide" : "Hide"}
          aria-pressed={capture.hidden}
          className="absolute top-1.5 left-1.5 flex size-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/50 disabled:opacity-50"
        >
          {capture.hidden ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>

        {!confirmingDelete && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5">
            {capture.hidden && (
              <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                Hidden
              </span>
            )}
            <a
              href={capture.downloadUrl}
              download
              aria-label="Download original"
              className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
            >
              <Download className="size-4" />
            </a>
          </div>
        )}

        {/* Delete is deliberately separate from the persistent icons above — a distinct
            expand-to-confirm control so a destructive action never sits at the same visual
            weight as the reversible favorite/hide toggles. */}
        {confirmingDelete ? (
          <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={requestDelete}
              className="flex h-9 flex-1 items-center justify-center rounded-full bg-(--host-danger) text-xs font-medium text-white disabled:opacity-50"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="flex h-9 items-center justify-center rounded-full bg-black/40 px-3 text-xs font-medium text-white backdrop-blur-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete capture"
            className="absolute right-1.5 bottom-1.5 flex size-9 items-center justify-center rounded-full bg-black/20 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <p className="mt-1.5 truncate text-xs text-(--host-ink-muted)">
        {capture.guestDisplayName}
      </p>
    </div>
  );
}
