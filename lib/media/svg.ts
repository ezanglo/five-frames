/**
 * The one XML escape for hand-built SVG (architecture §7c: every interpolated string goes through
 * it). Covers text content and double- or single-quoted attribute values.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
