import type { ReactNode } from "react";
import type { FullSetKeepsakeInput, KeepsakeDate, SlotPhoto } from "../context";
import { FULL_SET_FOCUS } from "../crop";
import {
  FULL_SET_CANVAS,
  FULL_SET_SLOTS,
  nameSize,
  PRINTS_ROTATION,
  THEME_IMAGE_BOXES,
  type NameSteps,
  type SlotRect,
} from "../geometry";
import { Lockup, ON_LIGHT, oneColour, Wordmark } from "./brand";
import { DEEP_NIGHT, Img, INK, MUTED, ShadowedBox, SLOT_FILL, WHITE, withAlpha, type ShadowSpec } from "./parts";
import { bodyFont, clamp, ellipsis, headingFont, type KeepsakeTarget } from "./target";

/**
 * The five Full Set keepsake styles (docs/design-direction.md → "Full Set keepsakes", board
 * §11–§14). Every style draws `photos[i]` in `FULL_SET_SLOTS[style][i]` and nothing inside a slot.
 * The input carries no message and no per-photo data, so none can appear. The theme image is a
 * seal, ground, band or texture — never capture-sized, never a sixth photo — and every style is
 * complete without it.
 */

/** The two large shadows in the family: Strip's paper and each Prints print. */
export const FULL_SET_SHADOWS = {
  stripPaper: {
    width: 444,
    height: 1608,
    radius: 4,
    layers: [
      { y: 30, blur: 70, rgb: [10, 8, 20], alpha: 0.34 },
      { y: 3, blur: 8, rgb: [10, 8, 20], alpha: 0.2 },
    ],
  },
  print: {
    width: 452,
    height: 514,
    radius: 3,
    layers: [
      { y: 22, blur: 44, rgb: [20, 16, 40], alpha: 0.16 },
      { y: 2, blur: 5, rgb: [20, 16, 40], alpha: 0.14 },
    ],
  },
} as const satisfies Record<string, ShadowSpec>;

/** Pre-blurred shadow bitmaps for the export, keyed like FULL_SET_SHADOWS (see ShadowedBox). */
export type FullSetShadowSprites = Partial<Record<keyof typeof FULL_SET_SHADOWS, string>>;

type Props = { input: FullSetKeepsakeInput; target: KeepsakeTarget; shadows?: FullSetShadowSprites };

const NAME_STEPS: Record<FullSetKeepsakeInput["style"], NameSteps> = {
  signature: [80, 66, 56, 48],
  strip: [104, 88, 74, 60],
  grid: [72, 60, 50, 42],
  spotlight: [64, 54, 48, 44],
  prints: [68, 56, 48, 40],
};

export function FullSetKeepsake({ input, target, shadows }: Props) {
  switch (input.style) {
    case "signature":
      return <Signature input={input} target={target} />;
    case "strip":
      return <Strip input={input} target={target} shadows={shadows} />;
    case "grid":
      return <Grid input={input} target={target} />;
    case "spotlight":
      return <Spotlight input={input} target={target} />;
    case "prints":
      return <Prints input={input} target={target} shadows={shadows} />;
  }
}

function Canvas({ children, background, target }: { children: ReactNode; background: string; target: KeepsakeTarget }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: FULL_SET_CANVAS.width,
        height: FULL_SET_CANVAS.height,
        overflow: "hidden",
        background,
        fontFamily: bodyFont(target),
        color: INK,
      }}
    >
      {children}
    </div>
  );
}

/** One photo filling its slot with the family's cover crop (`50% 30%`). */
function Slot({ rect, photo, radius, position = "absolute" }: { rect: SlotRect; photo: SlotPhoto; radius: number; position?: "absolute" | "wrapped" }) {
  return (
    <div
      style={{
        position: "absolute",
        left: position === "absolute" ? rect.x : 24,
        top: position === "absolute" ? rect.y : 24,
        width: rect.width,
        height: rect.height,
        display: "flex",
        overflow: "hidden",
        borderRadius: radius,
        background: SLOT_FILL,
      }}
    >
      <Img src={photo.src} width={rect.width} height={rect.height} focus={FULL_SET_FOCUS} />
    </div>
  );
}

/**
 * A full-bleed layer over a `width × height` box. Pixel sizes on purpose: Satori draws nothing
 * for an absolute box sized in percent or by `right`/`bottom` insets (measured in Slice 16).
 */
function Fill({ width, height, style }: { width: number; height: number; style: Record<string, string | number> }) {
  return <div style={{ position: "absolute", left: 0, top: 0, width, height, display: "flex", ...style }} />;
}

/** Date + hashtag on one wrapping row; each collapses when absent. */
function Meta({
  date,
  hashtag,
  size,
  dateColor,
  hashtagColor,
  gap,
  rowGap,
  square,
}: {
  date: KeepsakeDate | null;
  hashtag: string | null;
  size: number;
  dateColor: string;
  hashtagColor: string;
  gap: number;
  rowGap: number;
  square?: { size: number; color: string };
}) {
  if (!date && !hashtag) return null;
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap, rowGap, minWidth: 0 }}>
      {square && <div style={{ display: "flex", width: square.size, height: square.size, background: square.color, flexShrink: 0 }} />}
      {date && (
        <span style={{ display: "flex", fontWeight: 600, fontSize: size, color: dateColor, whiteSpace: "nowrap" }}>{date.label}</span>
      )}
      {hashtag && (
        <span style={{ ...ellipsis(), maxWidth: "100%", fontWeight: 700, fontSize: size, color: hashtagColor }}>{`#${hashtag}`}</span>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------------- Signature

function Signature({ input, target }: Props) {
  const { event, theme, photos } = input;
  const slots = FULL_SET_SLOTS.signature;
  const square = slots[4];
  const seal = THEME_IMAGE_BOXES.signature!;
  return (
    <Canvas background={WHITE} target={target}>
      {/* Colour lives in the centre: a 10 px accent mat around the closing square. */}
      <div style={{ position: "absolute", left: square.x - 10, top: square.y - 10, width: square.width + 20, height: square.height + 20, display: "flex", background: theme.accent.base, borderRadius: 6 }} />
      {photos.map((photo, i) => (
        <Slot key={i} rect={slots[i]} photo={photo} radius={4} />
      ))}
      <div style={{ position: "absolute", left: 72, right: 260, top: 1304, height: 496, display: "flex", flexDirection: "row", alignItems: "center", gap: 36 }}>
        {theme.image && (
          <div style={{ display: "flex", width: seal.width, height: seal.height, borderRadius: 64, overflow: "hidden", flexShrink: 0, boxShadow: `0 0 0 6px ${WHITE}, 0 0 0 8px ${theme.accent.tint}` }}>
            <Img src={theme.image.src} width={seal.width} height={seal.height} focus={seal.focus} />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0, flexShrink: 1 }}>
          <div style={{ ...clamp(target, 2), fontFamily: headingFont(target), fontWeight: 600, fontSize: nameSize(event.name, NAME_STEPS.signature), lineHeight: 1.06, letterSpacing: "-0.01em", color: INK }}>
            {event.name}
          </div>
          <Meta
            date={event.date}
            hashtag={event.hashtag}
            size={30}
            dateColor={MUTED}
            hashtagColor={theme.accent.ink}
            gap={17}
            rowGap={9}
            square={{ size: 15, color: theme.accent.base }}
          />
        </div>
      </div>
      <Wordmark height={28} style={{ position: "absolute", right: 72, top: 1538 }} />
    </Canvas>
  );
}

// ------------------------------------------------------------------------------------- Strip

function Strip({ input, target, shadows }: Props) {
  const { event, theme, photos } = input;
  const slots = FULL_SET_SLOTS.strip;
  const ground = THEME_IMAGE_BOXES.strip!;
  const onImage = Boolean(theme.image);
  const text = onImage ? WHITE : theme.accent.fillText;
  const inkText = text !== WHITE;
  return (
    <Canvas background={onImage ? DEEP_NIGHT : theme.accent.fill} target={target}>
      {theme.image && (
        <>
          <Img src={theme.image.src} width={ground.width} height={ground.height} focus={ground.focus} style={{ position: "absolute", left: 0, top: 0 }} />
          <Fill {...FULL_SET_CANVAS} style={{ backgroundImage: "linear-gradient(180deg, rgba(21,18,31,.62) 0%, rgba(21,18,31,.42) 38%, rgba(21,18,31,.9) 100%)" }} />
        </>
      )}
      <ShadowedBox spec={FULL_SET_SHADOWS.stripPaper} background={WHITE} target={target} sprite={shadows?.stripPaper} style={{ left: 96, top: 96 }} />
      {photos.map((photo, i) => (
        <Slot key={i} rect={slots[i]} photo={photo} radius={2} />
      ))}
      <Lockup height={30} colors={ON_LIGHT} style={{ position: "absolute", left: 209.5, top: 1630 }} />
      {event.date && (
        <div style={{ position: "absolute", left: 612, right: 96, top: 96, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontWeight: 800, fontSize: 28, letterSpacing: "0.2em", color: onImage ? "rgba(255,255,255,.78)" : inkText ? "rgba(21,20,26,.72)" : "rgba(255,255,255,.8)" }}>
            {event.date.stamp}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: 612, right: 96, bottom: 96, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", width: 56, height: 8, background: onImage ? theme.accent.base : text, opacity: onImage ? 1 : 0.9 }} />
        <div style={{ ...clamp(target, 4), fontFamily: headingFont(target), fontWeight: 600, fontSize: nameSize(event.name, NAME_STEPS.strip), lineHeight: 1.02, letterSpacing: "-0.015em", color: text }}>
          {event.name}
        </div>
        {event.hashtag && (
          <div style={{ ...ellipsis(), fontWeight: 700, fontSize: 32, color: onImage ? theme.accent.onDark : text }}>{`#${event.hashtag}`}</div>
        )}
      </div>
    </Canvas>
  );
}

// -------------------------------------------------------------------------------------- Grid

function Grid({ input, target }: Props) {
  const { event, theme, photos } = input;
  const slots = FULL_SET_SLOTS.grid;
  const text = theme.accent.fillText;
  const inkText = text !== WHITE;
  return (
    <Canvas background={WHITE} target={target}>
      {photos.map((photo, i) => (
        <Slot key={i} rect={slots[i]} photo={photo} radius={4} />
      ))}
      {/* The sixth cell is the event's own end card, in the accent fill — never a photo. */}
      <div style={{ position: "absolute", left: 610, top: 1192, width: 526, height: 544, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 44, background: theme.accent.fill, borderRadius: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ ...clamp(target, 3), fontFamily: headingFont(target), fontWeight: 600, fontSize: nameSize(event.name, NAME_STEPS.grid), lineHeight: 1.04, letterSpacing: "-0.01em", color: text }}>
            {event.name}
          </div>
          <Meta
            date={event.date}
            hashtag={event.hashtag}
            size={27}
            dateColor={inkText ? "rgba(21,20,26,.72)" : "rgba(255,255,255,.82)"}
            hashtagColor={text}
            gap={15}
            rowGap={8}
          />
        </div>
      </div>
      <Lockup height={30} colors={oneColour(text)} style={{ position: "absolute", left: 654, top: 1236 }} />
    </Canvas>
  );
}

// --------------------------------------------------------------------------------- Spotlight

function Spotlight({ input, target }: Props) {
  const { event, theme, photos } = input;
  const slots = FULL_SET_SLOTS.spotlight;
  const band = THEME_IMAGE_BOXES.spotlight!;
  const base = theme.accent.base;
  return (
    <Canvas background={WHITE} target={target}>
      {photos.map((photo, i) => (
        <Slot key={i} rect={slots[i]} photo={photo} radius={4} />
      ))}
      <div style={{ position: "absolute", left: 0, top: 1536, width: FULL_SET_CANVAS.width, height: band.height, display: "flex", overflow: "hidden" }}>
        {theme.image ? (
          <>
            <Img src={theme.image.src} width={band.width} height={band.height} focus={band.focus} style={{ position: "absolute", left: 0, top: 0 }} />
            <Fill width={band.width} height={band.height} style={{ backgroundImage: "linear-gradient(90deg, rgba(21,18,31,.9) 0%, rgba(21,18,31,.72) 55%, rgba(21,18,31,.5) 100%)" }} />
          </>
        ) : (
          <>
            <Fill width={band.width} height={band.height} style={{ background: DEEP_NIGHT }} />
            <Fill width={band.width} height={band.height} style={{ backgroundImage: `radial-gradient(ellipse 70% 120% at 92% 0%, ${withAlpha(base, 0.6)} 0%, ${withAlpha(base, 0)} 70%)` }} />
          </>
        )}
      </div>
      <div style={{ position: "absolute", left: 64, right: 340, top: 1536, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
        <div style={{ ...clamp(target, 2), fontFamily: headingFont(target), fontWeight: 600, fontSize: nameSize(event.name, NAME_STEPS.spotlight), lineHeight: 1.05, letterSpacing: "-0.01em", color: WHITE }}>
          {event.name}
        </div>
        <Meta
          date={event.date}
          hashtag={event.hashtag}
          size={28}
          dateColor="rgba(255,255,255,.78)"
          hashtagColor={theme.accent.onDark}
          gap={15}
          rowGap={8}
        />
      </div>
      <Lockup height={30} colors={oneColour(WHITE)} style={{ position: "absolute", right: 64, top: 1653 }} />
    </Canvas>
  );
}

// ------------------------------------------------------------------------------------ Prints

function Prints({ input, target, shadows }: Props) {
  const { event, theme, photos } = input;
  const slots = FULL_SET_SLOTS.prints;
  const texture = THEME_IMAGE_BOXES.prints!;
  return (
    <Canvas background={theme.accent.tint} target={target}>
      {theme.image && (
        <>
          <Img src={theme.image.src} width={texture.width} height={texture.height} focus={texture.focus} style={{ position: "absolute", left: 0, top: 0, opacity: 0.12 }} />
          <Fill {...FULL_SET_CANVAS} style={{ background: theme.accent.tint, opacity: 0.55 }} />
        </>
      )}
      <Fill {...FULL_SET_CANVAS} style={{ backgroundImage: "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 70%)" }} />
      {photos.map((photo, i) => {
        const window = slots[i];
        return (
          // The print (24 px border, 86 px lip) is rotated about its own centre; the declared slot
          // is its unrotated photo window.
          <ShadowedBox
            key={i}
            spec={FULL_SET_SHADOWS.print}
            background={WHITE}
            target={target}
            sprite={shadows?.print}
            style={{ left: window.x - 24, top: window.y - 24, transform: `rotate(${PRINTS_ROTATION[i]}deg)` }}
          >
            <Slot rect={window} photo={photo} radius={2} position="wrapped" />
          </ShadowedBox>
        );
      })}
      <div style={{ position: "absolute", left: 640, right: 88, top: 1300, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", width: 48, height: 8, background: theme.accent.base }} />
        <div style={{ ...clamp(target, 3), fontFamily: headingFont(target), fontWeight: 600, fontSize: nameSize(event.name, NAME_STEPS.prints), lineHeight: 1.05, letterSpacing: "-0.01em", color: INK }}>
          {event.name}
        </div>
        {event.date && <div style={{ display: "flex", fontWeight: 600, fontSize: 28, color: MUTED }}>{event.date.label}</div>}
        {event.hashtag && <div style={{ ...ellipsis(), fontWeight: 700, fontSize: 28, color: theme.accent.ink }}>{`#${event.hashtag}`}</div>}
      </div>
      <Lockup height={30} colors={ON_LIGHT} style={{ position: "absolute", right: 88, bottom: 80 }} />
    </Canvas>
  );
}
