"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { FullSetKeepsakeInput, SingleKeepsakeInput } from "@/lib/keepsakes/context";
import { FULL_SET_CANVAS, SINGLE_CANVAS } from "@/lib/keepsakes/geometry";
import { FullSetKeepsake } from "@/lib/keepsakes/templates/full-set";
import { SingleKeepsake } from "@/lib/keepsakes/templates/single";
import { cn } from "@/lib/utils";
import { keepsakeFontVariables } from "./fonts";

/**
 * A keepsake template rendered by React DOM for a preview (architecture §7b "Previews"): the same
 * component the server exports, with the `preview` target, laid out at the family's real canvas
 * size and scaled to fit its box. Never a server render, never downloadable from here.
 */

type Input = { family: "single"; input: SingleKeepsakeInput } | { family: "fullSet"; input: FullSetKeepsakeInput };

export function canvasFor(family: "single" | "fullSet") {
  return family === "single" ? SINGLE_CANVAS : FULL_SET_CANVAS;
}

function Template(props: Input) {
  if (props.family === "single") return <SingleKeepsake input={props.input} target="preview" />;
  return <FullSetKeepsake input={props.input} target="preview" />;
}

/**
 * Scales the canvas to fit `fit="width"` (the box's width sets the size, height follows the
 * canvas ratio) or `fit="contain"` (as large as fits inside the box's width and height).
 */
export function KeepsakePreview({
  fit = "width",
  className,
  canvasClassName,
  ...props
}: Input & { fit?: "width" | "contain"; className?: string; canvasClassName?: string }) {
  const canvas = canvasFor(props.family);
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const byWidth = element.clientWidth / canvas.width;
      const byHeight = element.clientHeight / canvas.height;
      setScale(fit === "width" ? byWidth : Math.min(byWidth, byHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [canvas.width, canvas.height, fit]);

  const frame: ReactNode = (
    <div
      className={cn("relative overflow-hidden", canvasClassName)}
      style={{ width: canvas.width * scale, height: canvas.height * scale }}
    >
      <div
        aria-hidden
        className={cn("absolute top-0 left-0 origin-top-left", keepsakeFontVariables)}
        style={{ width: canvas.width, height: canvas.height, transform: `scale(${scale || 1})`, opacity: scale ? 1 : 0 }}
      >
        <Template {...props} />
      </div>
    </div>
  );

  return fit === "width" ? (
    <div ref={ref} className={cn("w-full", className)} style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}>
      {frame}
    </div>
  ) : (
    <div ref={ref} className={cn("flex min-h-0 items-center justify-center", className)}>
      {frame}
    </div>
  );
}

/** The natural (upright) size of an image URL, measured in the browser; null until it loads. */
export function useImageSize(src: string | null): { width: number; height: number } | null {
  const [size, setSize] = useState<{ src: string; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (!src) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setSize({ src, width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return size && size.src === src ? { width: size.width, height: size.height } : null;
}
