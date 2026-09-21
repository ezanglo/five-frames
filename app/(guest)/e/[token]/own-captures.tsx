import { FrameGrid, type FrameState } from "./frame-grid";

/**
 * A guest always retains a private, downloadable view of their own captures, independent of
 * gallery visibility and even after capture has closed (product.md §8.3, §13). Read-only variant
 * of the same frame system used during capture — no active/composing states, just filled and
 * future frames, so the visual language stays one thing across the whole guest journey.
 */
export function OwnCaptures({
  captures,
}: {
  captures: { id: string; thumbnailUrl: string; downloadUrl: string }[];
}) {
  if (captures.length === 0) return null;

  const frames = Array.from({ length: 5 }, (_, index): FrameState => {
    const capture = captures[index];
    return capture
      ? { kind: "filled", thumbnailUrl: capture.thumbnailUrl, downloadUrl: capture.downloadUrl }
      : { kind: "future" };
  }) as [FrameState, FrameState, FrameState, FrameState, FrameState];

  return (
    <div className="flex flex-col gap-3">
      <p className="font-guest-display text-sm text-(--guest-ink-muted)">Your captures</p>
      <FrameGrid frames={frames} />
    </div>
  );
}
