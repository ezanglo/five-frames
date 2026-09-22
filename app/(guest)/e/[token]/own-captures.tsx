import { FrameGrid, type FrameState } from "./frame-grid";
import { useShareCapture } from "./use-share-capture";

/**
 * A guest always retains a private, downloadable view of their own captures, independent of
 * gallery visibility and even after capture has closed (product.md §8.3, §13). Read-only variant
 * of the same frame system used during capture — no active/composing states, just filled and
 * future frames, so the visual language stays one thing across the whole guest journey.
 *
 * Sharing is available here too (product.md §10: the sharing flow works "even before the
 * gallery is revealed," which includes the post-capture-close window this component renders
 * in) — gated on the same host `sharing_enabled` setting as the in-progress capture view.
 */
export function OwnCaptures({
  token,
  eventName,
  sharingEnabled,
  captures,
}: {
  token: string;
  eventName: string;
  sharingEnabled: boolean;
  captures: { id: string; thumbnailUrl: string; downloadUrl: string }[];
}) {
  const { share, pendingCaptureId, error } = useShareCapture(token, eventName);

  if (captures.length === 0) return null;

  const frames = Array.from({ length: 5 }, (_, index): FrameState => {
    const capture = captures[index];
    return capture
      ? {
          kind: "filled",
          captureId: capture.id,
          thumbnailUrl: capture.thumbnailUrl,
          downloadUrl: capture.downloadUrl,
        }
      : { kind: "future" };
  }) as [FrameState, FrameState, FrameState, FrameState, FrameState];

  return (
    <div className="flex flex-col gap-3">
      <p className="font-guest-display text-sm text-(--guest-ink-muted)">Your captures</p>
      <FrameGrid
        frames={frames}
        onShare={sharingEnabled ? share : undefined}
        sharingCaptureId={pendingCaptureId}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
