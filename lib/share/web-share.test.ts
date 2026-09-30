import { describe, expect, it, vi } from "vitest";
import { canShareImageFiles, shareFile, type ShareCapability } from "./web-share";

function file() {
  return new File([new Uint8Array([1, 2, 3])], "fiveframes-party-print.jpg", { type: "image/jpeg" });
}

describe("keepsake share decision", () => {
  it("shares a prepared file when the browser can share files", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const capability: ShareCapability = { canShareFiles: () => true, share };
    expect(await shareFile(file(), "Party", capability)).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].name).toBe("fiveframes-party-print.jpg");
  });

  it("treats a cancelled share sheet as cancelled, not an error", async () => {
    const capability: ShareCapability = {
      canShareFiles: () => true,
      share: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")),
    };
    expect(await shareFile(file(), "Party", capability)).toBe("cancelled");
  });

  it("reports failure (never a silent download) when sharing breaks or isn't supported", async () => {
    const broken: ShareCapability = {
      canShareFiles: () => true,
      share: vi.fn().mockRejectedValue(new DOMException("nope", "NotAllowedError")),
    };
    expect(await shareFile(file(), "Party", broken)).toBe("failed");

    const share = vi.fn();
    const unsupported: ShareCapability = { canShareFiles: () => false, share };
    expect(await shareFile(file(), "Party", unsupported)).toBe("failed");
    expect(share).not.toHaveBeenCalled();
  });

  it("probes file sharing rather than trusting navigator.share alone", () => {
    expect(canShareImageFiles({ canShareFiles: () => false, share: vi.fn() })).toBe(false);
    expect(canShareImageFiles({ canShareFiles: () => true, share: vi.fn() })).toBe(true);
    expect(
      canShareImageFiles({
        canShareFiles: () => {
          throw new TypeError("unsupported");
        },
        share: vi.fn(),
      }),
    ).toBe(false);
  });
});
