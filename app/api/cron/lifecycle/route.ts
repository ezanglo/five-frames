import { NextResponse, type NextRequest } from "next/server";
import { runLifecycleSweep } from "@/lib/dal/lifecycle";

/**
 * Scheduled lifecycle work (product.md §15.2, roadmap Slice 12; `vercel.json` schedules this
 * daily). Vercel Cron authenticates its own invocations by sending
 * `Authorization: Bearer $CRON_SECRET` automatically once that env var is set — verified here
 * the same way the PayMongo webhook verifies its own signature before doing anything else, so
 * an unauthenticated caller can never trigger permanent deletion early.
 *
 * The actual work is server-authoritative and idempotent (see lib/dal/lifecycle.ts) — safe to
 * rerun on any schedule, including a manually triggered retry after a failed run.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Lifecycle cron: CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runLifecycleSweep();

  if (result.failures.length > 0) {
    console.error("Lifecycle cron: some events failed permanent deletion", result.failures);
  }

  return NextResponse.json(result);
}
