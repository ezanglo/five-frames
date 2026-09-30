import { SettingsGuardProvider, SettingsSubnav } from "@/components/ff/host/settings-sections";

/**
 * Settings (design-direction "Settings"): three sub-sections — Event & gallery · Look · Links —
 * each its own form with the unsaved-changes guard. Ownership is checked by every page and
 * action beneath this layout, as everywhere else.
 */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <SettingsGuardProvider>
      <div className="flex flex-col gap-5 lg:gap-6">
        <SettingsSubnav eventId={eventId} />
        {children}
      </div>
    </SettingsGuardProvider>
  );
}
