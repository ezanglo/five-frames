/**
 * A guest always retains a private, downloadable view of their own captures, independent of
 * gallery visibility and even after capture has closed (product.md §8.3, §13).
 */
export function OwnCaptures({
  captures,
}: {
  captures: { id: string; thumbnailUrl: string; downloadUrl: string }[];
}) {
  if (captures.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Your captures</p>
      <div className="grid grid-cols-3 gap-3">
        {captures.map((c) => (
          <a
            key={c.id}
            href={c.downloadUrl}
            download
            className="block aspect-square overflow-hidden rounded-lg border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.thumbnailUrl}
              alt="Your capture"
              className="h-full w-full object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
