/**
 * One capture attempt on Your Five: choose → preview → Keep (reserve → upload → commit). Pure,
 * so which transitions keep or clear the guest's error message is testable without a browser.
 *
 * An error stays visible until the guest does something new: chooses a photo, discards the
 * preview, or taps Keep/Retry. An attempt that ends without a commit (no frame free, capture
 * closed, reservation lapsed) clears the photo but keeps the message that explains why. Before
 * this reducer, ending the attempt also cleared the message, so Keep seemed to do nothing.
 *
 * `uploaded` remembers a reservation whose photo is already in Storage while its commit request
 * failed in transit. Retry then commits that same reservation again (idempotent server-side)
 * instead of reserving and uploading anew. Any new photo, discard, end or commit forgets it.
 */

export type AttemptPhase =
  | "idle"
  | "resuming"
  | "previewing"
  | "reserving"
  | "uploading"
  | "committing"
  | "error";

/** A reserved, uploaded photo awaiting its commit. */
export type UploadedReservation = { captureId: string; slotIndex: number };

export type AttemptState = {
  phase: AttemptPhase;
  file: File | null;
  previewUrl: string | null;
  message: string;
  error: string | null;
  uploaded: UploadedReservation | null;
};

/** Why an attempt ended with nothing kept and no retry possible. */
export type EndedReason = "frames_exhausted" | "capture_not_open" | "expired";

export const ATTEMPT_COPY = {
  frames_exhausted: "All five shots are already kept.",
  capture_not_open: "Capture has ended.",
  expired: "That attempt took too long. Please try again.",
  notJoined: "Your session isn't recognized. Reload the page and rejoin.",
  uploadFailed: "Photo didn’t upload. Check your connection and tap Retry — your shot is safe.",
  notUploaded: "We couldn’t confirm the upload yet. Tap Retry — your shot is safe.",
  connectionLost: "Couldn’t reach FiveFrames. Check your connection and tap Retry — your shot is safe.",
  unknown: "Something went wrong. Tap Retry — your shot is safe.",
} as const;

export type AttemptAction =
  | { type: "resumable" }
  | { type: "settled" }
  | { type: "chosen"; file: File; previewUrl: string }
  | { type: "message"; text: string }
  | { type: "discarded"; resuming: boolean }
  | { type: "step"; phase: "reserving" | "uploading" | "committing" }
  | { type: "retryable"; error: string; uploaded?: UploadedReservation | null }
  | { type: "ended"; reason: EndedReason }
  | { type: "committed" };

export const initialAttemptState: AttemptState = {
  phase: "idle",
  file: null,
  previewUrl: null,
  message: "",
  error: null,
  uploaded: null,
};

const noPhoto = { file: null, previewUrl: null, message: "", uploaded: null } as const;

export function attemptReducer(state: AttemptState, action: AttemptAction): AttemptState {
  switch (action.type) {
    case "resumable":
      return { ...state, phase: "resuming" };
    case "settled":
      return { ...state, phase: "idle" };
    case "chosen":
      return {
        ...state,
        phase: "previewing",
        file: action.file,
        previewUrl: action.previewUrl,
        error: null,
        uploaded: null,
      };
    case "message":
      return { ...state, message: action.text };
    case "discarded":
      return { ...state, ...noPhoto, error: null, phase: action.resuming ? "resuming" : "idle" };
    case "step":
      // Keep/Retry starts with reserving, or with committing when Retry re-commits an upload.
      return { ...state, phase: action.phase, error: null };
    case "retryable":
      return { ...state, phase: "error", error: action.error, uploaded: action.uploaded ?? null };
    case "ended":
      return { ...state, ...noPhoto, phase: "idle", error: ATTEMPT_COPY[action.reason] };
    case "committed":
      return { ...state, ...noPhoto, phase: "idle", error: null };
  }
}
