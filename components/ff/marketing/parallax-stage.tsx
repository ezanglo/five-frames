"use client";

import { useRef, type ReactNode } from "react";
import { usePrintParallax } from "@/hooks/use-print-parallax";

/**
 * The hero prints' only client code: a stage element whose `--px`/`--py`/`--sp` custom
 * properties `usePrintParallax` drives. Children stay server-rendered.
 */
export function ParallaxStage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  usePrintParallax(ref);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
