import { redirect } from "next/navigation";

/**
 * The checkout confirmation now lives in the create wizard's Share step (D5). This route stays
 * because PayMongo's `cancel_url` points here (lib/dal/payments.ts); it forwards to the wizard,
 * which re-checks ownership and activation itself.
 */
export default async function EventCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { eventId } = await params;
  const { checkout } = await searchParams;
  const query = new URLSearchParams({ step: "share" });
  if (checkout) query.set("checkout", checkout);
  redirect(`/events/${eventId}/setup?${query.toString()}`);
}
