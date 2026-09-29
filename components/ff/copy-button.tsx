"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

/** Copies an app-relative path as an absolute URL for this origin. */
export function CopyLinkButton({
  path,
  label = "Copy link",
  variant = "dark",
  size = "sm",
  className,
}: {
  path: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(`${window.location.origin}${path}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <Button variant={variant} size={size} onClick={copy} className={className}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}

/** The absolute link text, rendered client-side so it always reflects the real origin. */
export function AbsoluteLink({ path, className }: { path: string; className?: string }) {
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const display = `${origin.replace(/^https?:\/\//, "")}${path}`;
  return (
    <span className={className} title={display} suppressHydrationWarning>
      {display}
    </span>
  );
}
