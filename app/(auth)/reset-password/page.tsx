import { AuthShell } from "@/components/ff/auth-shell";
import { ButtonLink } from "@/components/ff/button";
import { getAuthenticatedHost } from "@/lib/auth/host-session";
import { firstName } from "@/lib/events/format";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Set a new password · FiveFrames" };

/**
 * Reached through /auth/confirm, which turns the emailed recovery link into a session on this
 * browser. Without that session there is nothing to reset, so the page says the link expired.
 */
export default async function ResetPasswordPage() {
  const host = await getAuthenticatedHost();

  if (!host) {
    return (
      <AuthShell
        title="This link has expired"
        subtitle="Reset links work once and only for a limited time."
        back={{ href: "/login", label: "Back to sign in" }}
      >
        <div className="mt-auto lg:mt-0">
          <ButtonLink href="/forgot-password" className="w-full">
            Request a new link
          </ButtonLink>
        </div>
      </AuthShell>
    );
  }

  const name = firstName(host.name);
  return (
    <AuthShell
      title="Set a new password"
      subtitle={`Almost there${name ? `, ${name}` : ""}. Pick something you’ll remember.`}
    >
      <NewPasswordForm />
    </AuthShell>
  );
}
