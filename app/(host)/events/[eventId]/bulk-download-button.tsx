"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { getBulkDownloadUrlsAction } from "@/app/(host)/events/actions";
import { Button } from "@/components/ff/button";
import { outcomeNote, progressNote, saveFilesOneByOne } from "@/lib/media/save-files";

/**
 * "Download all" (decision D11: client-driven sequential signed URLs, no server-side zip for
 * MVP). The handoff labels this "Download ZIP"; FiveFrames saves each original as its own file,
 * so the label says what actually happens. One browser download per original, each fetched in
 * full before the next starts (lib/media/save-files.ts).
 */
export function BulkDownloadButton({
  eventId,
  disabled,
  className,
}: {
  eventId: string;
  disabled: boolean;
  className?: string;
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

      const outcome = await saveFilesOneByOne(downloads, {
        onProgress: (current, total) => setNote(progressNote(current, total)),
      });
      setNote(outcomeNote(outcome, { one: "original", many: "originals" }));
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="dark"
        size="sm"
        onClick={handleClick}
        disabled={disabled || pending}
        className={className}
        title="Saves every original photo as its own file"
      >
        <Download aria-hidden />
        {pending ? "Downloading…" : "Download all"}
      </Button>
      {note && (
        <p className="text-micro font-medium text-ink-muted" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
