"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { getBulkDownloadUrlsAction } from "@/app/(host)/events/actions";
import { Button } from "@/components/ui/button";

/**
 * "Download all originals" (decision D11: client-driven sequential signed URLs, no
 * server-side zip for MVP). Triggers one browser download per original, spaced out so
 * browsers don't treat a rapid burst of programmatic downloads as a popup storm and
 * silently block the later ones.
 */
export function BulkDownloadButton({
  eventId,
  disabled,
}: {
  eventId: string;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function handleClick() {
    setNote(null);
    startTransition(async () => {
      const downloads = await getBulkDownloadUrlsAction(eventId);
      if (downloads.length === 0) {
        setNote("No photos to download yet.");
        return;
      }

      for (const item of downloads) {
        const anchor = document.createElement("a");
        anchor.href = item.url;
        anchor.download = item.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled || pending}
        className="w-fit gap-1.5 border-(--host-border) text-(--host-ink)"
      >
        <Download className="size-3.5" />
        {pending ? "Preparing downloads…" : "Download all originals"}
      </Button>
      {note && <p className="text-xs text-(--host-ink-muted)">{note}</p>}
    </div>
  );
}
