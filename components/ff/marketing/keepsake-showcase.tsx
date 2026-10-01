"use client";

import { useMemo, type ReactNode } from "react";
import { KeepsakePreview } from "@/components/ff/keepsakes/keepsake-preview";
import { demoFullSetInput, demoKeepsakeContext, demoSingleInput } from "@/lib/demo/keepsakes";
import { styleMeta } from "@/lib/keepsakes/styles";
import { cn } from "@/lib/utils";

/**
 * Three keepsakes for the homepage (product.md §10.2): two Single-photo styles beside the
 * Signature Full Set, drawn by the real shared templates with the demo's fixed sample look and
 * bundled sample images — the same thing a visitor sees on `/demo`, so the site never shows a
 * keepsake the product can't make. Laid out like prints on the Look studio's stage. Decorative
 * images; the caption names what they are.
 */
export function KeepsakeShowcase({ className }: { className?: string }) {
  const context = useMemo(() => demoKeepsakeContext(), []);

  return (
    <figure className={cn("flex flex-col gap-4", className)}>
      <div className="relative overflow-hidden rounded-3xl bg-surface-stage px-4 pt-10 pb-8 sm:px-8 sm:pt-14 sm:pb-12 lg:rounded-[36px]">
        <div aria-hidden className="relative mx-auto flex max-w-[520px] items-end justify-center">
          <Keepsake rotate={-5} className="z-0 -mr-6 w-[34%] translate-y-2 sm:-mr-8">
            <KeepsakePreview family="single" input={demoSingleInput(context, "poster", null)} />
          </Keepsake>
          <Keepsake rotate={1.5} className="z-10 w-[40%]">
            <KeepsakePreview family="fullSet" input={demoFullSetInput(context, "signature")} />
          </Keepsake>
          <Keepsake rotate={5} className="z-0 -ml-6 w-[34%] translate-y-4 sm:-ml-8">
            <KeepsakePreview family="single" input={demoSingleInput(context, "booth", null)} />
          </Keepsake>
        </div>
      </div>
      <figcaption className="text-caption font-medium text-ink-muted">
        {styleMeta("poster").label} and {styleMeta("booth").label} (one photo) beside{" "}
        {styleMeta("signature").label} (all five), on sample photos with a sample look:
        “Ana &amp; Marco”, rose, #AnaAndMarco.
      </figcaption>
    </figure>
  );
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
