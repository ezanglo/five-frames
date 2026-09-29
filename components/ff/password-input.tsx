"use client";

import { useState, type ComponentProps } from "react";
import { Check, Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldControlClass } from "./field";

/** Password field (DS04): eye toggles show/hide with aria-pressed. */
export function PasswordInput({
  className,
  matched,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { matched?: boolean }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-ink-muted"
      />
      <input
        type={visible ? "text" : "password"}
        className={cn(fieldControlClass, "h-12 pr-20 pl-11", className)}
        {...props}
      />
      <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
        {matched && (
          <span className="flex size-5 items-center justify-center rounded-full bg-success text-ink-inverse">
            <Check className="size-3" strokeWidth={3} aria-label="Passwords match" />
          </span>
        )}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="ff-focus flex size-10 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </div>
    </div>
  );
}

export type PasswordStrength = "empty" | "weak" | "good" | "strong";

/** Presentation-only strength hint; the server (Supabase Auth) remains the authority. */
export function scorePassword(value: string): PasswordStrength {
  if (!value) return "empty";
  if (value.length < 8) return "weak";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  if (value.length >= 12 && classes >= 3) return "strong";
  return "good";
}

const STRENGTH_COPY: Record<Exclude<PasswordStrength, "empty">, string> = {
  weak: "Weak — use at least 8 characters",
  good: "Good — at least 8 characters",
  strong: "Strong",
};

/** Password strength (DS03): 4 segments; weak red · good violet · strong green. */
export function PasswordStrengthMeter({ value }: { value: string }) {
  const strength = scorePassword(value);
  const filled = { empty: 0, weak: 1, good: 3, strong: 4 }[strength];
  const color =
    strength === "weak" ? "bg-danger" : strength === "strong" ? "bg-success" : "bg-brand";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 rounded-full", i < filled ? color : "bg-line")} />
        ))}
      </div>
      <p className="flex items-center gap-1 text-micro font-medium text-ink-muted" aria-live="polite">
        {strength !== "empty" && strength !== "weak" && (
          <Check className="size-3 text-success" aria-hidden />
        )}
        {strength === "empty" ? "Use at least 8 characters" : STRENGTH_COPY[strength]}
      </p>
    </div>
  );
}
