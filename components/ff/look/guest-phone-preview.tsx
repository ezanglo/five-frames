"use client";

import { useCallback, useEffect, useRef } from "react";
import { LOOK_PREVIEW_MESSAGE, type LookPreviewState } from "@/lib/theme/preview";
import { cn } from "@/lib/utils";
import { FitCanvas } from "./fit-canvas";

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

/**
 * The guest join screen inside a phone (architecture §7c): the real guest components, rendered
 * by the host-only preview page at a true 390 px viewport and scaled into the stage. The Look
 * state is posted to it on every change, same origin only. It is a picture — not focusable,
 * not interactive, and never a link a guest could use.
 */
export function GuestPhonePreview({
  eventId,
  state,
  className,
}: {
  eventId: string;
  state: LookPreviewState;
  className?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef(state);

  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: LOOK_PREVIEW_MESSAGE, state: stateRef.current },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    stateRef.current = state;
    send();
  }, [state, send]);

  useEffect(() => {
    function onReady(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source === frameRef.current?.contentWindow && event.data?.type === "ff-look-preview-ready") send();
    }
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [send]);

  return (
    <div
      role="img"
      aria-label="Preview of your guest join screen"
      className={cn(
        "overflow-hidden rounded-[36px] border-[7px] border-ink bg-surface-dark shadow-[0_24px_48px_rgb(21_20_26/0.18)]",
        className,
      )}
    >
      <FitCanvas width={PHONE_WIDTH} height={PHONE_HEIGHT}>
        <iframe
          ref={frameRef}
          src={`/events/${eventId}/preview/guest`}
          title="Guest screen preview"
          tabIndex={-1}
          aria-hidden
          onLoad={send}
          className="pointer-events-none block border-0"
          style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT }}
        />
      </FitCanvas>
    </div>
  );
}
