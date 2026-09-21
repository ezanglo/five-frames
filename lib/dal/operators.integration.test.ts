import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service-client";
import { grantOperator, isOperator } from "@/lib/dal/operators";

/**
 * Runs against the real linked dev Postgres (architecture §11) — the operator
 * authorization boundary (decision D15, architecture §5a) is a real security control,
 * worth proving against a real database rather than a mock.
 */
describe("operator grant model", () => {
  const supabase = createServiceClient();
  const suffix = crypto.randomUUID();
  let ordinaryUserId: string;
  let grantedUserId: string;

  beforeAll(async () => {
    const { data: ordinary, error: ordinaryError } =
      await supabase.auth.admin.createUser({
        email: `ordinary-${suffix}@example.test`,
        password: crypto.randomUUID(),
        email_confirm: true,
      });
    if (ordinaryError) throw ordinaryError;
    ordinaryUserId = ordinary.user.id;

    const { data: granted, error: grantedError } =
      await supabase.auth.admin.createUser({
        email: `granted-${suffix}@example.test`,
        password: crypto.randomUUID(),
        email_confirm: true,
      });
    if (grantedError) throw grantedError;
    grantedUserId = granted.user.id;
  });

  afterAll(async () => {
    if (ordinaryUserId) await supabase.auth.admin.deleteUser(ordinaryUserId);
    if (grantedUserId) await supabase.auth.admin.deleteUser(grantedUserId);
  });

  it("an account with no operators row is not an operator", async () => {
    expect(await isOperator(ordinaryUserId)).toBe(false);
  });

  it("granting a user makes isOperator true, and only for that user", async () => {
    await grantOperator(grantedUserId);

    expect(await isOperator(grantedUserId)).toBe(true);
    expect(await isOperator(ordinaryUserId)).toBe(false);
  });

  it("granting is idempotent: granting twice leaves exactly one row", async () => {
    await grantOperator(grantedUserId);
    await grantOperator(grantedUserId);

    const { data, error } = await supabase
      .from("operators")
      .select("user_id")
      .eq("user_id", grantedUserId);

    if (error) throw error;
    expect(data).toHaveLength(1);
  });
});
