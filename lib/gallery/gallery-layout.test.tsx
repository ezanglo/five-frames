import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GalleryArchive } from "@/app/(gallery)/g/[token]/gallery-archive";
import { GalleryLayoutList } from "@/components/ff/gallery-layout";
import type { GalleryCaptureView } from "@/lib/dal/captures";
import { GALLERY_LAYOUTS } from "./layouts";

/**
 * The revealed gallery renders one list in the host's layout (decision D22). These check what
 * the layout may and may not change: the arrangement differs; the photos, their order, their
 * labels and the way they open do not.
 */

const captures: GalleryCaptureView[] = [
  { id: "c1", message: "First dance", favorited: false, imageUrl: "https://x.test/1", width: 1200, height: 1600 },
  { id: "c2", message: null, favorited: true, imageUrl: "https://x.test/2", width: 1600, height: 1067 },
  { id: "c3", message: null, favorited: false, imageUrl: "https://x.test/3", width: 1600, height: 1600 },
  { id: "c4", message: "Cake!", favorited: false, imageUrl: "https://x.test/4", width: null, height: null },
];

function order(html: string, attr: RegExp) {
  return [...html.matchAll(attr)].map((m) => m[1]);
}

describe("revealed gallery layouts", () => {
  it("renders the host's chosen layout", () => {
    for (const layout of GALLERY_LAYOUTS) {
      const html = renderToStaticMarkup(<GalleryArchive captures={captures} layout={layout} />);
      expect(html).toContain(`data-layout="${layout}"`);
      expect(html).toContain(`ff-gallery-${layout}`);
      for (const other of GALLERY_LAYOUTS.filter((l) => l !== layout)) {
        expect(html).not.toContain(`data-layout="${other}"`);
      }
    }
  });

  it("shows the same photos, in the same order, with the same labels, in every layout", () => {
    const renders = GALLERY_LAYOUTS.map((layout) =>
      renderToStaticMarkup(<GalleryArchive captures={captures} layout={layout} />),
    );
    const images = renders.map((html) => order(html, /<img src="([^"]+)"/g));
    const labels = renders.map((html) => order(html, /aria-label="(Photo [^"]+)"/g));
    expect(images[0]).toEqual(captures.map((c) => c.imageUrl));
    expect(labels[0]).toEqual([
      "Photo 1 of 4: First dance",
      "Photo 2 of 4",
      "Photo 3 of 4",
      "Photo 4 of 4: Cake!",
    ]);
    for (const i of [1, 2]) {
      expect(images[i]).toEqual(images[0]);
      expect(labels[i]).toEqual(labels[0]);
    }
    // Every tile is a real button that opens the shared viewer, in every layout.
    for (const html of renders) {
      expect(order(html, /<button type="button"[^>]*aria-label="(Photo [^"]+)"/g)).toHaveLength(4);
    }
  });

  it("gives Masonry and Rows each photo's own shape, and unknown sizes a square", () => {
    for (const layout of ["masonry", "rows"] as const) {
      const html = renderToStaticMarkup(<GalleryArchive captures={captures} layout={layout} />);
      expect(order(html, /--a:([\d.]+)/g)).toEqual(["0.75", "1.4995", "1", "1"]);
    }
  });

  it("precomputes a masonry position per tier and a container height that fits them", () => {
    const html = renderToStaticMarkup(
      <GalleryLayoutList layout="masonry" items={captures} renderTile={() => null} />,
    );
    for (const tier of [0, 1, 2]) {
      expect(order(html, new RegExp(`--m${tier}-x:(\\d+)`, "g"))).toHaveLength(4);
      expect(html).toMatch(new RegExp(`--m${tier}-h:max\\(calc\\(`));
    }
    // Two columns on a phone: the portrait goes left, the landscape right, and so on.
    expect(order(html, /--m0-x:(\d+)/g)).toEqual(["0", "1", "1", "0"]);
  });

  it("emits no positions for Rows or Grid, and no inline sizes for Grid tiles", () => {
    const rows = renderToStaticMarkup(<GalleryLayoutList layout="rows" items={captures} renderTile={() => null} />);
    const grid = renderToStaticMarkup(<GalleryLayoutList layout="grid" items={captures} renderTile={() => null} />);
    expect(rows).not.toContain("--m0-");
    expect(grid).not.toContain("--m0-");
  });

  it("never offers playback in any layout", () => {
    for (const layout of GALLERY_LAYOUTS) {
      const html = renderToStaticMarkup(<GalleryArchive captures={captures} layout={layout} />);
      expect(html).not.toMatch(/slideshow|autoplay|play\b|story/i);
    }
  });
});
