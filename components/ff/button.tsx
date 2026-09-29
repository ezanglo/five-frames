import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * FiveFrames buttons (DS03). Every button is a pill. One violet primary per screen; everything
 * else steps down to secondary (grey), dark (host utility actions), on-tint (only inside
 * brand/tint cards) or compact. Compact 32px buttons keep an invisible ≥44×44 hit area.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "dark"
  | "onTint"
  | "outline"
  | "danger"
  | "frosted"
  | "text";

export type ButtonSize = "lg" | "md" | "sm" | "compact" | "icon" | "iconSm" | "iconCompact";

const BASE =
  "ff-focus inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,box-shadow,color,transform] duration-150 select-none active:scale-[0.99] disabled:pointer-events-none disabled:active:scale-100 aria-disabled:pointer-events-none [&_svg]:shrink-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-ink-inverse shadow-glow hover:bg-[color-mix(in_srgb,var(--brand-primary),black_8%)] active:bg-[color-mix(in_srgb,var(--brand-primary),black_18%)] active:shadow-none disabled:bg-line disabled:text-ink-muted disabled:shadow-none aria-disabled:bg-line aria-disabled:text-ink-muted aria-disabled:shadow-none",
  secondary:
    "border border-line bg-surface-subtle text-ink hover:bg-[color-mix(in_srgb,var(--color-surface-subtle),var(--color-text-primary)_4%)] active:bg-line disabled:text-ink-placeholder",
  dark: "bg-ink text-ink-inverse hover:bg-black active:bg-black disabled:bg-line disabled:text-ink-muted",
  onTint: "bg-surface text-brand hover:bg-surface-subtle active:bg-surface-subtle disabled:text-ink-placeholder",
  outline:
    "border border-brand bg-surface text-brand hover:bg-brand-tint active:bg-brand-tint disabled:border-line disabled:text-ink-placeholder",
  danger:
    "bg-danger-tint text-danger hover:bg-[color-mix(in_srgb,var(--color-status-danger-tint),var(--color-status-danger)_8%)] active:bg-[color-mix(in_srgb,var(--color-status-danger-tint),var(--color-status-danger)_14%)] disabled:opacity-60",
  frosted: "ff-frosted text-ink-inverse hover:bg-white/25",
  text: "rounded-md px-0 text-brand hover:underline underline-offset-4",
};

const SIZES: Record<ButtonSize, string> = {
  lg: "h-14 px-6 text-button [&_svg]:size-5",
  md: "h-12 px-5 text-button [&_svg]:size-[18px]",
  sm: "h-10 px-4 text-label [&_svg]:size-4",
  compact: "ff-hit h-8 gap-1.5 px-3 text-micro [&_svg]:size-3.5",
  icon: "size-11 [&_svg]:size-5",
  iconSm: "size-10 [&_svg]:size-[18px]",
  iconCompact: "ff-hit size-8 [&_svg]:size-3.5",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "lg",
  className?: string,
) {
  return cn(BASE, VARIANTS[variant], variant !== "text" && SIZES[size], className);
}

type Common = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & Common) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & Common) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** Plain anchor (downloads, external/mailto) styled as a button. */
export function ButtonAnchor({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"a"> & Common) {
  return <a className={buttonClass(variant, size, className)} {...props} />;
}
