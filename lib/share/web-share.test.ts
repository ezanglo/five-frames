import { describe, expect, it, vi } from "vitest";
import { shareOrDownload, type ShareCapability } from "./web-share";

function blob(): Blob {
  return new Blob(["fake-png-bytes"], { type: "image/png" });
}

describe("shareOrDownload", () => {
  it("uses the Web Share API when the platform reports it can share the file", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const downloadBlob = vi.fn();
    const capability: ShareCapability = {
      canShareFiles: () => true,
      share,
      downloadBlob,
    };

    const result = await shareOrDownload(blob(), "card.png", "My Event", capability);

    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("falls back to download when Web Share is unavailable at the application layer", async () => {
    const share = vi.fn();
    const downloadBlob = vi.fn();
    const capability: ShareCapability = {
      canShareFiles: () => false,
      share,
      downloadBlob,
    };

    const result = await shareOrDownload(blob(), "card.png", "My Event", capability);

    expect(result).toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "card.png");
  });

  it("falls back to download when the native share call itself fails", async () => {
    const share = vi.fn().mockRejectedValue(new Error("share sheet crashed"));
    const downloadBlob = vi.fn();
    const capability: ShareCapability = { canShareFiles: () => true, share, downloadBlob };

    const result = await shareOrDownload(blob(), "card.png", "My Event", capability);

    expect(result).toBe("downloaded");
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });

  it("treats a user-cancelled native share sheet as cancelled, not a failure to fall back from", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    const downloadBlob = vi.fn();
    const capability: ShareCapability = { canShareFiles: () => true, share, downloadBlob };

    const result = await shareOrDownload(blob(), "card.png", "My Event", capability);

    expect(result).toBe("cancelled");
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
