import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FiveFrames fields (DS04). Labels always sit above the field — never placeholder-only. Fields
 * sit on surface/subtle with a 1px border and radius/md (14); focus is a brand border + 4px
 * violet ring on white; error is a danger border with danger helper text. Real inputs use
 * 16px text so iOS never auto-zooms.
 */
export const fieldControlClass =
  "w-full rounded-md border border-line bg-surface-subtle text-[16px] leading-normal text-ink outline-none transition-[border-color,box-shadow,background-color] placeholder:text-ink-placeholder focus:border-brand focus:bg-surface focus:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:bg-surface";

export function Field({
  label,
  htmlFor,
  optional,
  aside,
  hint,
  error,
  errorId,
  hintId,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  /** Right-aligned element on the label row — a counter or a "Forgot password?" link. */
  aside?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  errorId?: string;
  hintId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-label font-semibold text-ink">
          {label}
          {optional && <span className="ml-1.5 font-medium text-ink-muted">optional</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={errorId} className="text-caption font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption font-medium text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Character counter for textareas; turns danger at the limit (DS04). */
export function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span
      className={cn(
        "tabular text-caption font-medium",
        value >= max ? "text-danger" : "text-ink-muted",
      )}
      aria-live="polite"
    >
      {value} / {max}
    </span>
  );
}

export function TextInput({
  icon,
  className,
  ...props
}: ComponentProps<"input"> & { icon?: ReactNode }) {
  return (
    <div className="relative">
      {icon && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted [&_svg]:size-[18px]"
        >
          {icon}
        </span>
      )}
      <input
        className={cn(fieldControlClass, "h-12 px-4", icon && "pl-11", className)}
        {...props}
      />
    </div>
  );
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldControlClass, "min-h-24 resize-none px-4 py-3", className)}
      {...props}
    />
  );
}

/** Native select — the platform picker on mobile (DS04 "use native select / time pickers"). */
export function SelectInput({
  icon,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { icon?: ReactNode }) {
  return (
    <div className="relative">
      {icon && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted [&_svg]:size-[18px]"
        >
          {icon}
        </span>
      )}
      <select
        className={cn(
          fieldControlClass,
          "h-12 appearance-none pr-10 pl-4 font-medium",
          icon && "pl-11",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}

/**
 * Toggle (DS03): 52×30, on = brand/primary, off = border/subtle. A native checkbox with
 * role="switch" so it posts with ordinary server-action forms ("on" when checked).
 */
export function Toggle({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type" | "role">) {
  return (
    <span className={cn("relative inline-flex h-[30px] w-[52px] shrink-0", className)}>
      <input
        type="checkbox"
        role="switch"
        className="peer ff-focus absolute inset-0 z-10 m-0 cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-brand peer-disabled:opacity-50"
      />
      <span
        aria-hidden
        className="absolute top-[3px] left-[3px] size-6 rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.2)] transition-transform peer-checked:translate-x-[22px]"
      />
    </span>
  );
}
