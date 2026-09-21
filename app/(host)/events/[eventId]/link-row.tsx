"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * One row for the capture link or the gallery link (product.md §8.1/§11.2, roadmap
 * Slice 5). Both links are long and unguessable and the host can rotate or revoke either
 * one if it leaks — rotation immediately invalidates the old URL since every lookup is by
 * exact token match (architecture §5), so there is nothing else to invalidate. Revoke
 * clears the link entirely; rotate on an already-revoked link re-issues a fresh one, so
 * "rotate" doubles as "create" when there is no current link.
 */
export function LinkRow({
  label,
  icon,
  helpText,
  path,
  rotateAction,
  revokeAction,
}: {
  label: string;
  icon: React.ReactNode;
  helpText: string;
  path: string | null;
  rotateAction: () => Promise<void>;
  revokeAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!path) return;
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function rotate() {
    if (path && !window.confirm(`Rotate the ${label.toLowerCase()}? The current link will stop working immediately.`)) {
      return;
    }
    startTransition(rotateAction);
  }

  function revoke() {
    if (!window.confirm(`Revoke the ${label.toLowerCase()}? It will stop working immediately and no link will exist until you create a new one.`)) {
      return;
    }
    startTransition(revokeAction);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-(--host-surface-quiet) p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-(--host-ink-muted)" aria-hidden>
            {icon}
          </span>
          <Label>{label}</Label>
        </div>
        {path ? (
          <span className="text-xs text-(--host-ink-muted)">{copied ? "Copied" : ""}</span>
        ) : null}
      </div>
      <p className="text-xs text-(--host-ink-muted)">{helpText}</p>

      {path ? (
        <>
          <code className="truncate rounded bg-(--host-canvas) px-2 py-1.5 text-xs text-(--host-ink)">
            {path}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={copy}>
              Copy link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={rotate}
            >
              Rotate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={revoke}
              className="text-(--host-danger) hover:bg-(--host-danger)/10 hover:text-(--host-danger)"
            >
              Revoke
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-(--host-ink-muted)">No link issued.</span>
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={rotate}>
            Create link
          </Button>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-(--host-ink)">{children}</span>;
}
