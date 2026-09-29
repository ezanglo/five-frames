import { CalendarCheck, Camera, Image as ImageIcon, Link2 } from "lucide-react";
import { requireHost } from "@/lib/auth/host-session";
import { NextStepsTimeline, WizardShell } from "@/components/ff/host/wizard";
import { createEventAction } from "../actions";
import { DetailsStepForm } from "../wizard-forms";

export const metadata = { title: "Create event · FiveFrames" };

const SETUP_TIMELINE = [
  { title: "Now · Set it up", body: "Name it, add a welcome, then activate it.", icon: <CalendarCheck /> },
  { title: "After payment · Share", body: "Your link and QR code are issued.", icon: <Link2 /> },
  { title: "On the day · Open capture", body: "Guests shoot once you switch it on.", icon: <Camera /> },
  { title: "After · Reveal", body: "Review, hide any photo, then reveal.", icon: <ImageIcon /> },
];

/** Create · Details for a brand-new event (D3 / 05a). The draft is created on Continue. */
export default async function NewEventPage() {
  await requireHost();
  return (
    <WizardShell
      step={1}
      closeHref="/dashboard"
      status="Saves as a draft when you continue"
      title="What’s the occasion?"
      subtitle="Name your event and pick its date."
      aside={<NextStepsTimeline items={SETUP_TIMELINE} />}
    >
      <DetailsStepForm
        action={createEventAction}
        event={null}
        timezones={Intl.supportedValuesOf("timeZone")}
        cancelHref="/dashboard"
      />
    </WizardShell>
  );
}
