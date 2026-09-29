import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandLockup } from "./brand-mark";
import { HostTag, OperatorTag } from "./pill";

/**
 * Wordmark (DS04, replaced by identity v1.0 — docs/design-direction.md → "Brand identity"): the
 * FiveFrames lockup, symbol + outlined wordmark, 20px tall. `tone="light"` is for dark and photo
 * surfaces. Keeps the old text wordmark's props, so every header picks it up unchanged.
 */
export function Wordmark({
  host,
  operator,
  href,
  tone = "dark",
  className,
}: {
  host?: boolean;
  operator?: boolean;
  href?: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  const content = (
    <>
      <BrandLockup tone={tone === "light" ? "onDark" : "onLight"} className="h-5" />
      {host && <HostTag />}
      {operator && <OperatorTag />}
    </>
  );
  const classes = cn("inline-flex items-center gap-2.5", className);
  return href ? (
    <Link href={href} className={cn(classes, "ff-focus rounded-md")}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
