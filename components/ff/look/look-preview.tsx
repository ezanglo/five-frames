"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { KeepsakePreview } from "@/components/ff/keepsakes/keepsake-preview";
import {
  buildFullSetKeepsakeInput,
  buildKeepsakeContext,
  buildSingleKeepsakeInput,
  type KeepsakeContext,
} from "@/lib/keepsakes/context";
import { FULL_SET_SAMPLES, SAMPLE_MESSAGE, SINGLE_SAMPLES } from "@/lib/keepsakes/samples";
import { accentCssVars } from "@/lib/theme/accents";
import type { LookPreviewState } from "@/lib/theme/preview";
import {
  FULL_SET_STYLES,
  PRESELECTED_FULL_SET_STYLE,
  PRESELECTED_SINGLE_STYLE,
  SINGLE_STYLES,
  type KeepsakeFamily,
  type FullSetStyleId,
  type KeepsakeStyleId,
  type KeepsakeStyleMeta,
  type SingleStyleId,
} from "@/lib/keepsakes/styles";
import { cn } from "@/lib/utils";
import { GuestPhonePreview } from "./guest-phone-preview";
import { SegmentedTabs, tabPanelProps } from "./segmented-tabs";
import { SignageImage, SignagePanel, themeImageKey, type SignageLook } from "./signage-preview";

export type LookPreviewProps = {
  eventId: string;
  /** The raw `event_date`; the keepsake templates format it themselves. */
  eventDate: string | null;
  state: LookPreviewState;
  sharingEnabled: boolean;
  activated: boolean;
  /** Activated with a current capture link: signage shows and downloads the real QR. */
  liveCode: boolean;
  /** Unsaved color/hashtag changes: signage downloads wait for Save (they use the saved look). */
  dirty: boolean;
  /** Open on this tab (e.g. the Share step's "Look → Signage" link). */
  initialTab?: "signage";
};

type StageTab = "overview" | "guest" | "keepsakes" | "signage";

const DESKTOP_QUERY = "(min-width: 1024px)";

/** Which preview composition to mount: only one, so only one guest frame ever loads. */
function useIsDesktop(): boolean | null {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

function signageLookOf(eventId: string, state: LookPreviewState): SignageLook {
  return { eventId, accent: state.accent, hashtag: state.hashtag, imageKey: themeImageKey(state.imageUrl) };
}

/**
 * The keepsake templates' context from the host's live, unsaved Look state: the same closed
 * context a guest's keepsake gets, on sample photos, with the host's signed theme image URL.
 */
function keepsakeContextOf(state: LookPreviewState, eventDate: string | null): KeepsakeContext {
  return buildKeepsakeContext(
    { name: state.name, event_date: eventDate, hashtag: state.hashtag, accent_color: state.accent },
    state.imageUrl ? { src: state.imageUrl } : null,
  );
}

function SinglePreview({
  context,
  style,
  orientation = "portrait",
}: {
  context: KeepsakeContext;
  style: SingleStyleId;
  orientation?: "portrait" | "landscape";
}) {
  return (
    <KeepsakePreview
      family="single"
      input={buildSingleKeepsakeInput(context, style, SINGLE_SAMPLES[orientation], SAMPLE_MESSAGE)}
    />
  );
}

function FullSetPreview({ context, style }: { context: KeepsakeContext; style: FullSetStyleId }) {
  return <KeepsakePreview family="fullSet" input={buildFullSetKeepsakeInput(context, style, FULL_SET_SAMPLES)} />;
}

function themeScope(state: LookPreviewState) {
  return {
    className: "ff-event-theme",
    style: accentCssVars(state.accent) as CSSProperties,
  };
}

/**
 * The Look studio's preview (design-direction "Host · Look studio"). ≥ 1024: a sticky white stage
 * with Overview · Guest screens · Keepsakes · Signage over the soft "table" surface. Below 1024:
 * the "See it everywhere" section with Guest · Keepsakes · Signage and one large preview.
 * Everything is drawn from the host's live, unsaved Look state; nothing here is downloadable.
 */
export function LookPreview(props: LookPreviewProps & { className?: string }) {
  const desktop = useIsDesktop();
  if (desktop === null) return <div className={cn("min-h-[480px]", props.className)} aria-hidden />;
  return desktop ? <LookStage {...props} /> : <LookMobilePreview {...props} />;
}

function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("flex shrink-0", className)} data-live>
      <span className="flex shrink-0 items-center gap-1.5 text-caption font-semibold whitespace-nowrap text-success">
        <span aria-hidden className="size-2 rounded-full bg-success" />
        Live preview
      </span>
    </span>
  );
}

function ObjectLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-micro font-bold tracking-[0.1em] text-ink-muted uppercase">{children}</p>
  );
}

function LookStage({
  eventId,
  eventDate,
  state,
  sharingEnabled,
  activated,
  liveCode,
  dirty,
  initialTab,
  className,
}: LookPreviewProps & { className?: string }) {
  const idBase = useId();
  const [tab, setTab] = useState<StageTab>(initialTab ?? "overview");
  const signage = signageLookOf(eventId, state);
  const keepsakeContext = keepsakeContextOf(state, eventDate);

  return (
    <section
      aria-label="Preview"
      className={cn("flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5", className)}
    >
      <div className="flex items-center justify-between gap-4">
        <SegmentedTabs
          idBase={idBase}
          label="Preview"
          size="responsive"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "guest", label: "Guest screens" },
            { id: "keepsakes", label: "Keepsakes" },
            { id: "signage", label: "Signage" },
          ]}
        />
        <LiveDot className="hidden xl:flex" />
      </div>
      <div
        {...themeScope(state)}
        className={cn(themeScope(state).className, "rounded-2xl bg-surface-stage p-6 xl:p-8")}
      >
        <div {...tabPanelProps(idBase, tab)} className="flex h-full min-h-[460px] flex-col">
          {tab === "overview" && (
            <div className="flex flex-1 items-center justify-center gap-[6%] xl:gap-[4%]">
              <div className="flex w-[38%] max-w-[250px] min-w-0 flex-col gap-4 xl:w-[27%]">
                <GuestPhonePreview eventId={eventId} state={state} />
                <ObjectLabel>Guest screens</ObjectLabel>
              </div>
              <div className="flex w-[44%] max-w-[300px] min-w-0 flex-col gap-4 xl:w-[31%]">
                <div className="relative">
                  <div className="hidden w-[78%] rotate-[1.5deg] shadow-[0_18px_36px_rgb(21_20_26/0.16)] xl:ml-auto xl:block">
                    <FullSetPreview context={keepsakeContext} style={PRESELECTED_FULL_SET_STYLE} />
                  </div>
                  <div className="w-full -rotate-[1.2deg] shadow-[0_18px_36px_rgb(21_20_26/0.16)] xl:absolute xl:bottom-[-18px] xl:left-0 xl:w-[62%]">
                    <SinglePreview context={keepsakeContext} style={PRESELECTED_SINGLE_STYLE} />
                  </div>
                </div>
                <ObjectLabel>Keepsakes</ObjectLabel>
              </div>
              <div className="hidden w-[34%] max-w-[320px] min-w-0 flex-col gap-4 xl:flex">
                <div className="shadow-[0_18px_36px_rgb(21_20_26/0.16)]">
                  <SignageImage look={signage} format="table-card" />
                </div>
                <ObjectLabel>Signage</ObjectLabel>
              </div>
            </div>
          )}
          {tab === "guest" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <GuestPhonePreview eventId={eventId} state={state} className="w-[300px]" />
              <ObjectLabel>Join</ObjectLabel>
            </div>
          )}
          {tab === "keepsakes" && (
            <KeepsakesPanel context={keepsakeContext} sharingEnabled={sharingEnabled} large />
          )}
          {tab === "signage" && (
            <SignagePanel look={signage} activated={activated} liveCode={liveCode} dirty={dirty} large />
          )}
        </div>
      </div>
    </section>
  );
}

function LookMobilePreview({
  eventId,
  eventDate,
  state,
  sharingEnabled,
  activated,
  liveCode,
  dirty,
  initialTab,
}: LookPreviewProps) {
  const idBase = useId();
  const [tab, setTab] = useState<Exclude<StageTab, "overview">>(initialTab ?? "guest");
  const signage = signageLookOf(eventId, state);
  const keepsakeContext = keepsakeContextOf(state, eventDate);

  return (
    <section aria-labelledby={`${idBase}-heading`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-micro font-bold tracking-[0.1em] text-ink-muted uppercase">Preview</p>
        <h2 id={`${idBase}-heading`} className="font-heading text-title font-semibold text-ink">
          See it everywhere
        </h2>
        <p className="text-caption font-medium text-ink-muted">Sample photos. Updates as you choose.</p>
      </div>
      <SegmentedTabs
        idBase={idBase}
        label="Preview"
        value={tab}
        onChange={setTab}
        className="w-full"
        tabs={[
          { id: "guest", label: "Guest" },
          { id: "keepsakes", label: "Keepsakes" },
          { id: "signage", label: "Signage" },
        ]}
      />
      <div
        {...themeScope(state)}
        className={cn(themeScope(state).className, "rounded-2xl bg-surface-stage p-5")}
      >
        <div {...tabPanelProps(idBase, tab)} className="flex min-h-[420px] flex-col">
          {tab === "guest" && (
            <div className="flex flex-1 items-center justify-center">
              <GuestPhonePreview eventId={eventId} state={state} className="w-[236px]" />
            </div>
          )}
          {tab === "keepsakes" && (
            <KeepsakesPanel context={keepsakeContext} sharingEnabled={sharingEnabled} />
          )}
          {tab === "signage" && (
            <SignagePanel look={signage} activated={activated} liveCode={liveCode} dirty={dirty} />
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function StyleRow({
  style,
  family,
  selected,
  onSelect,
}: {
  style: KeepsakeStyleMeta;
  family: KeepsakeFamily;
  selected: boolean;
  onSelect?: () => void;
}) {
  const preselected =
    style.id === (family === "single" ? PRESELECTED_SINGLE_STYLE : PRESELECTED_FULL_SET_STYLE);
  const body = (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 text-label font-bold text-ink">
        {style.label}
        {preselected && <span className="text-caption font-semibold text-brand-ink">guests start here</span>}
      </span>
      <span className="text-caption font-medium text-ink-muted">{style.line}</span>
      {family === "fullSet" && (
        <span className="flex gap-3 text-micro font-semibold text-ink-muted">
          <span className={cn(!style.uses.image && "line-through opacity-60")}>
            <span className="sr-only">{style.uses.image ? "Uses the" : "Doesn’t use the"} </span>
            Image
          </span>
          <span>Color</span>
          <span className={cn(!style.uses.hashtag && "line-through opacity-60")}>Hashtag</span>
        </span>
      )}
    </>
  );
  const frame = cn(
    "flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left",
    selected ? "border-brand bg-brand-tint" : "border-transparent bg-surface",
  );
  if (!onSelect) return <li className={frame}>{body}</li>;
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(frame, "ff-focus relative min-h-11 pr-10", !selected && "hover:border-line")}
      >
        {body}
        {selected && <Check className="absolute top-3.5 right-3.5 size-4 text-brand-ink" aria-hidden />}
      </button>
    </li>
  );
}

/**
 * Keepsakes: the two families, never one list of ten (product.md §10.2). Each family's styles are
 * the real keepsake templates on sample photos with the live theme; the host picks one to see it
 * large. Hosts preview; only guests ever make a keepsake — there is no make or download action.
 */
function KeepsakesPanel({
  context,
  sharingEnabled,
  large,
}: {
  context: KeepsakeContext;
  sharingEnabled: boolean;
  large?: boolean;
}) {
  const idBase = useId();
  const [family, setFamily] = useState<KeepsakeFamily>("single");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [singleStyle, setSingleStyle] = useState<SingleStyleId>(PRESELECTED_SINGLE_STYLE);
  const [fullSetStyle, setFullSetStyle] = useState<FullSetStyleId>(PRESELECTED_FULL_SET_STYLE);
  const styles = family === "single" ? SINGLE_STYLES : FULL_SET_STYLES;
  const selected: KeepsakeStyleId = family === "single" ? singleStyle : fullSetStyle;
  const select = (id: KeepsakeStyleId) =>
    family === "single" ? setSingleStyle(id as SingleStyleId) : setFullSetStyle(id as FullSetStyleId);
  const preview =
    family === "single" ? (
      <SinglePreview context={context} style={singleStyle} orientation={orientation} />
    ) : (
      <FullSetPreview context={context} style={fullSetStyle} />
    );

  return (
    <div className="relative flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          idBase={idBase}
          label="Keepsake family"
          size="sm"
          value={family}
          onChange={setFamily}
          tabs={[
            { id: "single", label: "One photo" },
            { id: "fullSet", label: "All five" },
          ]}
        />
        {family === "single" && (
          <SegmentedTabs
            idBase={`${idBase}-o`}
            label="Sample photo"
            size="sm"
            value={orientation}
            onChange={setOrientation}
            tabs={[
              { id: "portrait", label: large ? "Portrait photo" : "Portrait" },
              { id: "landscape", label: large ? "Landscape photo" : "Landscape" },
            ]}
          />
        )}
      </div>
      <div
        {...tabPanelProps(idBase, family)}
        className={cn(
          "flex flex-1 gap-6",
          large ? "flex-row items-start" : "flex-col",
          !sharingEnabled && "opacity-40",
        )}
      >
        <div
          className={cn(
            "shrink-0 shadow-[0_18px_36px_rgb(21_20_26/0.14)]",
            large ? "w-[46%] max-w-[340px]" : "mx-auto w-[74%]",
          )}
        >
          {preview}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <ul aria-label="Keepsake styles" className="flex flex-col gap-2">
            {(large ? styles : styles.slice(0, 1)).map((style) => (
              <StyleRow
                key={style.id}
                style={style}
                family={family}
                selected={style.id === selected}
                onSelect={large ? () => select(style.id as KeepsakeStyleId) : undefined}
              />
            ))}
          </ul>
          <p className="text-caption font-medium text-ink-muted">
            {family === "single"
              ? "Guests pick one of these five when they share or save a photo. Sample photos — guests see their own."
              : "Guests who keep all five photos can also make one keepsake of all five. You preview the styles here; only guests make their own."}
          </p>
        </div>
      </div>
      {!sharingEnabled && (
        <p className="absolute inset-x-0 top-1/2 mx-auto flex w-fit -translate-y-1/2 items-center gap-2 rounded-full bg-surface px-4 py-2 text-label font-semibold text-ink shadow-card">
          <Lock className="size-4" aria-hidden />
          Guests won’t see these until you turn them on
        </p>
      )}
    </div>
  );
}
