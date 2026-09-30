import { describe, expect, it } from "vitest";
import { keepsakeFilename } from "./filename";

describe("keepsake filename", () => {
  it("is fiveframes-{event}-{style}.jpg, ASCII, from the event name only", () => {
    expect(keepsakeFilename("Dani’s 40th", "print")).toBe("fiveframes-danis-40th-print.jpg");
    expect(keepsakeFilename("Kasal ni Ána & Marco!", "booth")).toBe("fiveframes-kasal-ni-ana-marco-booth.jpg");
    expect(keepsakeFilename("🎉🎉", "album")).toBe("fiveframes-event-album.jpg");
    expect(keepsakeFilename("x".repeat(100), "journal")).toMatch(/^fiveframes-x{40}-journal\.jpg$/);
  });
});
