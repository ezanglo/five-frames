"use client";

import { useId, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { KeepsakePreview, useImageSize } from "@/components/ff/keepsakes/keepsake-preview";
import { SegmentedTabs, tabPanelProps } from "@/components/ff/look/segmented-tabs";
import { StatusPill } from "@/components/ff/pill";
import { demoFullSetInput, demoKeepsakeContext, demoSingleInput } from "@/lib/demo/keepsakes";
import {
  FULL_SET_STYLES,
  PRESELECTED_FULL_SET_STYLE,
  PRESELECTED_SINGLE_STYLE,
  SINGLE_STYLES,
  styleMeta,
  type FullSetStyleId,
  type KeepsakeFamily,
  type SingleStyleId,
} from "@/lib/keepsakes/styles";
import { cn } from "@/lib/utils";

/**
 * Keepsakes in the demo (product.md §7.1, D14): the two families, never one list of ten, drawn by
 * the real shared templates in the browser with a fixed sample look. "One photo" uses the
 * visitor's latest kept demo shot when there is one; "All five" always uses bundled samples.
 * Preview only: no share, save, route call or server render.
 */
export function DemoKeepsakes({ latest }: { latest: { src: string; message: string } | null }) {
  const idBase = useId();
  const [family, setFamily] = useState<KeepsakeFamily>("single");
  const [singleStyle, setSingleStyle] = useState<SingleStyleId>(PRESELECTED_SINGLE_STYLE);
  const [fullSetStyle, setFullSetStyle] = useState<FullSetStyleId>(PRESELECTED_FULL_SET_STYLE);
  const context = useMemo(() => demoKeepsakeContext(), []);
  const size = useImageSize(latest?.src ?? null);
  const own = latest && size ? { photo: { src: latest.src, ...size }, message: latest.message } : null;

  const styles = family === "single" ? SINGLE_STYLES : FULL_SET_STYLES;
  const selected = family === "single" ? singleStyle : fullSetStyle;
  const label = styleMeta(selected).label;

  return (
    <section
      aria-labelledby={`${idBase}-title`}
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={`${idBase}-title`} className="font-heading text-heading font-semibold text-ink">
            Keepsakes
          </h2>
          <p className="text-caption font-medium text-ink-muted">
            At a real event, guests can turn their own photos into a keepsake to share or save,
            dressed in the event’s look. Here it’s a fixed sample look.
          </p>
        </div>
        <StatusPill tone="tint" size="sm">
          Demo sample
        </StatusPill>
      </div>

      <SegmentedTabs
        idBase={idBase}
        label="Keepsake type"
        size="sm"
        value={family}
        onChange={setFamily}
        tabs={[
          { id: "single", label: "One photo" },
          { id: "fullSet", label: "All five" },
        ]}
      />

      <div
        {...tabPanelProps(idBase, family)}
        className="grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-start"
      >
        <figure className="mx-auto flex w-[72%] max-w-[260px] flex-col gap-2 sm:w-full">
          <div
            role="img"
            aria-label={`${label} keepsake, demo sample`}
            className="shadow-[0_18px_36px_rgb(21_20_26/0.14)]"
          >
            {family === "single" ? (
              <KeepsakePreview family="single" input={demoSingleInput(context, singleStyle, own)} />
            ) : (
              <KeepsakePreview family="fullSet" input={demoFullSetInput(context, fullSetStyle)} />
            )}
          </div>
          <figcaption className="text-center text-micro font-semibold text-ink-muted">
            Demo sample ·{" "}
            {family === "fullSet" ? "sample photos" : own ? "your latest shot" : "a sample photo"}
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-col gap-3">
          <ul aria-label={family === "single" ? "One-photo styles" : "All-five styles"} className="flex flex-col gap-2">
            {styles.map((style) => {
              const isSelected = style.id === selected;
              return (
                <li key={style.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      family === "single"
                        ? setSingleStyle(style.id as SingleStyleId)
                        : setFullSetStyle(style.id as FullSetStyleId)
                    }
                    className={cn(
                      "ff-focus relative flex min-h-11 w-full flex-col gap-0.5 rounded-lg border px-3.5 py-2.5 pr-10 text-left",
                      isSelected ? "border-brand bg-brand-tint" : "border-line bg-surface hover:border-ink-muted/40",
                    )}
                  >
                    <span className="text-label font-bold text-ink">{style.label}</span>
                    <span className="text-caption font-medium text-ink-muted">{style.line}</span>
                    {isSelected && (
                      <Check className="absolute top-3 right-3.5 size-4 text-brand-ink" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-caption font-medium text-ink-muted">
            {family === "single"
              ? "A guest picks one of these styles when they share or save one of their photos. The style is the only choice; their photo is never changed."
              : "A guest who keeps five photos can also make one keepsake of all five, in the order they kept them. Shown here on sample photos."}
          </p>
        </div>
      </div>
    </section>
  );
}
