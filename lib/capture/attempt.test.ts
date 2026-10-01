import { describe, expect, it } from "vitest";
import {
  ATTEMPT_COPY,
  attemptReducer,
  initialAttemptState,
  type AttemptAction,
  type AttemptState,
} from "./attempt";

const photo = { name: "shot.jpg" } as File;

function run(actions: AttemptAction[], from: AttemptState = initialAttemptState): AttemptState {
  return actions.reduce(attemptReducer, from);
}

/** A photo chosen, previewed with a message, and Keep tapped. */
const keepTapped: AttemptAction[] = [
  { type: "chosen", file: photo, previewUrl: "blob:preview" },
  { type: "message", text: "hello" },
  { type: "step", phase: "reserving" },
];

describe("capture attempt errors stay visible", () => {
  it.each([
    ["frames_exhausted", ATTEMPT_COPY.frames_exhausted],
    ["capture_not_open", ATTEMPT_COPY.capture_not_open],
    ["expired", ATTEMPT_COPY.expired],
  ] as const)("an attempt ended by %s clears the photo but keeps its message", (reason, copy) => {
    const state = run([...keepTapped, { type: "ended", reason }]);
    expect(state.error).toBe(copy);
    expect(state.file).toBeNull();
    expect(state.previewUrl).toBeNull();
    expect(state.message).toBe("");
    expect(state.phase).toBe("idle");

    // Settling the pending key afterwards (the page's own bookkeeping) doesn't hide it either.
    expect(attemptReducer(state, { type: "settled" }).error).toBe(copy);
  });

  it("a commit-time lapse (upload or commit took too long) is shown, not swallowed", () => {
    const state = run([
      ...keepTapped,
      { type: "step", phase: "uploading" },
      { type: "step", phase: "committing" },
      { type: "ended", reason: "expired" },
    ]);
    expect(state.error).toBe(ATTEMPT_COPY.expired);
  });

  it("a retryable failure keeps the photo for Retry, and Retry clears the stale message", () => {
    const failed = run([
      ...keepTapped,
      { type: "step", phase: "uploading" },
      { type: "retryable", error: ATTEMPT_COPY.uploadFailed },
    ]);
    expect(failed.phase).toBe("error");
    expect(failed.error).toBe(ATTEMPT_COPY.uploadFailed);
    expect(failed.file).toBe(photo);
    expect(failed.message).toBe("hello");

    const retrying = attemptReducer(failed, { type: "step", phase: "reserving" });
    expect(retrying.error).toBeNull();
    expect(retrying.file).toBe(photo);
  });

  it("choosing a new photo or discarding clears a stale message", () => {
    const ended = run([...keepTapped, { type: "ended", reason: "frames_exhausted" }]);
    expect(
      attemptReducer(ended, { type: "chosen", file: photo, previewUrl: "blob:next" }).error,
    ).toBeNull();
    expect(attemptReducer(ended, { type: "discarded", resuming: false }).error).toBeNull();
  });

  it("a successful commit leaves no error and no photo", () => {
    const state = run([
      ...keepTapped,
      { type: "step", phase: "uploading" },
      { type: "step", phase: "committing" },
      { type: "committed" },
    ]);
    expect(state).toEqual(initialAttemptState);
  });
});
