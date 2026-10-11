import { LegalDocumentPage } from "@/components/ff/marketing/legal-document";
import { TERMS } from "@/lib/marketing/legal";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Terms of Service",
  description: "The terms for hosting an event on FiveFrames, joining one as a guest, and viewing a gallery.",
  path: "/terms",
});

export default function TermsPage() {
  return <LegalDocumentPage doc={TERMS} other={{ href: "/privacy", label: "Privacy Policy" }} />;
}
