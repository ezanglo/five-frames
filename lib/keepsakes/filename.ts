import type { KeepsakeStyleId } from "./styles";

/**
 * `fiveframes-{event}-{style}.jpg` (architecture §7b). Built from the event name and the style
 * only — never a guest name, token or id. The slug is ASCII so every share sheet and file system
 * accepts it.
 */
export function keepsakeFilename(eventName: string, style: KeepsakeStyleId): string {
  const slug = eventName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `fiveframes-${slug || "event"}-${style}.jpg`;
}
