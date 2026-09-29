"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Plays a one-time entrance for its `.ff-rise-reveal` / `.ff-print-drop-reveal` descendants when
 * the block scrolls into view (docs/design-direction.md → "Marketing motion"). Progressive
 * enhancement only: without JavaScript, with reduced motion, or when the block is already on
 * screen at load, nothing is hidden and nothing moves. Only opacity and transform animate, so it
 * can't shift layout.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion() || !("IntersectionObserver" in window)) return;
    // Already visible (or scrolled past) at load: leave it as it is rather than blink it out.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    // Set on the DOM directly — it's presentation state React never needs to render.
    node.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      delete node.dataset.reveal;
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
