"use client";

import { useState } from "react";
import type { GalleryLayout } from "@/lib/db/types";
import { GALLERY_LAYOUT_LABEL } from "@/lib/events/labels";
import { GALLERY_LAYOUTS, GALLERY_LAYOUT_DESCRIPTION } from "@/lib/gallery/layouts";
import { galleryPhoto, photoSrc, photoSrcSet, type MarketingPhoto } from "@/lib/marketing/photos";
import { GalleryLayoutList } from "@/components/ff/gallery-layout";
import { SegmentedTabs, tabPanelProps } from "@/components/ff/look/segmented-tabs";
import { cn } from "@/lib/utils";

const ID_BASE = "gallery-layout-sample";
const SAMPLE_COUNT = 12;

/** The same evening's photos in every tab: the guest's five, then other guests' moments. */
const SAMPLE = Array.from({ length: SAMPLE_COUNT }, (_, i) => {
  const photo = galleryPhoto(i);
  return { id: `${photo.file}-${i}`, width: photo.width, height: photo.height, photo };
});

/**
 * Homepage gallery-layout sample (decision D22): one sample gallery and a Masonry · Rows · Grid
 * switch. It renders through the product's own `GalleryLayoutList`, the component the revealed
 * gallery uses, so each tab shows exactly the arrangement a host would get, at the width it is
 * drawn (a phone-width card gets the phone arrangement). The photos are the marketing stock
 * (lib/marketing/photos.ts), cropped in Grid only, as in the product. Nothing here plays,
 * advances or animates on its own.
 */
export function GalleryLayoutsShowcase({ className }: { className?: string }) {
  const [layout, setLayout] = useState<GalleryLayout>("masonry");

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <SegmentedTabs
        idBase={ID_BASE}
        label="Gallery layout"
        tabs={GALLERY_LAYOUTS.map((id) => ({ id, label: GALLERY_LAYOUT_LABEL[id] }))}
        value={layout}
        onChange={setLayout}
        className="w-full max-w-[360px]"
      />
      <p aria-live="polite" className="min-h-10 text-center text-label font-medium text-ink-on-dark sm:min-h-0">
        {GALLERY_LAYOUT_DESCRIPTION[layout]}
      </p>
      <div
        {...tabPanelProps(ID_BASE, layout)}
        className="w-full overflow-hidden rounded-3xl bg-surface text-ink shadow-[0_24px_60px_rgb(0_0_0/0.35)]"
      >
        <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
          <p className="font-heading text-[18px] font-semibold">Relive the moments</p>
          <p className="tabular text-caption font-medium text-ink-muted">{SAMPLE_COUNT} photos</p>
        </div>
        <div className="relative h-[400px] overflow-hidden px-3 sm:h-[480px] sm:px-4">
          <GalleryLayoutList
            layout={layout}
            items={SAMPLE}
            label={`Sample gallery, ${GALLERY_LAYOUT_LABEL[layout]} layout`}
            renderTile={({ photo }) => <SampleTile photo={photo} />}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface to-transparent"
          />
        </div>
      </div>
    </div>
  );
}

function SampleTile({ photo }: { photo: MarketingPhoto }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from public/
    <img
      src={photoSrc(photo, 480)}
      srcSet={photoSrcSet(photo)}
      sizes="(min-width: 1024px) 220px, 45vw"
      alt={photo.alt}
      loading="lazy"
      decoding="async"
      style={{ objectPosition: photo.focus }}
      className="block size-full rounded-[10px] bg-surface-subtle object-cover"
    />
  );
}
