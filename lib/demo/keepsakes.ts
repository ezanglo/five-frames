import {
  buildFullSetKeepsakeInput,
  buildKeepsakeContext,
  buildSingleKeepsakeInput,
  type FullSetKeepsakeInput,
  type KeepsakeContext,
  type KeepsakePhoto,
  type SingleKeepsakeInput,
} from "@/lib/keepsakes/context";
import { FULL_SET_SAMPLES, SAMPLE_MESSAGE, SINGLE_SAMPLES } from "@/lib/keepsakes/samples";
import type { FullSetStyleId, SingleStyleId } from "@/lib/keepsakes/styles";
import { scene } from "@/lib/marketing/sample-scenes";

/**
 * Keepsakes in the public demo (product.md §7.1 MVP-optional, decision D14, architecture §6b and
 * §7b "Previews"). The real shared registry and templates, drawn in the browser with one fixed
 * sample look. The visitor can't configure it, and nothing here names a real event, carries a
 * link or token, or reaches the server: every image is a bundled data URI or the visitor's own
 * in-memory object URL.
 */

/** The fixed sample look. Not an event row: only the fields a keepsake context copies. */
export const DEMO_KEEPSAKE_EVENT = {
  name: "Ana & Marco",
  event_date: "2026-11-21",
  hashtag: "AnaAndMarco",
  accent_color: "rose",
} as const;

/** The sample theme image: a bundled illustration, never one of the sample "guest" photos. */
export const DEMO_THEME_IMAGE = { src: scene(3).src } as const;

export function demoKeepsakeContext(): KeepsakeContext {
  return buildKeepsakeContext(DEMO_KEEPSAKE_EVENT, DEMO_THEME_IMAGE);
}

/**
 * A Single-photo keepsake on the visitor's latest kept demo shot when there is one (with the
 * message they typed), otherwise on a bundled sample photo.
 */
export function demoSingleInput(
  context: KeepsakeContext,
  style: SingleStyleId,
  own: { photo: KeepsakePhoto; message: string } | null,
): SingleKeepsakeInput {
  return own
    ? buildSingleKeepsakeInput(context, style, own.photo, own.message || null)
    : buildSingleKeepsakeInput(context, style, SINGLE_SAMPLES.portrait, SAMPLE_MESSAGE);
}

/**
 * A Full Set keepsake is always shown on the five bundled samples, so the visitor sees the family
 * without supplying five photos, and it never becomes something to work toward in the demo.
 */
export function demoFullSetInput(context: KeepsakeContext, style: FullSetStyleId): FullSetKeepsakeInput {
  return buildFullSetKeepsakeInput(context, style, FULL_SET_SAMPLES);
}
