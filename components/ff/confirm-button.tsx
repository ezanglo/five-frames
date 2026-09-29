"use client";

import { useRef, useTransition, type MouseEvent, type ReactNode, type Ref } from "react";
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
      <ConfirmDialog
        ref={dialogRef}
        title={title}
        body={body}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}

/**
 * A submit button for an ordinary server-action form that asks before submitting. The form's own
 * validation runs first; confirming calls `requestSubmit()`, so `useActionState` pending and
 * result states work unchanged. For privileged, hard-to-reverse submissions (Operator Console).
 */
export function ConfirmSubmitButton({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  variant = "primary",
  size = "md",
  className,
  children,
  pending,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  pending?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={buttonRef}
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={() => {
          if (buttonRef.current?.form?.reportValidity()) dialogRef.current?.showModal();
        }}
      >
        {children}
      </Button>
      <ConfirmDialog
        ref={dialogRef}
        title={title}
        body={body}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        onConfirm={() => {
          dialogRef.current?.close();
          buttonRef.current?.form?.requestSubmit();
        }}
      />
    </>
  );
}

function ConfirmDialog({
  ref,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive,
  pending,
  onConfirm,
}: {
  ref: Ref<HTMLDialogElement>;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  function close(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest("dialog")?.close();
  }

  return (
    <dialog
      ref={ref}
      className="m-auto w-[calc(100%-40px)] max-w-[400px] rounded-xl bg-surface p-0 text-ink backdrop:bg-surface-dark/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading font-bold">{title}</h2>
          {body && <div className="text-body text-ink-muted">{body}</div>}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={close} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
            disabled={pending}
            autoFocus={!destructive}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
