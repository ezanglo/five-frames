"use client";

import { useActionState, useEffect, useState } from "react";
import {
  requestPasswordReset,
  resendSignupConfirmation,
  type AuthActionState,
} from "@/lib/auth/actions";
import { StepsCard } from "@/components/ff/auth-shell";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * "Check your inbox" body (host 04d / D1d): the address shown back, three steps, a spam hint and
 * a resend link that unlocks after 60 s. Resending reuses the same server action, so the
 * confirmation copy stays identical whether or not the address has an account.
 */
export function CheckInbox({ email, kind }: { email: string; kind: "reset" | "signup" }) {
  const action = kind === "reset" ? requestPasswordReset : resendSignupConfirmation;
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(action, {
    error: null,
  });
  const [submissions, setSubmissions] = useState(0);

  const steps =
    kind === "reset"
      ? ["Open the email from FiveFrames", "Tap “Reset password”", "Choose a new password"]
      : ["Open the email from FiveFrames", "Tap the confirmation link", "Sign in to FiveFrames"];

  return (
    <div className="flex flex-col gap-5">
      <StepsCard steps={steps} />
      <p className="text-center text-caption font-medium text-ink-muted">
        Can’t find it? Check your spam or promotions folder.
      </p>
      <form
        action={formAction}
        onSubmit={() => setSubmissions((n) => n + 1)}
        className="flex flex-col items-center gap-1"
      >
        <input type="hidden" name="email" value={email} />
        <ResendLine key={submissions} pending={pending} />
        {state.error && (
          <p className="text-caption font-medium text-danger" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}

/** "Didn’t get it? Resend in 0:42" — remounted per submission, so each send restarts the cooldown. */
function ResendLine({ pending }: { pending: boolean }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  return (
    <p className="text-caption font-medium text-ink-muted" aria-live="polite">
      Didn’t get it?{" "}
      {secondsLeft > 0 ? (
        <span className="tabular">Resend in 0:{String(secondsLeft).padStart(2, "0")}</span>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="ff-focus rounded-md font-semibold text-brand hover:underline"
        >
          {pending ? "Sending…" : "Resend"}
        </button>
      )}
    </p>
  );
}
