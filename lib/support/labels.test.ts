import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SUPPORT_ACTION_LABELS } from "./labels";

describe("support log labels", () => {
  it("label exactly the action keys the database accepts", () => {
    // The newest migration that (re)defines the check is the one in force.
    const dir = path.resolve(import.meta.dirname, "../../supabase/migrations");
    const check = readdirSync(dir)
      .sort()
      .reverse()
      .map((file) => readFileSync(path.join(dir, file), "utf-8"))
      .map((sql) => sql.match(/check \(action in \(([\s\S]*?)\)\)/))
      .find(Boolean);
    expect(check).not.toBeNull();
    const keys = [...check![1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort();
    expect(Object.keys(SUPPORT_ACTION_LABELS).sort()).toEqual(keys);
  });

  it("never shows a raw key", () => {
    for (const [key, label] of Object.entries(SUPPORT_ACTION_LABELS)) {
      expect(label).not.toBe(key);
      expect(label).not.toMatch(/_/);
    }
  });
});

describe("settings field labels", () => {
  it("label every column a settings change can carry", async () => {
    const { settingsFieldLabel } = await import("./labels");
    const sql = readFileSync(
      path.resolve(import.meta.dirname, "../../supabase/migrations/20261011040000_support_access.sql"),
      "utf-8",
    );
    const list = sql.match(/when 'settings_changed' then array\[([\s\S]*?)\]/);
    expect(list).not.toBeNull();
    for (const [, column] of list![1].matchAll(/'([a-z_]+)'/g)) {
      expect(settingsFieldLabel(column)).not.toBe("other setting");
      expect(settingsFieldLabel(column)).not.toMatch(/_/);
    }
  });
});
