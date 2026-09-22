import { Plus, RefreshCw, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ROMAN = ["I", "II", "III", "IV", "V"] as const;

/**
 * Fixed grid-line placement for each frame, on a 4-column board with 5rem auto-rows
 * (`.frame-board` in globals.css). Deliberately irregular — a wide hero, a tall portrait
 * column, a wide strip, and two small squares — so II–V read as one contact-sheet-like
 * collection rather than four equal cards. Numeral badges (not position) carry the I→V order.
 */
const FRAME_POSITION = [
  "col-start-1 col-end-5 row-start-1 row-end-4", // I — hero, full width
  "col-start-1 col-end-3 row-start-4 row-end-8", // II — tall portrait, left column
  "col-start-3 col-end-5 row-start-4 row-end-6", // III — wide strip, upper right
  "col-start-3 col-end-4 row-start-6 row-end-8", // IV — small square, lower right
  "col-start-4 col-end-5 row-start-6 row-end-8", // V — small square, lower right
] as const;

export type FrameState =
  /** Not yet reachable — visible as part of the five, but not an active target. */
  | { kind: "future" }
  /** The one frame the guest can act on right now. */
  | { kind: "active" }
  /** A reservation persisted across a reload with no local file to preview yet. */
  | { kind: "resuming" }
  /** A file is selected and the reserve/upload/commit attempt is in flight (or failed). */
  | { kind: "composing"; previewUrl: string; busy: boolean; error: boolean }
  /** Permanently committed — this frame is done. */
  | { kind: "filled"; captureId: string; thumbnailUrl: string | null; downloadUrl: string | null };

/**
 * The five frames as one irregular photo board (docs/design-direction.md). Position is fixed
 * per index regardless of fill state — only which frame carries the active affordance moves —
 * so the board never resizes or reflows as a guest fills it.
 */
export function FrameGrid({
  frames,
  onActivate,
  onShare,
  sharingCaptureId,
}: {
  frames: [FrameState, FrameState, FrameState, FrameState, FrameState];
  /** Called when the guest taps the active or resuming frame to open the picker. */
  onActivate?: () => void;
  /** Present only when the host has sharing enabled for this event (product.md §10). */
  onShare?: (captureId: string) => void;
  /** The capture id currently generating/sharing its card, so its button can show progress. */
  sharingCaptureId?: string | null;
}) {
  return (
    <div className="frame-board gap-3">
      {frames.map((frame, index) => (
        <PhotoFrame
          key={index}
          index={index}
          state={frame}
          onActivate={onActivate}
          onShare={onShare}
          sharingCaptureId={sharingCaptureId}
        />
      ))}
    </div>
  );
}

function PhotoFrame({
  index,
  state,
  onActivate,
  onShare,
  sharingCaptureId,
}: {
  index: number;
  state: FrameState;
  onActivate?: () => void;
  onShare?: (captureId: string) => void;
  sharingCaptureId?: string | null;
}) {
  const numeral = ROMAN[index];
  const shape = cn("relative overflow-hidden rounded-[1.5rem]", FRAME_POSITION[index]);

  if (state.kind === "filled") {
    const content = (
      <>
        {state.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.thumbnailUrl}
            alt={`Your capture, frame ${numeral}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-(--guest-surface) text-sm text-(--guest-ink-muted)">
            Captured
          </div>
        )}
        <FrameNumeral numeral={numeral} tone="onPhoto" />
      </>
    );
    const sharing = sharingCaptureId === state.captureId;
    const shareButton = onShare && (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onShare(state.captureId);
        }}
        disabled={sharing}
        aria-label="Share this photo"
        className="absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-full bg-(--guest-ink)/45 text-(--guest-accent-foreground) backdrop-blur-sm disabled:opacity-70"
      >
        {sharing ? (
          <RefreshCw className="size-4 animate-spin" />
        ) : (
          <Share2 className="size-4" />
        )}
      </button>
    );

    return (
      <div className={cn(shape, "shadow-[0_6px_20px_-8px_oklch(0.27_0.025_50_/_0.45)]")}>
        {state.downloadUrl ? (
          <a href={state.downloadUrl} download className="absolute inset-0 block">
            {content}
          </a>
        ) : (
          content
        )}
        {shareButton}
      </div>
    );
  }

  if (state.kind === "composing") {
    // object-contain, not object-cover — the guest must see the whole photo before confirming,
    // whatever its orientation; the frame's fixed shape letterboxes rather than crops it.
    return (
      <div
        className={cn(
          shape,
          "bg-(--guest-surface) ring-2",
          state.error ? "ring-(--guest-accent)/70" : "ring-(--guest-accent)",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.previewUrl}
          alt="Selected photo preview"
          className="h-full w-full object-contain"
        />
        {state.busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-(--guest-ink)/25">
            <RefreshCw className="size-5 animate-spin text-(--guest-accent-foreground)" />
          </div>
        )}
        <FrameNumeral numeral={numeral} tone="onPhoto" />
      </div>
    );
  }

  if (state.kind === "resuming") {
    return (
      <button
        type="button"
        onClick={onActivate}
        className={cn(
          shape,
          "flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-(--guest-accent) bg-(--guest-surface) text-(--guest-accent)",
        )}
      >
        <RefreshCw className="size-5" />
        <FrameNumeral numeral={numeral} tone="active" />
      </button>
    );
  }

  if (state.kind === "active") {
    return (
      <button
        type="button"
        onClick={onActivate}
        className={cn(
          shape,
          "flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-(--guest-accent) bg-(--guest-canvas-raised) text-(--guest-accent) transition-transform active:scale-[0.96]",
        )}
      >
        <Plus className="size-6" strokeWidth={2.5} />
        <FrameNumeral numeral={numeral} tone="active" />
      </button>
    );
  }

  // future — a light, skeletal outline (an empty frame, not a filled card waiting its turn).
  return (
    <div
      aria-hidden
      className={cn(
        shape,
        "border border-dashed border-(--guest-border) bg-transparent",
      )}
    >
      <FrameNumeral numeral={numeral} tone="quiet" />
    </div>
  );
}

function FrameNumeral({
  numeral,
  tone,
}: {
  numeral: string;
  tone: "onPhoto" | "active" | "quiet";
}) {
  return (
    <span
      className={cn(
        "font-guest-display absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide",
        tone === "onPhoto" &&
          "bg-(--guest-ink)/45 text-(--guest-accent-foreground) backdrop-blur-sm",
        tone === "active" && "bg-(--guest-accent) text-(--guest-accent-foreground)",
        tone === "quiet" && "text-(--guest-ink-muted)",
      )}
    >
      {numeral}
    </span>
  );
}
