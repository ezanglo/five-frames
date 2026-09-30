/**
 * The curated event colors (product.md §10.1, architecture §7a, decision D19). Seven keys, no
 * custom color: the design pass closed that open question (docs/design-direction.md → "Curated
 * event colors"). Shared by server and client, so no `server-only` and no secrets.
 *
 * The database stores the key, never a color. Each key carries fixed, pre-verified roles, and
 * `accents.test.ts` asserts every pairing the guest screens rely on clears WCAG AA — that test
 * is the contrast safeguard. `base` is decoration only (swatches, glows); it is never text.
 */

export type AccentRoles = {
  /** Decoration only: swatches, header glow, accent squares. Never used for text. */
  base: string;
  /** Primary action fill (buttons, the next shot slot border). */
  fill: string;
  /** Text and icons on `fill`. White, except ink on marigold. */
  fillText: string;
  /** Accent-colored text on white or tint surfaces ("N of 5", links, hashtag chips). */
  ink: string;
  /** Accent highlight on night/dark surfaces (header hashtag, glow second stop). */
  onDark: string;
  /** Pale accent surface (highlight cards, the next shot slot). */
  tint: string;
};

export type AccentDefinition = {
  key: AccentKey;
  /** Human label: the only thing a host ever sees besides the swatch. */
  label: string;
  roles: AccentRoles;
};

const INK = "#15141A";
const WHITE = "#FFFFFF";

export const ACCENTS = [
  {
    key: "violet",
    label: "Violet",
    roles: { base: "#6B2BD9", fill: "#6B2BD9", fillText: WHITE, ink: "#6B2BD9", onDark: "#B58CFF", tint: "#F3EDFE" },
  },
  {
    key: "coral",
    label: "Coral",
    roles: { base: "#E8604C", fill: "#C8432F", fillText: WHITE, ink: "#B83D2A", onDark: "#FF9A88", tint: "#FDEEEB" },
  },
  {
    key: "rose",
    label: "Rose",
    roles: { base: "#D93A7E", fill: "#C02A6C", fillText: WHITE, ink: "#B02664", onDark: "#FF8DBE", tint: "#FCEBF3" },
  },
  {
    key: "marigold",
    label: "Marigold",
    roles: { base: "#E9A23B", fill: "#E9A23B", fillText: INK, ink: "#8F5A00", onDark: "#F5BE6A", tint: "#FDF3E3" },
  },
  {
    key: "teal",
    label: "Teal",
    roles: { base: "#12937A", fill: "#0E7A66", fillText: WHITE, ink: "#0B6E5C", onDark: "#5FD4B8", tint: "#E6F5F1" },
  },
  {
    key: "ocean",
    label: "Ocean",
    roles: { base: "#2D6FE0", fill: "#2563D4", fillText: WHITE, ink: "#1F5AC4", onDark: "#8DB4FF", tint: "#EAF1FD" },
  },
  {
    key: "midnight",
    label: "Midnight",
    roles: { base: "#26304F", fill: "#26304F", fillText: WHITE, ink: "#26304F", onDark: "#AEB9DA", tint: "#EEF0F5" },
  },
] as const satisfies readonly { key: string; label: string; roles: AccentRoles }[];

export type AccentKey = (typeof ACCENTS)[number]["key"];

export const DEFAULT_ACCENT: AccentKey = "violet";

const BY_KEY = new Map<string, AccentDefinition>(ACCENTS.map((a) => [a.key, a]));

export function isAccentKey(value: unknown): value is AccentKey {
  return typeof value === "string" && BY_KEY.has(value);
}

/**
 * The registry entry for a stored key. An unknown key (a palette edit, a hand-edited row)
 * renders as violet rather than failing, so a render can never break on this value.
 */
export function accentFor(key: string | null | undefined): AccentDefinition {
  return (key ? BY_KEY.get(key) : undefined) ?? BY_KEY.get(DEFAULT_ACCENT)!;
}

/**
 * The applied shades for an event color (architecture §7a). The curated set's roles are fixed
 * and pre-verified rather than computed at runtime, so what the host previews is exactly what
 * guests get; the unit test proves each one clears contrast.
 */
export function deriveAccentRoles(key: string | null | undefined): AccentRoles {
  return accentFor(key).roles;
}

/**
 * Scoped CSS custom properties for a themed guest surface (architecture §7a: "accent as scoped
 * CSS custom properties set server-side on the guest shell"). Every value comes from the
 * registry above; no host-entered string ever reaches CSS. Host chrome, the Operator Console,
 * the FiveFrames logo and the QR plate never receive these.
 */
export function accentCssVars(key: string | null | undefined): Record<string, string> {
  const roles = deriveAccentRoles(key);
  return {
    "--brand-base": roles.base,
    "--brand-primary": roles.fill,
    "--brand-foreground": roles.fillText,
    "--brand-ink": roles.ink,
    "--brand-highlight": roles.onDark,
    "--brand-tint": roles.tint,
  };
}
