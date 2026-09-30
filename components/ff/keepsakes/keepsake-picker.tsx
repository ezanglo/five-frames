"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Download, Info, RefreshCw, Share, X } from "lucide-react";
import { Button, ButtonAnchor } from "@/components/ff/button";
import { SegmentedTabs, tabPanelProps } from "@/components/ff/look/segmented-tabs";
import { accentCssVars, type AccentKey } from "@/lib/theme/accents";
import {
  buildFullSetKeepsakeInput,
  buildSingleKeepsakeInput,
  type KeepsakeContext,
} from "@/lib/keepsakes/context";
import { keepsakeFilename } from "@/lib/keepsakes/filename";
import {
  preselectedStyle,
  stylesForFamily,
  type KeepsakeFamily,
  type KeepsakeStyleId,
  type KeepsakeStyleMeta,
  type FullSetStyleId,
  type SingleStyleId,
} from "@/lib/keepsakes/styles";
import { browserShareCapability, canShareImageFiles, shareFile } from "@/lib/share/web-share";
import { cn } from "@/lib/utils";
import { KeepsakePreview, useImageSize } from "./keepsake-preview";

/**
 * "Make a keepsake" (design-direction → "Guest keepsake flow"; board §07/§08, §15/§16). One
 * screen, one choice: the family's five styles previewed on the guest's own photo(s) by the real
 * templates in the DOM, with the family's default preselected.
 *
 * Bytes before the tap (architecture §7b): the selected style's JPEG is fetched when it is
 * selected (including the preselected one on open); a new selection aborts the previous fetch.
 * Share hands the bytes already held to `navigator.share` inside the tap. Save is always a plain
 * `?download=1` navigation, which in-app browsers handle. Prepared bytes live only in this
 * component's memory and are dropped when it closes.
 */

export type PickerPhoto = {
  id: string;
  /** The display derivative (stage) and thumbnail derivative (style thumbnails). */
  displayUrl: string;
  thumbnailUrl: string;
  message: string | null;
  downloadUrl: string | null;
};

type Prep =
  | { status: "preparing"; key: string }
  | { status: "ready"; key: string; file: File }
  | { status: "failed"; key: string };

type Note = "saved" | "fullSetGone" | null;

export function KeepsakePicker({
  token,
  eventName,
  accent,
  context,
  initialFamily,
  photo,
  fullSetPhotos,
  onClose,
}: {
  token: string;
  eventName: string;
  accent: AccentKey;
  /** Preview context: the event's name/date/hashtag/accent and the signed theme image URL. */
  context: KeepsakeContext;
  initialFamily: KeepsakeFamily;
  /** The photo for "One photo". */
  photo: PickerPhoto;
  /** The session's five, in server (canonical) order, only while the Full Set is available. */
  fullSetPhotos: readonly PickerPhoto[] | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const idBase = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [fullSetOpen, setFullSetOpen] = useState(Boolean(fullSetPhotos && fullSetPhotos.length === 5));
  const [family, setFamily] = useState<KeepsakeFamily>(
    initialFamily === "fullSet" && fullSetOpen ? "fullSet" : "single",
  );
  const [style, setStyle] = useState<KeepsakeStyleId>(preselectedStyle(family));
  const [prep, setPrep] = useState<Prep | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState<Note>(null);
  // Rendered only in the browser (it opens on a tap), so the capability can be read up front.
  const [canShare, setCanShare] = useState<boolean>(() => canShareImageFiles(browserShareCapability()));
  const size = useImageSize(photo.displayUrl);

  const routeFor = useCallback(
    (f: KeepsakeFamily, s: KeepsakeStyleId) =>
      f === "single"
        ? `/e/${encodeURIComponent(token)}/keepsake/photo/${encodeURIComponent(photo.id)}/${s}`
        : `/e/${encodeURIComponent(token)}/keepsake/set/${s}`,
    [token, photo.id],
  );
  const key = `${family}:${style}:${photo.id}`;

  // Focus, Escape and scroll lock, as the photo viewer does.
  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prepare the selected style only; a newer selection aborts the older fetch.
  useEffect(() => {
    const controller = new AbortController();
    fetch(routeFor(family, style), { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], keepsakeFilename(eventName, style), { type: "image/jpeg" });
          setPrep({ status: "ready", key, file });
          return;
        }
        if (response.status === 404 && family === "fullSet") {
          // The five are no longer all available (never explained, product.md §10.2.2).
          setFullSetOpen(false);
          if (initialFamily === "fullSet") {
            onClose();
            router.refresh();
            return;
          }
          setNote("fullSetGone");
          setFamily("single");
          setStyle(preselectedStyle("single"));
          return;
        }
        if (response.status === 404 || response.status === 403) {
          // The photo or sharing went away while the picker was open: back to the page's truth.
          onClose();
          router.refresh();
          return;
        }
        setPrep({ status: "failed", key });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn("keepsake: prepare failed", error);
        setPrep({ status: "failed", key });
      });
    return () => controller.abort();
    // `attempt` re-runs the same selection for Try again.
  }, [key, family, style, attempt, eventName, routeFor, initialFamily, onClose, router]);

  const current = prep && prep.key === key ? prep : { status: "preparing" as const, key };
  const shareBlocked = !canShare;

  function select(next: KeepsakeStyleId) {
    if (next === style) return;
    setNote(null);
    setStyle(next);
  }

  function switchFamily(next: KeepsakeFamily) {
    if (next === family) return;
    setNote(null);
    setFamily(next);
    setStyle(preselectedStyle(next));
  }

  function onShare() {
    if (current.status !== "ready") return;
    // No await before this call: the share sheet must open inside the tap.
    void shareFile(current.file, eventName, browserShareCapability()).then((result) => {
      if (result === "failed") setCanShare(false);
      // "cancelled" is silent; "shared" is confirmed by the OS itself.
    });
  }

  const saveHref = `${routeFor(family, style)}?download=1`;
  const styles = stylesForFamily(family);
  const fivePhotos = family === "fullSet" && fullSetPhotos ? fullSetPhotos : null;

  const preview = (fit: "width" | "contain", source: "display" | "thumbnail", s: KeepsakeStyleId, className?: string) => {
    if (family === "single") {
      if (!size) return <div className={cn("bg-surface-subtle", className)} style={{ aspectRatio: "4 / 5" }} />;
      const src = source === "display" ? photo.displayUrl : photo.thumbnailUrl;
      return (
        <KeepsakePreview
          fit={fit}
          className={className}
          canvasClassName="shadow-[0_1px_2px_rgb(20_20_20/0.06),0_12px_30px_rgb(20_20_20/0.12)]"
          family="single"
          input={buildSingleKeepsakeInput(context, s as SingleStyleId, { src, ...size }, photo.message)}
        />
      );
    }
    const five = fivePhotos!.map((p) => ({ src: source === "display" ? p.displayUrl : p.thumbnailUrl }));
    return (
      <KeepsakePreview
        fit={fit}
        className={className}
        canvasClassName="shadow-[0_1px_2px_rgb(20_20_20/0.06),0_12px_30px_rgb(20_20_20/0.12)]"
        family="fullSet"
        input={buildFullSetKeepsakeInput(context, s as FullSetStyleId, five)}
      />
    );
  };

  const subtitle =
    family === "single"
      ? "A new image made from your photo. Your original stays exactly as you took it."
      : "One new image made from your five photos. Your originals stay exactly as you took them.";

  const statusText =
    note === "fullSetGone"
      ? "Your five together isn’t available right now."
      : note === "saved"
        ? "Saved. Look in your downloads or Photos."
        : current.status === "failed"
          ? "We couldn’t get this keepsake ready. Your photo is safe. Check your connection and try again."
          : shareBlocked
            ? "This browser can’t open the share menu, so the keepsake saves to your phone."
            : current.status === "preparing"
              ? "Getting it ready…"
              : "Ready to share.";

  const familySwitch = fullSetOpen && (
    <SegmentedTabs
      idBase={idBase}
      label="Keepsake of"
      size="sm"
      value={family}
      onChange={switchFamily}
      className="w-full"
      tabs={[
        { id: "single", label: "One photo" },
        { id: "fullSet", label: "Your five" },
      ]}
    />
  );

  const actions = (
    <div className="flex flex-col gap-2">
      <p
        role={current.status === "failed" ? "alert" : "status"}
        aria-live="polite"
        className={cn(
          "flex min-h-5 items-start justify-center gap-1.5 text-center text-caption font-medium lg:justify-start lg:text-left",
          note === "saved" ? "text-success" : "text-ink-muted",
          current.status === "failed" && !note && "rounded-lg bg-surface-subtle px-3 py-2 text-ink",
          current.status !== "failed" && !note && !shareBlocked && "sr-only",
        )}
      >
        {note === "saved" && <Check className="mt-0.5 size-4 shrink-0" aria-hidden />}
        {current.status === "failed" && !note && <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
        {statusText}
      </p>
      <div className="flex gap-3">
        {current.status === "failed" ? (
          <Button size="md" className="flex-1" onClick={() => {
              setPrep(null);
              setAttempt((n) => n + 1);
            }}>
            <RefreshCw aria-hidden />
            Try again
          </Button>
        ) : !shareBlocked ? (
          <Button
            size="md"
            className={cn(
              "flex-1",
              current.status === "preparing" &&
                "bg-brand-tint text-brand-ink shadow-none disabled:bg-brand-tint disabled:text-brand-ink",
            )}
            disabled={current.status !== "ready"}
            aria-disabled={current.status !== "ready"}
            onClick={onShare}
          >
            {current.status === "ready" ? <Share aria-hidden /> : <RefreshCw className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {current.status === "ready" ? "Share" : "Getting it ready…"}
          </Button>
        ) : null}
        <ButtonAnchor
          href={saveHref}
          variant={shareBlocked && current.status !== "failed" ? "primary" : "secondary"}
          size="md"
          className="flex-1"
          onClick={() => setTimeout(() => setNote("saved"), 400)}
        >
          <Download aria-hidden />
          {shareBlocked ? "Save keepsake" : "Save"}
        </ButtonAnchor>
      </div>
    </div>
  );

  const scope = { className: "ff-event-theme", style: accentCssVars(accent) as CSSProperties };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${idBase}-title`}
      {...scope}
      className={cn(
        scope.className,
        "fixed inset-0 z-[60] flex flex-col bg-surface text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px]",
        "animate-in fade-in duration-200 motion-reduce:animate-none",
      )}
    >
      {/* Stage: the selected keepsake as large as fits. */}
      <div className="relative hidden min-h-0 flex-col bg-surface-stage lg:flex">
        <div className="absolute top-6 left-6 z-10">
          <Button variant="secondary" size="sm" onClick={onClose} className="h-11 bg-surface shadow-card">
            <ChevronLeft aria-hidden />
            Back to your photos
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-16 py-[60px]">
          <div key={key} className="flex size-full animate-in fade-in duration-150 motion-reduce:animate-none">
            {preview("contain", "display", style, "size-full")}
          </div>
        </div>
      </div>

      {/* Panel (desktop) / whole screen (mobile). */}
      <div className="ff-safe-top ff-safe-bottom flex min-h-0 w-full flex-1 flex-col gap-4 px-4 pt-3 pb-4 md:max-lg:mx-auto md:max-lg:max-w-[600px] lg:gap-5 lg:overflow-y-auto lg:border-l lg:border-line lg:px-6 lg:py-8">
        <div className="relative flex items-center justify-center lg:justify-start">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ff-focus absolute left-0 flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-subtle lg:hidden"
          >
            <X className="size-5" />
          </button>
          <h2 id={`${idBase}-title`} className="text-label font-bold lg:font-heading lg:text-title lg:font-semibold">
            Make a keepsake
          </h2>
        </div>
        {familySwitch}
        <p className="-mt-1 text-center text-caption font-medium text-ink-muted lg:text-left">{subtitle}</p>

        <div {...(fullSetOpen ? tabPanelProps(idBase, family) : {})} className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Mobile stage. */}
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-surface-stage p-4 lg:hidden">
            <div key={key} className="flex size-full animate-in fade-in duration-150 motion-reduce:animate-none">
              {preview("contain", "display", style, "size-full")}
            </div>
          </div>

          <StylePicker
            label={family === "single" ? "Keepsake style" : "Keepsake style for your five"}
            styles={styles}
            family={family}
            value={style}
            onChange={select}
            renderThumb={(s) => preview("width", "thumbnail", s)}
          />
        </div>

        {actions}

        <OriginalsRow family={family} photo={photo} fivePhotos={fivePhotos} />
      </div>
    </div>
  );
}

/**
 * The five styles as one radiogroup: a row of real thumbnails with names on phones, a labelled
 * list (thumb, name, line, "· default") on desktop. Selection shows a ring, tint and check, never
 * color alone. Arrow keys move the selection.
 */
function StylePicker({
  label,
  styles,
  family,
  value,
  onChange,
  renderThumb,
}: {
  label: string;
  styles: readonly KeepsakeStyleMeta[];
  family: KeepsakeFamily;
  value: KeepsakeStyleId;
  onChange: (id: KeepsakeStyleId) => void;
  renderThumb: (id: KeepsakeStyleId) => ReactNode;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const defaultId = preselectedStyle(family);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = styles.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
      : null;
    if (next === null) return;
    event.preventDefault();
    onChange(styles[next].id as KeepsakeStyleId);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2 lg:flex lg:flex-col lg:gap-1.5">
      {styles.map((s, index) => {
        const selected = s.id === value;
        return (
          <button
            key={s.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${s.label}${s.id === defaultId ? ", default" : ""}. ${s.line}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(s.id as KeepsakeStyleId)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "ff-focus group flex min-h-11 min-w-0 flex-col items-center gap-1.5 rounded-lg p-1 text-center transition-colors lg:flex-row lg:items-center lg:gap-3 lg:rounded-xl lg:border lg:px-3 lg:py-2 lg:text-left",
              selected ? "lg:border-brand lg:bg-brand-tint lg:ring-[1.5px] lg:ring-brand" : "lg:border-transparent lg:hover:bg-surface-subtle",
            )}
          >
            <span
              className={cn(
                "relative block w-full overflow-hidden rounded-[4px] ring-offset-2 lg:w-12 lg:shrink-0",
                selected ? "ring-2 ring-brand" : "ring-1 ring-line",
              )}
            >
              {renderThumb(s.id as KeepsakeStyleId)}
              {selected && (
                <span className="absolute right-0.5 bottom-0.5 flex size-4 items-center justify-center rounded-full bg-brand text-brand-foreground lg:hidden">
                  <Check className="size-3" aria-hidden />
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-col lg:flex-1">
              <span className={cn("truncate text-[11px] font-semibold lg:text-label lg:font-bold", selected ? "text-ink" : "text-ink-muted lg:text-ink")}>
                {s.label}
                {s.id === defaultId && <span className="hidden font-medium text-ink-muted lg:inline"> · default</span>}
              </span>
              <span className="hidden truncate text-caption font-medium text-ink-muted lg:block">{s.line}</span>
            </span>
            {selected && <Check className="hidden size-4 shrink-0 text-brand-ink lg:block" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** Desktop only: the originals stay a separate, always-available download (product.md §10.2). */
function OriginalsRow({
  family,
  photo,
  fivePhotos,
}: {
  family: KeepsakeFamily;
  photo: PickerPhoto;
  fivePhotos: readonly PickerPhoto[] | null;
}) {
  const [saving, setSaving] = useState(false);
  if (family === "single" && !photo.downloadUrl) return null;

  async function downloadFive() {
    setSaving(true);
    for (const p of fivePhotos ?? []) {
      if (!p.downloadUrl) continue;
      const anchor = document.createElement("a");
      anchor.href = p.downloadUrl;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    setSaving(false);
  }

  return (
    <div className="hidden items-center justify-between gap-3 border-t border-line pt-4 lg:flex">
      <div className="flex flex-col">
        <span className="text-micro font-bold tracking-[0.08em] text-ink-muted uppercase">
          {family === "single" ? "Original photo" : "Original photos"}
        </span>
        <span className="text-caption font-medium text-ink-muted">
          {family === "single" ? "Exactly as you took it" : "Exactly as you took them"}
        </span>
      </div>
      {family === "single" ? (
        <ButtonAnchor href={photo.downloadUrl!} variant="secondary" size="sm" className="h-11">
          <Download aria-hidden />
          Download
        </ButtonAnchor>
      ) : (
        <Button variant="secondary" size="sm" className="h-11" onClick={downloadFive} disabled={saving}>
          <Download aria-hidden />
          {saving ? "Saving…" : "Download"}
        </Button>
      )}
    </div>
  );
}
