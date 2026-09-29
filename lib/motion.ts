/**
 * Shared motion preferences for the marketing site's decorative motion (docs/design-direction.md
 * → "Marketing motion"). Browser-only helpers: call them from effects, never during render, so
 * the server and the first client render always agree (static composition first).
 */

/** Continuous, pointer/scroll-linked motion: desktop composition and no reduced-motion request. */
export const RICH_MOTION_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

/** A real mouse or trackpad — the only input that drives hover parallax. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Frame-rate-independent easing toward a target: the fraction of the remaining distance to cover
 * after `dt` ms with time constant `tau` ms. Larger tau = heavier, slower settling.
 */
export function damp(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / tau);
}
