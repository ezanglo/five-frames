import Link from "next/link";
import { cn } from "@/lib/utils";
import { HostTag } from "./pill";

/** Wordmark (DS04): 17px ExtraBold, text only. */
export function Wordmark({
  host,
  href,
  tone = "dark",
  className,
}: {
  host?: boolean;
  href?: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  const content = (
    <>
      <span className="text-[17px] leading-none font-extrabold tracking-[-0.01em]">FiveFrames</span>
      {host && <HostTag />}
    </>
  );
  const classes = cn(
    "inline-flex items-center gap-2",
    tone === "light" ? "text-ink-inverse" : "text-ink",
    className,
  );
  return href ? (
    <Link href={href} className={cn(classes, "ff-focus rounded-md")}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
