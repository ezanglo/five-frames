/**
 * The three plans (product.md §15.3, decision D24, architecture §8c). One closed registry, read
 * by the Share step, the dashboard, the Operator Console, marketing and the DAL. No secrets, so
 * no `server-only` import, the same as the old single price constant it replaces.
 *
 * Paid plans differ only in guest capacity, hosted access and Celebration extras. Free is a
 * lighter event (product.md §15.3.1), described by `features`. The five frames, capture flow,
 * gallery, downloads and the FiveFrames brandmark are the same on every plan, so nothing about
 * them lives here.
 *
 * Capacities and durations are launch hypotheses (product.md §19), not invariants. Activation
 * stamps them onto the event (`guest_session_cap`, `hosted_until`), so changing a value here
 * affects events activated afterwards, never ones already running.
 */

export const PLAN_IDS = ["free", "intimate", "celebration"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Plans a payment can buy. Free is activated, never paid for (product.md §7.2). */
export const PAID_PLAN_IDS = ["intimate", "celebration"] as const satisfies readonly PlanId[];
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

/**
 * What a plan's event can do beyond the shared core (product.md §15.3.1). Enforced on the
 * server for Free events in Slice 21 (Invariant 15); marketing reads the same flags.
 */
export type PlanFeatures = {
  /** Printable QR, table card and poster. Without it: link, on-screen QR and phone-screen only. */
  printSignage: boolean;
  /** Theme image and hashtag. Without it: accent color only. */
  themeImageAndHashtag: boolean;
  /** Every keepsake style in both families. Without it: the preselected style of each. */
  allKeepsakeStyles: boolean;
  /** Guests-joined and photos-taken counts on the host dashboard. */
  liveCounts: boolean;
  /** Numbered table cards with the event QR (product.md §11.3; built in Slice 24). */
  tableNumberCards: boolean;
};

const PAID_FEATURES: PlanFeatures = {
  printSignage: true,
  themeImageAndHashtag: true,
  allKeepsakeStyles: true,
  liveCounts: true,
  tableNumberCards: false,
};

export type Plan = {
  id: PlanId;
  /** Human-readable name. Plan ids never reach the UI raw. */
  label: string;
  /** Who it's for, in one short phrase (product.md §15.3). */
  forWhom: string;
  pricePhp: number;
  guestSessionCap: number;
  hostedAccessDays: number;
  /** Shorthand for copy ("6 months"). Derived from the duration so the two can't drift. */
  hostedAccessLabel: string;
  features: PlanFeatures;
};

function accessLabel(days: number): string {
  if (days < 28) return `${days} days`;
  const months = Math.round(days / 30.4);
  return `${months} month${months === 1 ? "" : "s"}`;
}

function plan(p: Omit<Plan, "hostedAccessLabel">): Plan {
  return { ...p, hostedAccessLabel: accessLabel(p.hostedAccessDays) };
}

export const PLANS: Record<PlanId, Plan> = {
  free: plan({
    id: "free",
    label: "Free",
    forWhom: "Trying FiveFrames for real, once",
    pricePhp: 0,
    guestSessionCap: 10,
    hostedAccessDays: 7,
    features: {
      printSignage: false,
      themeImageAndHashtag: false,
      allKeepsakeStyles: false,
      liveCounts: false,
      tableNumberCards: false,
    },
  }),
  intimate: plan({
    id: "intimate",
    label: "Intimate",
    forWhom: "Birthdays, dinners and small reunions",
    pricePhp: 499,
    guestSessionCap: 100,
    hostedAccessDays: 183,
    features: PAID_FEATURES,
  }),
  celebration: plan({
    id: "celebration",
    label: "Celebration",
    forWhom: "Weddings, corporate events and big celebrations",
    pricePhp: 999,
    guestSessionCap: 300,
    hostedAccessDays: 365,
    features: { ...PAID_FEATURES, tableNumberCards: true },
  }),
};

export const PAID_PLANS: Plan[] = PAID_PLAN_IDS.map((id) => PLANS[id]);

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return typeof value === "string" && (PAID_PLAN_IDS as readonly string[]).includes(value);
}

export function priceCentavos(planId: PaidPlanId): number {
  return PLANS[planId].pricePhp * 100;
}

/** "₱499" — en-PH grouping, the format every price on the site and in the app uses. */
export function formatPrice(pricePhp: number): string {
  return `₱${pricePhp.toLocaleString("en-PH")}`;
}

/**
 * The plan a payment bought. Payments created before plans existed have no plan; every one of
 * them was the single ₱999 / 12-month product, which is Celebration (migration
 * 20261011000000_event_plans.sql).
 */
export function planForPayment(payment: { plan: PaidPlanId | null }): PaidPlanId {
  return payment.plan ?? "celebration";
}
