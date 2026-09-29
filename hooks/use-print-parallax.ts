"use client";

import { useEffect, type RefObject } from "react";
import { FINE_POINTER_QUERY, RICH_MOTION_QUERY, clamp, damp } from "@/lib/motion";

/** Time constants (ms). Pointer is heavy so prints feel weighted; scroll stays close to 1:1. */
const POINTER_TAU = 240;
const SCROLL_TAU = 70;
const EPSILON = 0.0005;

type State = { px: number; py: number; sp: number };

/**
 * Drives the hero prints' shallow parallax by writing three custom properties on the stage —
 * `--px`/`--py` (pointer, −1…1) and `--sp` (hero scroll progress, 0…1). The prints turn them into
 * transforms in CSS (`.ff-hero-print`, globals.css), so each frame touches one element's style.
 *
 * Only runs on a ≥1024px viewport without a reduced-motion request; pointer tracking only with a
 * real mouse. The rAF loop runs only while values are still settling — idle, it stops — and
 * input is ignored while the hero is off screen. Media-query changes re-evaluate everything, and
 * unmount removes every listener and resets the stage to its static composition.
 */
export function usePrintParallax(stageRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const stage = stageRef.current;
    const area = stage?.closest("section");
    if (!stage || !area) return;

    const rich = window.matchMedia(RICH_MOTION_QUERY);
    const fine = window.matchMedia(FINE_POINTER_QUERY);
    let detach: (() => void) | null = null;

    const evaluate = () => {
      detach?.();
      detach = rich.matches ? attach(stage, area, fine.matches) : null;
    };
    evaluate();
    rich.addEventListener("change", evaluate);
    fine.addEventListener("change", evaluate);
    return () => {
      rich.removeEventListener("change", evaluate);
      fine.removeEventListener("change", evaluate);
      detach?.();
    };
  }, [stageRef]);
}

function attach(stage: HTMLElement, area: HTMLElement, trackPointer: boolean): () => void {
  const target: State = { px: 0, py: 0, sp: 0 };
  const current: State = { px: 0, py: 0, sp: 0 };
  let rect = area.getBoundingClientRect();
  let visible = true;
  let frame = 0;
  let last = 0;

  const write = () => {
    stage.style.setProperty("--px", current.px.toFixed(4));
    stage.style.setProperty("--py", current.py.toFixed(4));
    stage.style.setProperty("--sp", current.sp.toFixed(4));
  };

  const tick = (now: number) => {
    const dt = last ? Math.min(now - last, 64) : 16;
    last = now;
    const kp = damp(dt, POINTER_TAU);
    const ks = damp(dt, SCROLL_TAU);
    current.px += (target.px - current.px) * kp;
    current.py += (target.py - current.py) * kp;
    current.sp += (target.sp - current.sp) * ks;

    const settled =
      Math.abs(target.px - current.px) < EPSILON &&
      Math.abs(target.py - current.py) < EPSILON &&
      Math.abs(target.sp - current.sp) < EPSILON;
    if (settled) Object.assign(current, target);
    write();
    if (settled) {
      frame = 0;
      last = 0;
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  const readScroll = () => {
    rect = area.getBoundingClientRect();
    target.sp = clamp(-rect.top / rect.height, 0, 1);
  };

  const onScroll = () => {
    if (!visible) return;
    readScroll();
    wake();
  };

  const onEnter = () => {
    rect = area.getBoundingClientRect();
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !visible) return;
    target.px = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    target.py = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    wake();
  };

  const onLeave = () => {
    target.px = 0;
    target.py = 0;
    wake();
  };

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) onScroll();
  });
  observer.observe(area);

  // Start from wherever the page already is (e.g. reloaded mid-scroll) without animating there.
  readScroll();
  current.sp = target.sp;
  write();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  if (trackPointer) {
    area.addEventListener("pointerenter", onEnter);
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerleave", onLeave);
  }

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    area.removeEventListener("pointerenter", onEnter);
    area.removeEventListener("pointermove", onMove);
    area.removeEventListener("pointerleave", onLeave);
    for (const name of ["--px", "--py", "--sp"]) stage.style.removeProperty(name);
  };
}
