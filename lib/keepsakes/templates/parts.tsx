/* eslint-disable @next/next/no-img-element -- keepsake templates render in Satori and in a scaled DOM preview; next/image applies to neither. */
import type { CSSProperties, ReactNode } from "react";
import { objectPosition, CENTER_FOCUS, type CropFocus } from "../crop";

/** Shared colors: the design system's tokens, mirrored by hex because Satori can't read CSS variables. */
export const INK = "#15141A";
export const MUTED = "#6B6A75";
export const ON_TINT = "#5B5670";
export const WHITE = "#FFFFFF";
export const NIGHT = "#141414";
export const DEEP_NIGHT = "#15121F";
export const SLOT_FILL = "#E9E7EF";

/** `#RRGGBB` + alpha byte, for gradient stops built from a registry color (never host input). */
export function withAlpha(hex: string, alpha: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${hex}${byte}`;
}

/**
 * A photo or theme image filling exactly `width × height`. On export the server has already
 * cropped the bytes to this box with `coverCrop` and the same focus, so `object-fit` is a no-op;
 * in the preview the browser applies the same crop from `object-position`.
 */
export function Img({
  src,
  width,
  height,
  focus = CENTER_FOCUS,
  style,
}: {
  src: string;
  width: number;
  height: number;
  focus?: CropFocus;
  style?: CSSProperties;
}) {
  return (
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      draggable={false}
      style={{
        display: "flex",
        width,
        height,
        objectFit: "cover",
        objectPosition: objectPosition(focus),
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/**
 * A drop shadow, declared once and serialized per target (like `clamp`): the DOM preview gets the
 * CSS `box-shadow`; the export gets the same shadow as a pre-blurred bitmap drawn behind the box.
 * Rasterizing large Gaussian blurs is by far the most expensive thing resvg does for a keepsake
 * (measured in Slice 16: five blurred prints cost more than every photo combined), while an image
 * costs almost nothing. CSS blurs with σ = blur / 2; the bitmap is made the same way.
 */
export type ShadowLayer = { y: number; blur: number; rgb: readonly [number, number, number]; alpha: number };
export type ShadowSpec = { width: number; height: number; radius: number; layers: readonly ShadowLayer[] };

/** How far the shadow bitmap extends past the box on every side (3σ past the offset). */
export function shadowPad(spec: ShadowSpec): number {
  return Math.max(...spec.layers.map((l) => Math.abs(l.y) + Math.ceil(l.blur * 1.5)));
}

export function shadowCss(spec: ShadowSpec): string {
  return spec.layers.map((l) => `0 ${l.y}px ${l.blur}px rgba(${l.rgb.join(",")},${l.alpha})`).join(",");
}

/** A box with a drop shadow. `sprite` is the export's pre-blurred bitmap for `spec`. */
export function ShadowedBox({
  spec,
  background,
  target,
  sprite,
  style,
  children,
}: {
  spec: ShadowSpec;
  background: string;
  target: "export" | "preview";
  sprite?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const pad = shadowPad(spec);
  const bitmap = target === "export" && sprite;
  return (
    <div style={{ position: "absolute", width: spec.width, height: spec.height, display: "flex", ...style }}>
      {bitmap && (
        <img
          src={sprite}
          alt=""
          width={spec.width + 2 * pad}
          height={spec.height + 2 * pad}
          style={{ position: "absolute", left: -pad, top: -pad, width: spec.width + 2 * pad, height: spec.height + 2 * pad }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: spec.width,
          height: spec.height,
          display: "flex",
          background,
          borderRadius: spec.radius,
          ...(bitmap ? {} : { boxShadow: shadowCss(spec) }),
        }}
      >
        {children}
      </div>
    </div>
  );
}
