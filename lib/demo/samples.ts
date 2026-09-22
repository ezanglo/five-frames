/**
 * Bundled sample "photos" for the public pre-purchase demo (product.md §7.1, decision D14).
 * Generated inline as SVG data URIs rather than shipped image files — no network fetch, no
 * public/ asset, nothing that could be mistaken for a real guest's photo. Pure and DOM-free so
 * it's trivially testable and safe to import from a server component.
 */

export type DemoSamplePhoto = {
  id: string;
  label: string;
  dataUrl: string;
};

const PALETTES: [string, string][] = [
  ["#f7d9b8", "#e8a172"],
  ["#cfe8e0", "#7fb8a8"],
  ["#f4c8d6", "#d97ba0"],
  ["#c9d9f2", "#7d9bd6"],
  ["#fbe7a1", "#e3b23c"],
];

function sampleSvgDataUrl(index: number): string {
  const [from, to] = PALETTES[index % PALETTES.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="400" height="400" fill="url(#g)"/>` +
    `<circle cx="200" cy="165" r="72" fill="rgba(255,255,255,0.35)"/>` +
    `<rect x="90" y="258" width="220" height="16" rx="8" fill="rgba(255,255,255,0.4)"/>` +
    `<rect x="130" y="284" width="140" height="12" rx="6" fill="rgba(255,255,255,0.28)"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const DEMO_SAMPLE_PHOTOS: readonly DemoSamplePhoto[] = [
  { id: "sample-1", label: "Sample photo, warm portrait", dataUrl: sampleSvgDataUrl(0) },
  { id: "sample-2", label: "Sample photo, outdoors", dataUrl: sampleSvgDataUrl(1) },
  { id: "sample-3", label: "Sample photo, celebration", dataUrl: sampleSvgDataUrl(2) },
  { id: "sample-4", label: "Sample photo, evening", dataUrl: sampleSvgDataUrl(3) },
  { id: "sample-5", label: "Sample photo, golden hour", dataUrl: sampleSvgDataUrl(4) },
];
