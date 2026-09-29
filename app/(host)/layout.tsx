import { requireHost } from "@/lib/auth/host-session";

/**
 * Every host route requires a verified host session. Each page renders its own chrome — the
 * top nav and event header (components/ff/host/host-chrome.tsx) or the create-event wizard bar,
 * which replaces the nav (components/ff/host/wizard.tsx).
 */
export default async function HostLayout({ children }: { children: React.ReactNode }) {
  await requireHost();
  return children;
}
