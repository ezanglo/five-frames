"use client";

import { useState } from "react";
import { getShareCard } from "./actions";
import { browserShareCapability, shareOrDownload } from "@/lib/share/web-share";

/**
 * Drives the guest sharing flow for one capture at a time: fetch the branded share card from
 * the server action, then hand it to the Web Share API or the download fallback
 * (lib/share/web-share.ts). A failure here never touches the underlying capture — it only
 * ever reads already-committed, already-derived bytes.
 */
export function useShareCapture(token: string, eventName: string) {
  const [pendingCaptureId, setPendingCaptureId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function share(captureId: string) {
    setPendingCaptureId(captureId);
    setError(null);
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
      await shareOrDownload(blob, "five-frames-share.png", eventName, browserShareCapability());
    } catch {
      setError("Something went wrong sharing this photo. Your photo is safe — try again.");
    } finally {
      setPendingCaptureId(null);
    }
  }

  return { share, pendingCaptureId, error };
}
