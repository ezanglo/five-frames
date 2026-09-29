"use client";

import type { ReactNode } from "react";
import { Check, Lock, RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Counter, Field, TextArea } from "./field";
import { SHOTS_PER_GUEST } from "./shots";

/**
 * Preview + Message (guest 03): the selected photo full-bleed on dark with the shot indicator,
 * then a white sheet with the optional message, the finality note, Retake (free) and Keep photo
 * (the one committing action). Purely presentational — whoever renders it owns what "keep"
 * does. The photo renders object-contain so the guest sees the whole image before committing.
 */
export function PreviewSheet({
  previewUrl,
  shot,
  taken,
  message,
  messageMax,
  onMessage,
  keepState,
  keepLabel,
  error,
  note,
  onDiscard,
  onRetake,
  onKeep,
}: {
  previewUrl: string;
  shot: number;
  taken: number;
  message: string;
  messageMax: number;
  onMessage: (value: string) => void;
  keepState: "idle" | "busy" | "retry";
  keepLabel: string;
  error?: string | null;
  /** Replaces the default finality note (the demo explains that nothing is uploaded). */
  note?: ReactNode;
  onDiscard: () => void;
  onRetake: () => void;
  onKeep: () => void;
}) {
  const busy = keepState === "busy";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview shot ${shot}`}
      className="fixed inset-0 z-40 overflow-y-auto bg-surface-dark"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        <div className="relative flex min-h-[52dvh] flex-1 flex-col">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img
            src={previewUrl}
            alt={`Your photo for shot ${shot}`}
            className="absolute inset-0 size-full object-contain"
          />
          <div className="ff-safe-top relative flex h-[60px] items-center justify-center px-4">
            <span className="ff-frosted flex h-10 items-center gap-2 rounded-full px-4 text-micro font-semibold text-ink-inverse">
              <span className="flex items-center gap-1" aria-hidden>
                {Array.from({ length: SHOTS_PER_GUEST }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full",
                      i === shot - 1
                        ? "w-4 bg-brand-highlight"
                        : i < taken
                          ? "w-1.5 bg-ink-inverse"
                          : "w-1.5 bg-ink-inverse/40",
                    )}
                  />
                ))}
              </span>
              Shot {shot} of {SHOTS_PER_GUEST}
            </span>
            <button
              type="button"
              onClick={onDiscard}
              disabled={busy}
              aria-label="Discard this photo"
              className="ff-focus ff-frosted absolute right-4 flex size-10 items-center justify-center rounded-full text-ink-inverse disabled:opacity-40"
            >
              <X className="size-5" />
            </button>
          </div>
          <span className="ff-frosted relative mt-auto mb-10 ml-4 flex h-8 w-fit items-center gap-1.5 rounded-full px-3 text-micro font-semibold text-ink-inverse">
            <Sparkles className="size-3.5" aria-hidden />
            Just now
          </span>
        </div>

        <div className="ff-safe-bottom relative -mt-6 flex flex-col gap-4 rounded-t-sheet bg-surface px-5 pt-6">
          <Field
            label="Add a message"
            htmlFor="capture-message"
            optional
            aside={<Counter value={message.length} max={messageMax} />}
          >
            <TextArea
              id="capture-message"
              value={message}
              maxLength={messageMax}
              rows={2}
              onChange={(e) => onMessage(e.target.value)}
              onFocus={(e) => e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })}
              disabled={busy}
              placeholder="Say something about this moment"
            />
          </Field>

          <p className="flex items-start gap-2 text-caption font-medium text-ink-muted">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {note ?? "Once kept, this photo is final. Retakes are free and don’t use a shot."}
          </p>

          {error && (
            <p className="text-caption font-medium text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            {!busy && (
              <Button variant="secondary" onClick={onRetake} className="flex-1">
                <RotateCcw aria-hidden />
                Retake
              </Button>
            )}
            <Button onClick={onKeep} disabled={busy} className="flex-[1.4]">
              {busy ? (
                <RefreshCw className="animate-spin" aria-hidden />
              ) : keepState === "retry" ? (
                <RefreshCw aria-hidden />
              ) : (
                <Check aria-hidden />
              )}
              <span aria-live="polite">{keepLabel}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
