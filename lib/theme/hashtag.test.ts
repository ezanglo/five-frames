import { describe, expect, it } from "vitest";
import { HASHTAG_MAX, normalizeHashtag } from "./hashtag";

describe("normalizeHashtag", () => {
  it("stores without the leading #", () => {
    expect(normalizeHashtag("#DaniTurns40")).toEqual({ ok: true, value: "DaniTurns40" });
    expect(normalizeHashtag("DaniTurns40")).toEqual({ ok: true, value: "DaniTurns40" });
    expect(normalizeHashtag("  #SantosReunion  ")).toEqual({ ok: true, value: "SantosReunion" });
  });

  it("treats empty input as clearing the hashtag", () => {
    expect(normalizeHashtag("")).toEqual({ ok: true, value: null });
    expect(normalizeHashtag("   ")).toEqual({ ok: true, value: null });
    expect(normalizeHashtag("#")).toEqual({ ok: true, value: null });
    expect(normalizeHashtag(null)).toEqual({ ok: true, value: null });
  });

  it("accepts letters (including accented), digits and underscore", () => {
    expect(normalizeHashtag("Team_FiveFrames_2026").ok).toBe(true);
    expect(normalizeHashtag("#AñaYJosé")).toEqual({ ok: true, value: "AñaYJosé" });
    expect(normalizeHashtag("Kasalan2026")).toEqual({ ok: true, value: "Kasalan2026" });
  });

  it("refuses spaces, punctuation and a second #", () => {
    expect(normalizeHashtag("Dani Turns 40")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizeHashtag("dani-turns-40")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizeHashtag("#one#two")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizeHashtag("<script>")).toEqual({ ok: false, reason: "invalid" });
  });

  it("bounds the length at the one server-side constant", () => {
    expect(normalizeHashtag("a".repeat(HASHTAG_MAX)).ok).toBe(true);
    expect(normalizeHashtag("a".repeat(HASHTAG_MAX + 1))).toEqual({ ok: false, reason: "too_long" });
    expect(normalizeHashtag(`#${"é".repeat(HASHTAG_MAX)}`).ok).toBe(true);
  });
});
