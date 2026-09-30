"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lays out `children` on a fixed canvas (the output's real pixel size) and scales it to the
 * container's width, so a preview is the same composition at every stage size instead of a
 * reflowed approximation.
 */
export function FitCanvas({
  width,
  height,
  children,
  className,
}: {
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setScale(element.clientWidth / width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={ref} className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: `${width} / ${height}` }}>
      <div
        className="absolute top-0 left-0 origin-top-left"
        // Opacity, not visibility, until measured: browsers throttle rendering inside a
        // visibility-hidden iframe and may not repaint it when it becomes visible.
        style={{ width, height, transform: `scale(${scale || 1})`, opacity: scale ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}
