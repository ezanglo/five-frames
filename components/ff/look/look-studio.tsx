"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import type { EventFormState } from "@/app/(host)/events/actions";
import type { AccentKey } from "@/lib/theme/accents";
import { normalizeHashtag } from "@/lib/theme/hashtag";
import type { LookPreviewState } from "@/lib/theme/preview";
import { Button } from "@/components/ff/button";
import { WizardActions, WizardTitle } from "@/components/ff/host/wizard";
import { UnsavedChangesCard, useUnsavedChanges } from "@/components/ff/host/settings-sections";
import { AccentSample } from "./accent-sample";
import { AccentSwatches } from "./accent-swatches";
import { HashtagField } from "./hashtag-field";
import { GuestKeepsakesToggle, WelcomeMessageField } from "./look-fields";
import { LookPreview } from "./look-preview";
import { ThemeImageControl } from "./theme-image-control";

export type LookInitial = {
  accent: AccentKey;
  hashtag: string;
  message: string;
  sharingEnabled: boolean;
  imageUrl: string | null;
};

type FormValues = Omit<LookInitial, "imageUrl">;

/**
 * The Look studio (design-direction "Host · Look studio"; product.md §10.1). One composition for
 * Create → Look (step 2 of 3, optional) and Settings → Look. Controls, in order: theme image,
 * event color, hashtag, welcome message, Guest keepsakes. Beside them (≥ 1024) or below them,
 * the live preview.
 *
 * Two persistence models, on purpose: the theme image saves itself the moment its upload commits
 * (and Remove after its confirm); color, hashtag, welcome message and Guest keepsakes save with
 * Continue (Create) or Save changes (Settings). The unsaved-changes state tracks only the latter.
 */
export function LookStudio({
  mode,
  eventId,
  eventName,
  dateLabel,
  eventDate,
  activated,
  liveCode = false,
  initialTab,
  initial,
  action,
  backHref,
  saved,
}: {
  mode: "create" | "settings";
  eventId: string;
  eventName: string;
  dateLabel: string | null;
  /** The raw `event_date`, for the keepsake templates' own date formats. */
  eventDate: string | null;
  activated: boolean;
  /** Activated with a current capture link, so signage has its real QR. */
  liveCode?: boolean;
  initialTab?: "signage";
  initial: LookInitial;
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  backHref?: string;
  saved?: boolean;
}) {
  const baseline: FormValues = {
    accent: initial.accent,
    hashtag: initial.hashtag,
    message: initial.message,
    sharingEnabled: initial.sharingEnabled,
  };
  const [values, setValues] = useState<FormValues>(baseline);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [state, formAction, pending] = useActionState(action, { error: null });
  const hashtagRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof FormValues>(key: K) => (value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const dirty =
    values.accent !== baseline.accent ||
    values.hashtag.trim().replace(/^#+/, "") !== baseline.hashtag ||
    values.message.trim() !== baseline.message.trim() ||
    values.sharingEnabled !== baseline.sharingEnabled;
  useUnsavedChanges(mode === "settings" && dirty, pending);

  const hashtag = normalizeHashtag(values.hashtag);
  const previewState: LookPreviewState = useMemo(
    () => ({
      name: eventName,
      dateLabel,
      message: values.message.trim() || null,
      accent: values.accent,
      hashtag: hashtag.ok ? hashtag.value : null,
      imageUrl,
    }),
    [eventName, dateLabel, values.message, values.accent, hashtag.ok, hashtag.ok ? hashtag.value : null, imageUrl], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!hashtag.ok) {
      event.preventDefault();
      hashtagRef.current?.querySelector("input")?.focus();
    }
  }

  function discard() {
    setValues(baseline);
  }

  const controls = (
    <div className="flex flex-col gap-6 md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:items-start md:max-lg:gap-x-8">
      <div className="flex flex-col gap-6">
        <ThemeImageControl eventId={eventId} imageUrl={imageUrl} onImageChange={setImageUrl} />
        <div className="flex flex-col gap-3 border-t border-line pt-6" id={`${eventId}-color`}>
          <AccentSwatches value={values.accent} onChange={set("accent")} describedBy={`${eventId}-color-hint`} />
          <AccentSample accent={values.accent} hashtag={hashtag.ok ? hashtag.value : null} />
          <p id={`${eventId}-color-hint`} className="text-caption font-medium text-ink-muted">
            Colors buttons and highlights on guest screens, keepsakes and signage. FiveFrames keeps
            text readable.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-6 border-t border-line pt-6 md:max-lg:border-t-0 md:max-lg:pt-0">
        <div ref={hashtagRef}>
          <HashtagField value={values.hashtag} onChange={set("hashtag")} />
        </div>
        <div className="border-t border-line pt-6">
          <WelcomeMessageField value={values.message} onChange={set("message")} existingLength={initial.message.length} />
        </div>
        <div className="border-t border-line pt-6">
          <GuestKeepsakesToggle checked={values.sharingEnabled} onChange={set("sharingEnabled")} />
        </div>
      </div>
    </div>
  );

  const error = state.error && (
    <p className="text-caption font-medium text-danger" role="alert">
      {state.error}
    </p>
  );

  const preview = (
    <LookPreview
      eventId={eventId}
      eventDate={eventDate}
      state={previewState}
      sharingEnabled={values.sharingEnabled}
      activated={activated}
      liveCode={liveCode}
      dirty={dirty}
      initialTab={initialTab}
    />
  );

  if (mode === "create") {
    const continueButton = (
      <Button type="submit" disabled={pending} className="w-full lg:w-auto lg:px-8">
        {pending ? "Saving…" : "Continue"}
        <ArrowRight aria-hidden />
      </Button>
    );
    return (
      <form
        action={formAction}
        onSubmit={onSubmit}
        className="flex flex-1 flex-col gap-8 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[440px_minmax(0,1fr)] xl:gap-10"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <WizardTitle
            className="hidden lg:flex"
            kicker="Step 2 of 3 · optional"
            title="Make it yours"
            subtitle="Give your event its look. Skip it and your event still looks finished."
          />
          <div className="lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:p-6">{controls}</div>
          {error}
          <div className="hidden lg:block">
            <WizardActions backHref={backHref}>{continueButton}</WizardActions>
          </div>
        </div>
        <div className="min-w-0 lg:sticky lg:top-[96px]">{preview}</div>
        <div className="lg:hidden">
          <WizardActions backHref={backHref} pinned>
            {continueButton}
          </WizardActions>
        </div>
      </form>
    );
  }

  const unsavedNote =
    "Applies to guest screens, keepsakes and signage from now on. Signage you’ve printed keeps working.";

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start xl:grid-cols-[440px_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-5 lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-title font-semibold text-ink">Look</h2>
          <p className="text-caption font-medium text-ink-muted">
            Your event’s image, color and hashtag. Used on guest screens, keepsakes and signage.
          </p>
        </div>
        {saved && !dirty && (
          <p role="status" className="flex items-center gap-2.5 rounded-lg bg-success-tint p-3 text-label font-semibold text-success">
            <CircleCheck className="size-4" aria-hidden />
            Changes saved.
          </p>
        )}
        {controls}
        {error}
      </div>
      {/* The column stretches to the controls' height: the stage sticks under the event tabs and
          the unsaved card sticks to the bottom of the viewport, so both stay in view. */}
      <div className="flex min-w-0 flex-col gap-4 lg:self-stretch">
        <div className="lg:sticky lg:top-[152px]">{preview}</div>
        {dirty && (
          <UnsavedChangesCard
            note={unsavedNote}
            submitting={pending}
            onDiscard={discard}
            className="sticky bottom-3 z-10 shadow-[0_8px_24px_rgb(21_20_26/0.12)] lg:mt-auto"
          />
        )}
      </div>
    </form>
  );
}
