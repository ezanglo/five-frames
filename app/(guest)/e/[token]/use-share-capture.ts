"use client";

import { useState } from "react";
import { getShareCard } from "./actions";
import { browserShareCapability, shareOrDownload } from "@/lib/share/web-share";

/**
 * Drives the guest sharing flow for one capture at a time: fetch the branded share card from
 * the server action, then hand it to the Web Share API or the download fallback
 * (lib/share/web-share.ts). A failure here never touches the underlying capture — it only
 * ever reads already-committed, already-derived bytes.
 *
 * `shareOrDownload`'s result tells us which of the two actually happened (product.md §10: "use
 * the Web Share API when available, fall back to download otherwise"). A native share hands off
 * to the OS, which gives its own confirmation, so nothing further is said. A silent download
 * fallback previously left the guest with no acknowledgement anything happened at all — this
 * surfaces one quiet, transient line so the fallback is communicated rather than assumed.
 */
export function useShareCapture(token: string, eventName: string) {
  const [pendingCaptureId, setPendingCaptureId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function share(captureId: string) {
    setPendingCaptureId(captureId);
    setError(null);
    setStatus(null);
    try {
      const response = await getShareCard(token, captureId);
      if (response.kind !== "ok") {
        setError(
          response.kind === "sharing_disabled"
            ? "Your host has turned off sharing for this event."
            : "That photo isn't available to share right now.",
        );
        return;
      }
      const blob = await (await fetch(response.dataUrl)).blob();
      const result = await shareOrDownload(
        blob,
        "five-frames-share.png",
        eventName,
        browserShareCapability(),
      );
      if (result === "downloaded") {
        setStatus("Saved your share card — find it in your downloads.");
      }
    } catch {
      setError("Something went wrong sharing this photo. Your photo is safe — try again.");
    } finally {
      setPendingCaptureId(null);
    }
  }

  return { share, pendingCaptureId, error, status };
}
