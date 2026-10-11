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

const sevenPm = { key: "1760698800000", label: "7 PM" };
const eightPm = { key: "1760702400000", label: "8 PM" };

const captures: GalleryCaptureView[] = [
  { id: "c1", message: "First dance", favorited: false, imageUrl: "https://x.test/1", width: 1200, height: 1600, section: sevenPm },
  { id: "c2", message: null, favorited: true, imageUrl: "https://x.test/2", width: 1600, height: 1067, section: sevenPm },
  { id: "c3", message: null, favorited: false, imageUrl: "https://x.test/3", width: 1600, height: 1600, section: eightPm },
  { id: "c4", message: "Cake!", favorited: false, imageUrl: "https://x.test/4", width: null, height: null, section: eightPm },
];

/** Every presentation the host can choose: three layouts, time sections on and off. */
const PRESENTATIONS = GALLERY_LAYOUTS.flatMap((layout) =>
  [true, false].map((timeSections) => ({ layout, timeSections })),
);

function order(html: string, attr: RegExp) {
  return [...html.matchAll(attr)].map((m) => m[1]);
}

describe("revealed gallery layouts", () => {
  it("renders the host's chosen layout", () => {
    for (const { layout, timeSections } of PRESENTATIONS) {
      const html = renderToStaticMarkup(
        <GalleryArchive captures={captures} layout={layout} timeSections={timeSections} />,
      );
      expect(html).toContain(`data-layout="${layout}"`);
      expect(html).toContain(`ff-gallery-${layout}`);
      for (const other of GALLERY_LAYOUTS.filter((l) => l !== layout)) {
        expect(html).not.toContain(`data-layout="${other}"`);
      }
    }
  });

  it("shows the same photos, in the same order, with the same labels, in every layout, with or without time sections", () => {
    const renders = PRESENTATIONS.map(({ layout, timeSections }) =>
      renderToStaticMarkup(<GalleryArchive captures={captures} layout={layout} timeSections={timeSections} />),
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
    for (const i of renders.keys()) {
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
      const html = renderToStaticMarkup(<GalleryArchive captures={captures} layout={layout} timeSections={false} />);
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
    for (const { layout, timeSections } of PRESENTATIONS) {
      const html = renderToStaticMarkup(
        <GalleryArchive captures={captures} layout={layout} timeSections={timeSections} />,
      );
      expect(html).not.toMatch(/slideshow|autoplay|play\b|story/i);
    }
  });
});

describe("time sections in the revealed gallery", () => {
  it("labels each hour once, in order, with nothing but the label", () => {
    for (const layout of GALLERY_LAYOUTS) {
      const html = renderToStaticMarkup(<GalleryArchive captures={captures} layout={layout} timeSections />);
      expect(order(html, /<h2[^>]*>([^<]*)<\/h2>/g)).toEqual(["7 PM", "8 PM"]);
      // One list per section, each in the host's layout, holding that hour's photos.
      expect(order(html, /<ul aria-label="([^"]+)"/g)).toEqual(["Photos from 7 PM", "Photos from 8 PM"]);
      expect(order(html, /data-layout="(\w+)"/g)).toEqual([layout, layout]);
      const [first, second] = html.split("<h2").slice(1);
      expect(order(first, /<img src="([^"]+)"/g)).toEqual(["https://x.test/1", "https://x.test/2"]);
      expect(order(second, /<img src="([^"]+)"/g)).toEqual(["https://x.test/3", "https://x.test/4"]);
    }
  });

  it("renders the single flat list exactly as before when switched off", () => {
    const html = renderToStaticMarkup(<GalleryArchive captures={captures} layout="masonry" timeSections={false} />);
    expect(html).not.toContain("<h2");
    expect(order(html, /<ul aria-label="([^"]+)"/g)).toEqual(["Event photos"]);
  });

  it("places masonry per section, so each hour starts its own columns", () => {
    const html = renderToStaticMarkup(<GalleryArchive captures={captures} layout="masonry" timeSections />);
    // Phone tier, two columns: each section's first photo goes to the left column at the top.
    expect(order(html, /--m0-x:(\d+)/g)).toEqual(["0", "1", "0", "1"]);
    expect(order(html, /--m0-y:([\d.]+)/g)).toEqual(["0", "0", "0", "0"]);
  });

  it("never shows a photo's own time, a count or a guest name", () => {
    const html = renderToStaticMarkup(<GalleryArchive captures={captures} layout="grid" timeSections />);
    expect(html).not.toMatch(/\d{1,2}:\d{2}/);
    expect(html).not.toMatch(/2 photos|\(2\)/);
  });
});
