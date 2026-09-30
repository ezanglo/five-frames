"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { accentCssVars } from "@/lib/theme/accents";
import type { LookPreviewState } from "@/lib/theme/preview";
import {
  FULL_SET_STYLES,
  PRESELECTED_FULL_SET_STYLE,
  PRESELECTED_SINGLE_STYLE,
  SINGLE_STYLES,
  type KeepsakeFamily,
  type KeepsakeStyleMeta,
} from "@/lib/keepsakes/styles";
import { cn } from "@/lib/utils";
import { FitCanvas } from "./fit-canvas";
import { GuestPhonePreview } from "./guest-phone-preview";
import {
  FULL_SET_CANVAS,
  PRINT_CANVAS,
  PrintKeepsakePreview,
  SIGNAGE_FORMATS,
  SignagePreview,
  SignatureKeepsakePreview,
  type OutputPreviewContent,
  type SignageFormat,
} from "./output-previews";
import { SegmentedTabs, tabPanelProps } from "./segmented-tabs";

export type LookPreviewProps = {
  eventId: string;
  state: LookPreviewState;
  sharingEnabled: boolean;
  activated: boolean;
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

function contentOf(state: LookPreviewState): OutputPreviewContent {
  return {
    name: state.name,
    dateLabel: state.dateLabel,
    hashtag: state.hashtag,
    imageUrl: state.imageUrl,
  };
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
  state,
  sharingEnabled,
  activated,
  className,
}: LookPreviewProps & { className?: string }) {
  const idBase = useId();
  const [tab, setTab] = useState<StageTab>("overview");
  const content = contentOf(state);

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
                    <FitCanvas {...FULL_SET_CANVAS}>
                      <SignatureKeepsakePreview content={content} />
                    </FitCanvas>
                  </div>
                  <div className="w-full -rotate-[1.2deg] shadow-[0_18px_36px_rgb(21_20_26/0.16)] xl:absolute xl:bottom-[-18px] xl:left-0 xl:w-[62%]">
                    <FitCanvas {...PRINT_CANVAS}>
                      <PrintKeepsakePreview content={content} />
                    </FitCanvas>
                  </div>
                </div>
                <ObjectLabel>Keepsakes</ObjectLabel>
              </div>
              <div className="hidden w-[34%] max-w-[320px] min-w-0 flex-col gap-4 xl:flex">
                <div className="shadow-[0_18px_36px_rgb(21_20_26/0.16)]">
                  <FitCanvas width={700} height={500}>
                    <SignagePreview format="table-card" content={content} />
                  </FitCanvas>
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
          {tab === "keepsakes" && <KeepsakesPanel content={content} sharingEnabled={sharingEnabled} large />}
          {tab === "signage" && <SignagePanel content={content} activated={activated} large />}
        </div>
      </div>
    </section>
  );
}

function LookMobilePreview({ eventId, state, sharingEnabled, activated }: LookPreviewProps) {
  const idBase = useId();
  const [tab, setTab] = useState<Exclude<StageTab, "overview">>("guest");
  const content = contentOf(state);

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
          {tab === "keepsakes" && <KeepsakesPanel content={content} sharingEnabled={sharingEnabled} />}
          {tab === "signage" && <SignagePanel content={content} activated={activated} />}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function StyleRow({ style, family }: { style: KeepsakeStyleMeta; family: KeepsakeFamily }) {
  const preselected =
    style.id === (family === "single" ? PRESELECTED_SINGLE_STYLE : PRESELECTED_FULL_SET_STYLE);
  return (
    <li
      className={cn(
        "flex flex-col gap-1 rounded-xl border px-4 py-3",
        preselected ? "border-brand bg-brand-tint" : "border-transparent bg-surface",
      )}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-label font-bold text-ink">
        {style.label}
        {preselected && <span className="text-caption font-semibold text-brand-ink">guests start here</span>}
      </p>
      <p className="text-caption font-medium text-ink-muted">{style.line}</p>
      {family === "fullSet" && (
        <p className="flex gap-3 text-micro font-semibold text-ink-muted">
          <span className={cn(!style.uses.image && "line-through opacity-60")}>
            <span className="sr-only">{style.uses.image ? "Uses the" : "Doesn’t use the"} </span>
            Image
          </span>
          <span>Color</span>
          <span className={cn(!style.uses.hashtag && "line-through opacity-60")}>Hashtag</span>
        </p>
      )}
    </li>
  );
}

/**
 * Keepsakes: the two families, never one list of ten (product.md §10.2). The family's
 * preselected style is shown large; the list names all five that guests choose between. Hosts
 * preview; only guests ever make a keepsake.
 */
function KeepsakesPanel({
  content,
  sharingEnabled,
  large,
}: {
  content: OutputPreviewContent;
  sharingEnabled: boolean;
  large?: boolean;
}) {
  const idBase = useId();
  const [family, setFamily] = useState<KeepsakeFamily>("single");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const styles = family === "single" ? SINGLE_STYLES : FULL_SET_STYLES;
  const preview =
    family === "single" ? (
      <FitCanvas {...PRINT_CANVAS}>
        <PrintKeepsakePreview content={content} orientation={orientation} />
      </FitCanvas>
    ) : (
      <FitCanvas {...FULL_SET_CANVAS}>
        <SignatureKeepsakePreview content={content} />
      </FitCanvas>
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
        {family === "single" && large && (
          <SegmentedTabs
            idBase={`${idBase}-o`}
            label="Sample photo"
            size="sm"
            value={orientation}
            onChange={setOrientation}
            tabs={[
              { id: "portrait", label: "Portrait photo" },
              { id: "landscape", label: "Landscape photo" },
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
          <ul className="flex flex-col gap-2">
            {(large ? styles : styles.slice(0, 1)).map((style) => (
              <StyleRow key={style.id} style={style} family={family} />
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

/**
 * Signage: the four formats with the placeholder plate. The real renderer, the live QR once
 * activated and downloads from here arrive with themed signage (Slice 17); until then the
 * printable files stay on the dashboard.
 */
function SignagePanel({
  content,
  activated,
  large,
}: {
  content: OutputPreviewContent;
  activated: boolean;
  large?: boolean;
}) {
  const idBase = useId();
  const [format, setFormat] = useState<SignageFormat>("table-card");
  const spec = SIGNAGE_FORMATS.find((f) => f.id === format)!;
  const portrait = spec.height > spec.width;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          idBase={idBase}
          label="Signage format"
          size="sm"
          value={format}
          onChange={setFormat}
          tabs={SIGNAGE_FORMATS.map((f) => ({ id: f.id, label: f.label }))}
        />
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-3 text-micro font-bold tracking-[0.06em] text-ink uppercase">
          <Lock className="size-3 text-warning" aria-hidden />
          {activated ? "Preview · placeholder QR" : "Draft preview · placeholder QR"}
        </span>
      </div>
      <div
        {...tabPanelProps(idBase, format)}
        className="flex flex-1 flex-col items-center justify-center gap-4"
      >
        <div
          className={cn(
            "shadow-[0_18px_36px_rgb(21_20_26/0.14)]",
            portrait ? (large ? "w-[min(100%,320px)]" : "w-[62%]") : large ? "w-[min(100%,560px)]" : "w-full",
          )}
        >
          <FitCanvas width={spec.width} height={spec.height}>
            <SignagePreview format={format} content={content} />
          </FitCanvas>
        </div>
        <div className="flex w-full flex-col gap-1 text-center text-caption font-medium text-ink-muted">
          <p>
            <span className="font-semibold text-ink">{spec.label}</span> · {spec.size}. {spec.use}
          </p>
          <p>
            {activated
              ? "The code here is a placeholder. Your printable signage is on your dashboard."
              : "The code here is a placeholder. Your real QR and downloads arrive when you activate."}
          </p>
        </div>
      </div>
    </div>
  );
}
