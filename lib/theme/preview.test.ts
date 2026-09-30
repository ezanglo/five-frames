import { describe, expect, it } from "vitest";
import { LOOK_PREVIEW_MESSAGE, parseLookPreviewMessage } from "./preview";

const message = (state: Record<string, unknown>) => ({ type: LOOK_PREVIEW_MESSAGE, state });

describe("parseLookPreviewMessage", () => {
  it("accepts a well-formed preview state", () => {
    expect(
      parseLookPreviewMessage(
        message({
          name: "Dani’s 40th",
          dateLabel: "Sat, 18 Oct 2026",
          message: "Thanks for coming!",
          accent: "marigold",
          hashtag: "#DaniTurns40",
          imageUrl: "https://example.supabase.co/storage/v1/object/sign/event-theme/x.jpg?token=t",
        }),
      ),
    ).toEqual({
      name: "Dani’s 40th",
      dateLabel: "Sat, 18 Oct 2026",
      message: "Thanks for coming!",
      accent: "marigold",
      hashtag: "DaniTurns40",
      imageUrl: "https://example.supabase.co/storage/v1/object/sign/event-theme/x.jpg?token=t",
    });
  });

  it("ignores unrelated messages", () => {
    expect(parseLookPreviewMessage({ type: "other", state: {} })).toBeNull();
    expect(parseLookPreviewMessage("hello")).toBeNull();
    expect(parseLookPreviewMessage(null)).toBeNull();
  });

  it("never lets an arbitrary color, hashtag or URL through", () => {
    const parsed = parseLookPreviewMessage(
      message({
        name: "",
        accent: "#ff0000",
        hashtag: "two words",
        imageUrl: "javascript:alert(1)",
      }),
    );
    expect(parsed).toEqual({
      name: "Your event",
      dateLabel: null,
      message: null,
      accent: "violet",
      hashtag: null,
      imageUrl: null,
    });
  });
});
