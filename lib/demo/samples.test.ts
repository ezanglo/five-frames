import { describe, expect, it } from "vitest";
import { DEMO_SAMPLE_PHOTOS } from "./samples";

describe("demo sample photos", () => {
  it("provides exactly five bundled samples, matching the fixed five-frame mechanic", () => {
    expect(DEMO_SAMPLE_PHOTOS).toHaveLength(5);
  });

  it("every sample is an inline data URI, never a network-fetched or remote image", () => {
    for (const sample of DEMO_SAMPLE_PHOTOS) {
      expect(sample.dataUrl.startsWith("data:image/svg+xml,")).toBe(true);
      expect(sample.dataUrl).not.toMatch(/^https?:/);
    }
  });

  it("has distinct ids, labels, and rendered content across all five samples", () => {
    const ids = new Set(DEMO_SAMPLE_PHOTOS.map((s) => s.id));
    const labels = new Set(DEMO_SAMPLE_PHOTOS.map((s) => s.label));
    const dataUrls = new Set(DEMO_SAMPLE_PHOTOS.map((s) => s.dataUrl));
    expect(ids.size).toBe(5);
    expect(labels.size).toBe(5);
    expect(dataUrls.size).toBe(5);
  });
});
