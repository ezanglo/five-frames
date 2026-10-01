"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KeepsakePreview, canvasFor } from "@/components/ff/keepsakes/keepsake-preview";
import { DEMO_KEEPSAKE_EVENT } from "@/lib/demo/keepsakes";
import {
  buildFullSetKeepsakeInput,
  buildKeepsakeContext,
  buildSingleKeepsakeInput,
  type KeepsakePhoto,
} from "@/lib/keepsakes/context";
import { GUEST_FIVE, SAMPLE_THEME_PHOTO, photoSrc, type MarketingPhoto } from "@/lib/marketing/photos";
import { styleMeta } from "@/lib/keepsakes/styles";
import { cn } from "@/lib/utils";

/**
 * A registry photo as a keepsake template's photo input. The previews are a few hundred pixels
 * wide, so the 480 file is plenty.
 */
function asKeepsakePhoto(photo: MarketingPhoto): KeepsakePhoto {
  return { src: photoSrc(photo, 480), width: 480, height: Math.round((photo.height * 480) / photo.width) };
}

/**
 * Three keepsakes for the homepage (product.md §10.2): two Single-photo styles beside the
 * Signature Full Set, drawn by the real shared templates — so the site never shows a keepsake the
 * product can't make — with the demo's sample event, the marketing photos as the guest's five
 * and a decor photo as the theme image. Laid out like prints on the Look studio's stage.
 * Decorative images; the caption names what they are.
 */
export function KeepsakeShowcase({ className }: { className?: string }) {
  const inputs = useMemo(() => {
    const context = buildKeepsakeContext(DEMO_KEEPSAKE_EVENT, { src: photoSrc(SAMPLE_THEME_PHOTO) });
    return {
      poster: buildSingleKeepsakeInput(context, "poster", asKeepsakePhoto(GUEST_FIVE[3]), null),
      booth: buildSingleKeepsakeInput(context, "booth", asKeepsakePhoto(GUEST_FIVE[1]), null),
      signature: buildFullSetKeepsakeInput(context, "signature", GUEST_FIVE.map(asKeepsakePhoto)),
    };
  }, []);
  const [nearRef, near] = useNearViewport();

  return (
    <figure className={cn("flex flex-col gap-4", className)}>
      <div
        ref={nearRef}
        className="relative overflow-hidden rounded-3xl bg-surface-stage px-4 pt-10 pb-8 sm:px-8 sm:pt-14 sm:pb-12 lg:rounded-[36px]"
      >
        <div aria-hidden className="relative mx-auto flex max-w-[520px] items-end justify-center">
          <Keepsake rotate={-5} className="z-0 -mr-6 w-[34%] translate-y-2 sm:-mr-8">
            {near ? <KeepsakePreview family="single" input={inputs.poster} /> : <Blank family="single" />}
          </Keepsake>
          <Keepsake rotate={1.5} className="z-10 w-[40%]">
            {near ? <KeepsakePreview family="fullSet" input={inputs.signature} /> : <Blank family="fullSet" />}
          </Keepsake>
          <Keepsake rotate={5} className="z-0 -ml-6 w-[34%] translate-y-4 sm:-ml-8">
            {near ? <KeepsakePreview family="single" input={inputs.booth} /> : <Blank family="single" />}
          </Keepsake>
        </div>
      </div>
      <figcaption className="text-caption font-medium text-ink-muted">
        {styleMeta("poster").label} and {styleMeta("booth").label} (one photo) beside{" "}
        {styleMeta("signature").label} (all five), with a sample event look: “Ana &amp; Marco”,
        rose, #AnaAndMarco.
      </figcaption>
    </figure>
  );
}

/**
 * The keepsakes' photos and fonts load only once the section is close to the screen, so a visitor
 * who never scrolls this far never downloads them. Without IntersectionObserver, load at once.
 */
function useNearViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window)) {
      setValue(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setValue(true);
        observer.disconnect();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, value] as const;
}

/** The same box a preview will fill, so nothing shifts when it mounts. */
function Blank({ family }: { family: "single" | "fullSet" }) {
  const canvas = canvasFor(family);
  return <div className="w-full bg-surface" style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }} />;
}

function Keepsake({
  rotate,
  className,
  children,
}: {
  rotate: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{ transform: `rotate(${rotate}deg)` }}
      className={cn("relative shrink-0 shadow-[var(--shadow-print)]", className)}
    >
      {children}
    </div>
  );
}
