import { marketingMetadata } from "@/lib/marketing/metadata";
import { DemoExperience } from "./demo-experience";

export const metadata = marketingMetadata({
  title: "Try the demo · FiveFrames",
  description:
    "Try the five-frame capture mechanic before paying. Nothing here is uploaded or saved, and it isn’t a real event.",
  path: "/demo",
  absoluteTitle: true,
});

/**
 * Static, unauthenticated route (product.md §7.1, decision D14). This file and every other file
 * under app/(demo)/ must stay free of any `lib/dal`, Supabase, or server-action import — the
 * whole demo lives in the visitor's browser. See lib/demo/route-isolation.test.ts, which enforces
 * that by reading these files' own source.
 */
export default function DemoPage() {
  return <DemoExperience />;
}
