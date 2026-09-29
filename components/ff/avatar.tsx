import { cn } from "@/lib/utils";

/** Avatar fills picked by name hash (DS03). Pastel fills keep ink initials ≥4.5:1. */
const AVATAR_FILLS = ["#F2B8C6", "#BFD8F5", "#FFD89A", "#C9E7C9", "#D9CCF7"] as const;

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : (parts[0][1] ?? "");
  return (first + last).toUpperCase();
}

function fillFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_FILLS[hash % AVATAR_FILLS.length];
}

export function Avatar({
  name,
  size = 44,
  className,
}: {
  name: string;
  size?: 30 | 36 | 40 | 44;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: fillFor(name), width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-ink",
        size >= 40 ? "text-label" : "text-[11px]",
        className,
      )}
    >
      {initialsFor(name)}
    </span>
  );
}
