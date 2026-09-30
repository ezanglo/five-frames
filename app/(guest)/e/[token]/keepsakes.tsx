"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ff/button";
import { KeepsakePicker, type PickerPhoto } from "@/components/ff/keepsakes/keepsake-picker";
import { KeepsakePreview } from "@/components/ff/keepsakes/keepsake-preview";
import { buildFullSetKeepsakeInput, type KeepsakeContext } from "@/lib/keepsakes/context";
import { PRESELECTED_FULL_SET_STYLE } from "@/lib/keepsakes/styles";
import type { KeepsakeFamily } from "@/lib/keepsakes/styles";
import type { AccentKey } from "@/lib/theme/accents";

/**
 * What the guest's own view needs to offer keepsakes. `null` whenever keepsakes are off for this
 * event (the host's sharing setting, or the event no longer reachable): then there is no keepsake
 * group, hint, row button or disabled control anywhere (design-direction "Sharing off").
 * Computed by the server page; the routes re-check everything on every request regardless.
 */
export type GuestKeepsakes = {
  token: string;
  eventName: string;
  accent: AccentKey;
  /** Preview context: event name/date/hashtag, accent roles and the signed theme image URL. */
  context: KeepsakeContext;
  /**
   * The session's five capture ids in canonical order, from `getFullSetAvailability` — the same
   * derivation the Full Set route authorizes with. Null means the Full Set is absent: no card, no
   * switch, nothing disabled or teased (product.md §10.2.2).
   */
  fullSet: readonly string[] | null;
};

export type KeepsakeSourcePhoto = {
  id: string;
  message: string | null;
  thumbnailUrl: string | null;
  displayUrl: string | null;
  downloadUrl: string | null;
};

function toPickerPhoto(photo: KeepsakeSourcePhoto): PickerPhoto | null {
  if (!photo.displayUrl || !photo.thumbnailUrl) return null;
  return {
    id: photo.id,
    displayUrl: photo.displayUrl,
    thumbnailUrl: photo.thumbnailUrl,
    message: photo.message,
    downloadUrl: photo.downloadUrl,
  };
}

/** The five, in the server's order, only if every one is in the guest's own view with URLs. */
export function fullSetPhotosOf(
  keepsakes: GuestKeepsakes | null,
  photos: readonly KeepsakeSourcePhoto[],
): PickerPhoto[] | null {
  if (!keepsakes?.fullSet || keepsakes.fullSet.length !== 5) return null;
  const five = keepsakes.fullSet.map((id) => {
    const photo = photos.find((p) => p.id === id);
    return photo ? toPickerPhoto(photo) : null;
  });
  return five.every(Boolean) ? (five as PickerPhoto[]) : null;
}

/** Opens the "Make a keepsake" picker for one of the guest's own photos, or for their five. */
export function useKeepsakePicker(keepsakes: GuestKeepsakes | null, photos: readonly KeepsakeSourcePhoto[]) {
  const [open, setOpen] = useState<{ photo: PickerPhoto; family: KeepsakeFamily } | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const five = fullSetPhotosOf(keepsakes, photos);

  function openFor(photo: KeepsakeSourcePhoto, family: KeepsakeFamily = "single") {
    const pickerPhoto = toPickerPhoto(photo);
    if (keepsakes && pickerPhoto) setOpen({ photo: pickerPhoto, family });
  }

  /** From the "Your five, together" card: opens on Your five ("One photo" uses photo 1). */
  function openFullSet() {
    if (keepsakes && five) setOpen({ photo: five[0], family: "fullSet" });
  }

  const picker =
    keepsakes && open ? (
      <KeepsakePicker
        token={keepsakes.token}
        eventName={keepsakes.eventName}
        accent={keepsakes.accent}
        context={keepsakes.context}
        initialFamily={open.family}
        photo={open.photo}
        fullSetPhotos={five}
        onClose={close}
      />
    ) : null;

  return { openFor, openFullSet, fullSetPhotos: five, picker };
}

/**
 * The calm card on the completion and own-photo screens when the guest's five are all there
 * (design-direction → "Full Set keepsakes · Guest experience"). One on-tint action; "Download my
 * photos" stays the screen's primary. Rendered only while available — never locked or teased.
 */
export function FullSetCard({
  keepsakes,
  photos,
  onOpen,
}: {
  keepsakes: GuestKeepsakes;
  photos: readonly PickerPhoto[];
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-brand-tint p-4">
      <div className="w-14 shrink-0 rotate-[-4deg] shadow-[0_6px_14px_rgb(21_20_26/0.18)] lg:w-16" aria-hidden>
        <KeepsakePreview
          family="fullSet"
          input={buildFullSetKeepsakeInput(
            keepsakes.context,
            PRESELECTED_FULL_SET_STYLE,
            photos.map((p) => ({ src: p.thumbnailUrl })),
          )}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-col">
          <p className="text-label font-bold text-ink">Your five, together</p>
          <p className="text-caption font-medium text-ink-muted">All five photos in one keepsake.</p>
        </div>
        <Button variant="onTint" size="sm" className="h-11 self-start lg:self-auto" onClick={onOpen}>
          See them together
        </Button>
      </div>
    </div>
  );
}
