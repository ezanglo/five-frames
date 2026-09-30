import type { ReactNode } from "react";
import type { KeepsakeDate, SingleKeepsakeInput } from "../context";
import { isPortraitLayout, nameSize, singlePhotoWindow, SINGLE_CANVAS, THEME_IMAGE_BOXES, type NameSteps } from "../geometry";
import { Lockup, ON_LIGHT, oneColour } from "./brand";
import { Img, INK, MUTED, NIGHT, ON_TINT, WHITE, withAlpha } from "./parts";
import { bodyFont, clamp, ellipsis, headingFont, type KeepsakeTarget } from "./target";

/**
 * The five Single-photo keepsake styles (docs/design-direction.md → "The five keepsake styles",
 * board §06). One component per style, each drawn on the 1080 × 1350 canvas in the Satori CSS
 * subset: flex and absolute boxes, radius, shadows, gradients, opacity, 2D rotate. The photo is
 * contained — its window takes the photo's own ratio (`singlePhotoWindow`) — and the theme image
 * never touches it. Missing message, date or hashtag collapses its space; nothing is a placeholder.
 */

type Props = { input: SingleKeepsakeInput; target: KeepsakeTarget };

const NAME_STEPS: Record<string, NameSteps> = {
  printMessage: [44, 44, 38, 31],
  print: [64, 56, 48, 44],
  booth: [62, 62, 52, 43],
  poster: [84, 84, 70, 59],
  journal: [46, 46, 38, 32],
  albumMessage: [34, 34, 29, 24],
  album: [44, 44, 37, 31],
};

const quoted = (message: string) => `“${message}”`;

export function SingleKeepsake({ input, target }: Props) {
  switch (input.style) {
    case "print":
      return <Print input={input} target={target} />;
    case "booth":
      return <Booth input={input} target={target} />;
    case "poster":
      return <Poster input={input} target={target} />;
    case "journal":
      return <Journal input={input} target={target} />;
    case "album":
      return <Album input={input} target={target} />;
  }
}

function Canvas({ children, background, target, column }: { children: ReactNode; background: string; target: KeepsakeTarget; column?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: column === false ? "row" : "column",
        position: "relative",
        width: SINGLE_CANVAS.width,
        height: SINGLE_CANVAS.height,
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

/** Accent square + date + hashtag. Absent entirely when there is no date and no hashtag. */
function MetaRow({
  date,
  hashtag,
  size,
  square,
  squareColor,
  dateColor,
  hashtagColor,
  gap,
  wrap = false,
  grow = false,
}: {
  date: KeepsakeDate | null;
  hashtag: string | null;
  size: number;
  square: number | null;
  squareColor: string;
  dateColor: string;
  hashtagColor: string;
  gap: number;
  /** Let the hashtag drop to its own line (Print, Album) instead of ellipsizing. */
  wrap?: boolean;
  /** Take the row's free space (Print shares its row with the lockup). */
  grow?: boolean;
}) {
  if (!date && !hashtag) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        flexWrap: wrap ? "wrap" : "nowrap",
        gap,
        flexGrow: grow ? 1 : 0,
        flexShrink: 1,
        flexBasis: grow ? 0 : "auto",
        minWidth: 0,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.2,
        color: dateColor,
      }}
    >
      {square !== null && (
        <div style={{ display: "flex", width: square, height: square, background: squareColor, borderRadius: 2, flexShrink: 0 }} />
      )}
      {date && <span style={{ display: "flex", whiteSpace: "nowrap" }}>{date.label}</span>}
      {hashtag && <span style={{ ...ellipsis(), color: hashtagColor }}>{`#${hashtag}`}</span>}
    </div>
  );
}

// ------------------------------------------------------------------------------------- Print

function Print({ input, target }: Props) {
  const { event, theme, photo, message } = input;
  const win = singlePhotoWindow("print", photo.width, photo.height);
  const size = nameSize(event.name, message ? NAME_STEPS.printMessage : NAME_STEPS.print);
  return (
    <Canvas background={WHITE} target={target}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", padding: "64px 64px 72px" }}>
        <div style={{ display: "flex", flexDirection: "column", width: win.width, gap: 40 }}>
          <Img src={photo.src} width={win.width} height={win.height} style={{ borderRadius: 6 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {message && (
              <div style={{ ...clamp(target, 2), fontWeight: 500, fontSize: 36, lineHeight: 1.3, color: INK }}>{quoted(message)}</div>
            )}
            <div style={{ ...clamp(target, 2), fontFamily: headingFont(target), fontWeight: 600, fontSize: size, lineHeight: 1.08, letterSpacing: "-0.01em", color: INK }}>
              {event.name}
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
              <MetaRow
                date={event.date}
                hashtag={event.hashtag}
                size={28}
                square={14}
                squareColor={theme.accent.base}
                dateColor={MUTED}
                hashtagColor={theme.accent.ink}
                gap={14}
                wrap
                grow
              />
              <Lockup height={30} colors={ON_LIGHT} style={{ marginLeft: "auto" }} />
            </div>
          </div>
        </div>
      </div>
    </Canvas>
  );
}

// ------------------------------------------------------------------------------------- Booth

function Booth({ input, target }: Props) {
  const { event, theme, photo } = input;
  const win = singlePhotoWindow("booth", photo.width, photo.height);
  const ink = theme.accent.fillText;
  const stamp = { fontWeight: 800, fontSize: 30, lineHeight: 1, color: ink } as const;
  return (
    <Canvas background={theme.accent.fill} target={target}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "72px 72px 64px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 24, minHeight: 30 }}>
          {event.date && <span style={{ ...stamp, display: "flex", letterSpacing: "0.12em", flexShrink: 0 }}>{event.date.stamp}</span>}
          {event.hashtag && (
            <span style={{ ...stamp, ...ellipsis(), letterSpacing: "0.02em", maxWidth: 560, textAlign: "right", marginLeft: "auto" }}>
              {`#${event.hashtag}`}
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", flexGrow: 1, padding: "36px 0", minHeight: 0 }}>
          <div style={{ display: "flex", padding: 16, background: WHITE, borderRadius: 8, boxShadow: "0 18px 40px rgba(0,0,0,.22)" }}>
            <Img src={photo.src} width={win.width} height={win.height} style={{ borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 32 }}>
          <div style={{ ...clamp(target, 2), flexShrink: 1, minWidth: 0, fontFamily: headingFont(target), fontWeight: 600, fontSize: nameSize(event.name, NAME_STEPS.booth), lineHeight: 1.05, letterSpacing: "-0.01em", color: ink }}>
            {event.name}
          </div>
          <div style={{ display: "flex", flexShrink: 0, paddingBottom: 8 }}>
            <Lockup height={30} colors={oneColour(ink)} />
          </div>
        </div>
      </div>
    </Canvas>
  );
}

// ------------------------------------------------------------------------------------ Poster

function Poster({ input, target }: Props) {
  const { event, theme, photo, message } = input;
  const win = singlePhotoWindow("poster", photo.width, photo.height);
  const portrait = isPortraitLayout("poster", photo.width, photo.height);
  const printTop = portrait ? 404 : 420;
  const field = THEME_IMAGE_BOXES.poster!;
  const base = theme.accent.base;
  return (
    <Canvas background={WHITE} target={target}>
      {theme.image ? (
        <>
          <Img src={theme.image.src} width={field.width} height={field.height} focus={field.focus} style={{ position: "absolute", top: 0, left: 0 }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: field.width, height: field.height, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(20,20,20,.20) 0%, rgba(20,20,20,.55) 45%, rgba(20,20,20,.92) 100%)" }} />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: field.width,
            height: field.height,
            display: "flex",
            background: NIGHT,
            backgroundImage: `radial-gradient(ellipse 80% 70% at 88% 0%, ${withAlpha(base, 0.55)} 0%, ${withAlpha(base, 0)} 70%), radial-gradient(ellipse 60% 60% at 0% 100%, ${withAlpha(base, 0.2)} 0%, ${withAlpha(base, 0)} 70%)`,
          }}
        />
      )}
      <div style={{ position: "absolute", left: 72, right: 72, bottom: SINGLE_CANVAS.height - (printTop - 44), display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ ...clamp(target, 2), fontFamily: headingFont(target), fontWeight: 600, fontSize: nameSize(event.name, NAME_STEPS.poster), lineHeight: 1.02, letterSpacing: "-0.015em", color: WHITE }}>
          {event.name}
        </div>
        <MetaRow
          date={event.date}
          hashtag={event.hashtag}
          size={30}
          square={null}
          squareColor={base}
          dateColor="rgba(255,255,255,.82)"
          hashtagColor={theme.accent.onDark}
          gap={18}
        />
      </div>
      <div style={{ position: "absolute", top: printTop, left: 0, width: SINGLE_CANVAS.width, display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
        <div style={{ display: "flex", padding: 14, background: WHITE, borderRadius: 10, boxShadow: "0 30px 60px rgba(20,20,20,.28),0 6px 14px rgba(20,20,20,.14)" }}>
          <Img src={photo.src} width={win.width} height={win.height} style={{ borderRadius: 3 }} />
        </div>
        {message && (
          <div style={{ ...clamp(target, 2), maxWidth: 820, fontWeight: 500, fontSize: 32, lineHeight: 1.3, color: ON_TINT, textAlign: "center" }}>
            {quoted(message)}
          </div>
        )}
      </div>
      <Lockup height={30} colors={ON_LIGHT} style={{ position: "absolute", right: 72, bottom: 56 }} />
    </Canvas>
  );
}

// ----------------------------------------------------------------------------------- Journal

function Journal({ input, target }: Props) {
  const { event, theme, photo, message } = input;
  const win = singlePhotoWindow("journal", photo.width, photo.height);
  const portrait = isPortraitLayout("journal", photo.width, photo.height);
  const plate = THEME_IMAGE_BOXES.journal!;
  const accentInk = theme.accent.ink;
  const heading = headingFont(target);

  const sideBlock = message ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", fontFamily: heading, fontWeight: 600, fontSize: 120, lineHeight: 0.8, height: 70, color: accentInk }}>“</div>
      <div style={{ ...clamp(target, 8), fontFamily: heading, fontWeight: 600, fontSize: 38, lineHeight: 1.18, color: INK }}>{message}</div>
    </div>
  ) : event.date ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", fontFamily: heading, fontWeight: 600, fontSize: 176, lineHeight: 0.9, letterSpacing: "-0.03em", color: accentInk }}>{event.date.day}</div>
      <div style={{ display: "flex", fontWeight: 700, fontSize: 30, lineHeight: 1.2, color: INK }}>{event.date.monthYear}</div>
      <div style={{ display: "flex", fontWeight: 500, fontSize: 26, lineHeight: 1.2, color: MUTED }}>{event.date.weekday}</div>
    </div>
  ) : null;

  const footBlock = message ? (
    <div style={{ display: "flex", flexDirection: "row", gap: 20, alignItems: "flex-start" }}>
      <div style={{ display: "flex", width: 56, flexShrink: 0, fontFamily: heading, fontWeight: 600, fontSize: 100, lineHeight: 0.8, color: accentInk }}>“</div>
      <div style={{ ...clamp(target, 3), flexGrow: 1, flexShrink: 1, minWidth: 0, fontFamily: heading, fontWeight: 600, fontSize: 42, lineHeight: 1.18, color: INK }}>{message}</div>
    </div>
  ) : event.date ? (
    <div style={{ display: "flex", flexDirection: "row", gap: 22, alignItems: "baseline" }}>
      <span style={{ display: "flex", fontFamily: heading, fontWeight: 600, fontSize: 96, lineHeight: 1, color: accentInk }}>{event.date.day}</span>
      <span style={{ display: "flex", fontWeight: 700, fontSize: 30, lineHeight: 1.2, color: INK }}>{event.date.monthYear}</span>
      <span style={{ display: "flex", fontWeight: 500, fontSize: 26, lineHeight: 1.2, color: MUTED }}>{event.date.weekday}</span>
    </div>
  ) : null;

  return (
    <Canvas background={WHITE} target={target}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 72 }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 28 }}>
          {theme.image && <Img src={theme.image.src} width={plate.width} height={plate.height} focus={plate.focus} style={{ borderRadius: 8 }} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
            <div style={{ ...clamp(target, 2), fontFamily: heading, fontWeight: 600, fontSize: nameSize(event.name, NAME_STEPS.journal), lineHeight: 1.08, letterSpacing: "-0.01em", color: INK }}>
              {event.name}
            </div>
            <MetaRow
              date={event.date}
              hashtag={event.hashtag}
              size={26}
              square={null}
              squareColor={theme.accent.base}
              dateColor={MUTED}
              hashtagColor={accentInk}
              gap={14}
            />
          </div>
        </div>
        <div style={{ display: "flex", height: 3, background: INK, margin: "36px 0 40px", flexShrink: 0 }} />
        {portrait ? (
          <div style={{ display: "flex", flexDirection: "row", gap: 40, alignItems: "flex-end" }}>
            <Img src={photo.src} width={win.width} height={win.height} style={{ borderRadius: 4 }} />
            <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0, paddingBottom: 8 }}>{sideBlock}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "space-between", paddingBottom: 84 }}>
            <Img src={photo.src} width={win.width} height={win.height} style={{ borderRadius: 4 }} />
            {footBlock}
          </div>
        )}
      </div>
      <Lockup height={30} colors={ON_LIGHT} style={{ position: "absolute", right: 72, bottom: 60 }} />
    </Canvas>
  );
}

// ------------------------------------------------------------------------------------- Album

function Album({ input, target }: Props) {
  const { event, theme, photo, message } = input;
  const win = singlePhotoWindow("album", photo.width, photo.height);
  const texture = THEME_IMAGE_BOXES.album!;
  const cardOffset = Math.max(0, Math.min(win.width - 420, 360));
  return (
    <Canvas background={theme.accent.tint} target={target}>
      {theme.image && (
        <Img src={theme.image.src} width={texture.width} height={texture.height} focus={texture.focus} style={{ position: "absolute", top: 0, left: 0, opacity: 0.12 }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -40 }}>
          <div style={{ display: "flex", padding: "26px 26px 30px", background: WHITE, transform: "rotate(-2.5deg)", boxShadow: "0 2px 3px rgba(20,20,20,.10),0 26px 50px rgba(20,20,20,.20)" }}>
            <Img src={photo.src} width={win.width} height={win.height} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 560, marginTop: -34, marginLeft: cardOffset, padding: "30px 34px", background: WHITE, borderRadius: 10, transform: "rotate(1.6deg)", boxShadow: "0 12px 30px rgba(20,20,20,.16)" }}>
            {message && (
              <div style={{ ...clamp(target, 2), fontWeight: 600, fontSize: 32, lineHeight: 1.25, color: INK }}>{quoted(message)}</div>
            )}
            <div style={{ ...clamp(target, 2), fontFamily: headingFont(target), fontWeight: 600, fontSize: nameSize(event.name, message ? NAME_STEPS.albumMessage : NAME_STEPS.album), lineHeight: 1.08, color: INK }}>
              {event.name}
            </div>
            <MetaRow
              date={event.date}
              hashtag={event.hashtag}
              size={24}
              square={12}
              squareColor={theme.accent.base}
              dateColor={MUTED}
              hashtagColor={theme.accent.ink}
              gap={12}
              wrap
            />
          </div>
        </div>
      </div>
      <Lockup height={30} colors={ON_LIGHT} style={{ position: "absolute", right: 72, bottom: 56 }} />
    </Canvas>
  );
}
