import { ForgotFlow } from "./forgot-flow";

export const metadata = { title: "Reset your password · FiveFrames" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return <ForgotFlow expired={expired === "1"} />;
}
