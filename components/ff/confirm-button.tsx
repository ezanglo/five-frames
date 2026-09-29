"use client";

import { useRef, useTransition, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

/**
 * A button that asks before acting (DS06: "Delete always asks to confirm"). Uses the native
 * <dialog> element — focus is trapped and restored, and Escape cancels, without a library.
 */
export function ConfirmButton({
  action,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  variant = "secondary",
  size = "sm",
  className,
  children,
  ariaLabel,
  disabled,
}: {
  action: () => Promise<unknown>;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await action();
      dialogRef.current?.close();
    });
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        aria-label={ariaLabel}
        disabled={disabled || pending}
        onClick={() => dialogRef.current?.showModal()}
      >
        {children}
      </Button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-40px)] max-w-[400px] rounded-xl bg-surface p-0 text-ink backdrop:bg-surface-dark/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading font-bold">{title}</h2>
            {body && <div className="text-body text-ink-muted">{body}</div>}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              size="md"
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "danger" : "primary"}
              size="md"
              onClick={confirm}
              disabled={pending}
              autoFocus={!destructive}
            >
              {pending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
