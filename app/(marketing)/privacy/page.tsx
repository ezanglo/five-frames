import { LegalDocumentPage } from "@/components/ff/marketing/legal-document";
import { PRIVACY } from "@/lib/marketing/legal";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Privacy Policy",
  description: "What FiveFrames collects, who can see the photos, how long they’re kept, and your rights.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalDocumentPage doc={PRIVACY} other={{ href: "/terms", label: "Terms of Service" }} />;
}
