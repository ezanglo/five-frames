import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/service-client";
import { generateLinkToken } from "@/lib/auth/link-tokens";
import {
  createDraftEvent,
  getEventByGalleryToken,
  getEventForHost,
  updateEventConfig,
} from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import {
  commitCapture,
  listCapturesForGalleryViewer,
  moderateCapture,
  reserveCapture,
} from "@/lib/dal/captures";
import { isGalleryOpenToLinkHolders, isGalleryRevealed } from "@/lib/events/lifecycle";
import { GALLERY_LAYOUTS, resolveGalleryLayout } from "@/lib/gallery/layouts";
import type { HostSession } from "@/lib/auth/host-session";
import type { EventRow, GalleryLayout } from "@/lib/db/types";

/**
 * Gallery layouts (decision D22) against the real dev Postgres and Storage. The layout is a
 * host-owned presentation setting: it persists through the real Settings action, defaults to
 * Masonry, and changing it alters nothing else — not which captures the gallery lists or their
 * order, not a capture row, not an original's bytes, and not who may open the gallery.
 */

let currentHost: HostSession | null = null;
vi.mock("@/lib/auth/host-session", () => ({
  getAuthenticatedHost: async () => currentHost,
  requireHost: async () => {
    if (!currentHost) throw new Error("redirect");
    return currentHost;
  },
}));

const { saveEventAndGalleryAction, saveDetailsStepAction } = await import("@/app/(host)/events/actions");

/** Next's redirect()/notFound() throw a control-flow error carrying a digest. */
async function settle(promise: Promise<unknown>): Promise<string> {
  try {
    const result = await promise;
    return JSON.stringify(result);
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? String(error);
    return digest.startsWith("NEXT_REDIRECT") ? "redirect" : digest.includes("404") ? "not_found" : digest;
  }
}

function settingsForm(event: EventRow, galleryLayout?: string) {
  const form = new FormData();
  form.set("name", event.name);
  form.set("timezone", event.timezone);
  form.set("revealMode", event.reveal_mode);
  form.set("visibility", event.visibility);
  if (galleryLayout !== undefined) form.set("galleryLayout", galleryLayout);
  return form;
}

async function jpeg(width: number, height: number, seed: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: seed * 40, g: 120, b: 200 - seed * 30 } },
  })
    .jpeg()
    .toBuffer();
}

describe("gallery layout (real Postgres)", { timeout: 120_000 }, () => {
  const supabase = createServiceClient();
  let hostId: string;
  let otherHostId: string;
  const storagePaths: string[] = [];

  beforeAll(async () => {
    const ids: string[] = [];
    for (const role of ["layout-host", "layout-other"]) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: `${role}-${crypto.randomUUID()}@example.test`,
        password: crypto.randomUUID(),
        email_confirm: true,
      });
      if (error) throw error;
      ids.push(data.user.id);
    }
    [hostId, otherHostId] = ids;
  });

  afterAll(async () => {
    if (storagePaths.length) await supabase.storage.from("captures").remove(storagePaths);
    if (hostId) await supabase.auth.admin.deleteUser(hostId);
    if (otherHostId) await supabase.auth.admin.deleteUser(otherHostId);
  });

  it("a new event starts as Masonry, and the database refuses any value but the three", async () => {
    const event = await createDraftEvent(hostId, "Layout default");
    expect(event.gallery_layout).toBe("masonry");
    expect(resolveGalleryLayout((await getEventForHost(hostId, event.id))!.gallery_layout)).toBe("masonry");

    // Rows predating the column took the same default when it was added (migration
    // 20261001000000); the check constraint keeps any other value out, even from the service role.
    const { error } = await supabase.from("events").update({ gallery_layout: "slideshow" }).eq("id", event.id);
    expect(error?.code).toBe("23514");
  });

  it("the host chooses Masonry, Rows or Grid in Settings, and the choice persists", async () => {
    const event = await createDraftEvent(hostId, "Layout choice");
    currentHost = { id: hostId } as HostSession;

    for (const layout of ["rows", "grid", "masonry", "grid"] as GalleryLayout[]) {
      const outcome = await settle(saveEventAndGalleryAction(event.id, { error: null }, settingsForm(event, layout)));
      expect(outcome).toBe("redirect");
      expect((await getEventForHost(hostId, event.id))!.gallery_layout).toBe(layout);
    }

    // The Create flow's Details step has no layout field, so saving it leaves the choice alone.
    const reloaded = (await getEventForHost(hostId, event.id))!;
    await settle(saveDetailsStepAction(event.id, { error: null }, settingsForm(reloaded)));
    expect((await getEventForHost(hostId, event.id))!.gallery_layout).toBe("grid");

    // An unknown value is refused calmly in the form and by the DAL; the stored choice stays.
    const refused = await settle(saveEventAndGalleryAction(event.id, { error: null }, settingsForm(reloaded, "carousel")));
    expect(refused).toContain("Choose Masonry, Rows or Grid.");
    await expect(
      updateEventConfig(hostId, event.id, { galleryLayout: "carousel" as GalleryLayout }),
    ).rejects.toThrow("Choose Masonry, Rows or Grid.");
    expect((await getEventForHost(hostId, event.id))!.gallery_layout).toBe("grid");

    // Another host can't change it (invariant 9): same not-found as a missing event.
    currentHost = { id: otherHostId } as HostSession;
    const foreign = await settle(saveEventAndGalleryAction(event.id, { error: null }, settingsForm(reloaded, "rows")));
    expect(foreign).toBe("not_found");
    expect(await updateEventConfig(otherHostId, event.id, { galleryLayout: "rows" })).toBeNull();
    expect((await getEventForHost(hostId, event.id))!.gallery_layout).toBe("grid");
    currentHost = null;
  });

  it("changing the layout leaves the gallery's photos, capture rows, originals and access unchanged", async () => {
    // A paid, open, revealed event with three guests' captures: portrait, landscape and square.
    const draft = await createDraftEvent(hostId, "Layout invariants");
    const now = new Date().toISOString();
    const { data: opened, error: openError } = await supabase
      .from("events")
      .update({
        activated_at: now,
        capture_opened_at: now,
        safety_net_closes_at: new Date(Date.now() + 3_600_000).toISOString(),
        reveal_mode: "immediate",
        visibility: "anyone_with_link",
        gallery_token: generateLinkToken(),
      })
      .eq("id", draft.id)
      .select()
      .single();
    if (openError) throw openError;
    const event = opened as EventRow;

    const shapes: [number, number][] = [[30, 40], [48, 32], [36, 36], [40, 30]];
    const captureIds: string[] = [];
    for (const [index, [w, h]] of shapes.entries()) {
      const joined = await createGuestSession(event.id, `Guest ${index + 1}`);
      if (joined.kind !== "joined") throw new Error("expected joined");
      const reserved = await reserveCapture(event.id, joined.session.id, crypto.randomUUID());
      if (reserved.kind !== "reserved") throw new Error("expected reserved");
      const { error } = await supabase.storage
        .from("captures")
        .upload(reserved.capture.storage_path, await jpeg(w, h, index), { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const base = reserved.capture.storage_path.replace(/\/original$/, "");
      storagePaths.push(`${base}/original`, `${base}/display`, `${base}/thumbnail`);

      const committed = await commitCapture(event.id, joined.session.id, reserved.capture.id, null);
      if (committed.kind !== "committed") throw new Error("expected committed");
      // Commit records the display derivative's own size (D22), here the uploaded size.
      expect([committed.capture.display_width, committed.capture.display_height]).toEqual([w, h]);
      captureIds.push(committed.capture.id);
    }

    // Moderation: hide the 2nd, delete the 4th. Neither appears in the gallery.
    expect(await moderateCapture(hostId, event.id, captureIds[1], "hide")).toBe(true);
    expect(await moderateCapture(hostId, event.id, captureIds[3], "delete")).toBe(true);

    async function snapshot() {
      const { data, error } = await supabase.from("captures").select("*").eq("event_id", event.id).order("id");
      if (error) throw error;
      const originals = await Promise.all(
        captureIds.map(async (id) => {
          const row = data.find((r) => r.id === id)!;
          const { data: blob } = await supabase.storage.from("captures").download(row.storage_path);
          return createHash("sha256").update(Buffer.from(await blob!.arrayBuffer())).digest("hex");
        }),
      );
      return { rows: data, originals };
    }

    const viewable = (list: Awaited<ReturnType<typeof listCapturesForGalleryViewer>>) =>
      list.map(({ id, message, favorited, width, height }) => ({ id, message, favorited, width, height }));

    const before = await snapshot();
    const expected = [
      { id: captureIds[0], message: null, favorited: false, width: 30, height: 40 },
      { id: captureIds[2], message: null, favorited: false, width: 36, height: 36 },
    ];

    for (const layout of GALLERY_LAYOUTS) {
      const updated = await updateEventConfig(hostId, event.id, { galleryLayout: layout });
      expect(updated!.gallery_layout).toBe(layout);

      // Same authorized, moderated list in the same order, whatever the layout.
      const resolved = (await getEventByGalleryToken(event.gallery_token!))!;
      expect(isGalleryRevealed(resolved)).toBe(true);
      expect(isGalleryOpenToLinkHolders(resolved)).toBe(true);
      expect(viewable(await listCapturesForGalleryViewer(event.id))).toEqual(expected);

      // Access rules are untouched: "only me" and an unrevealed gallery still grant nothing,
      // and an unknown token still finds nothing.
      expect(isGalleryOpenToLinkHolders({ ...resolved, visibility: "only_me" })).toBe(false);
      expect(isGalleryOpenToLinkHolders({ ...resolved, activated_at: null })).toBe(false);
      expect(await getEventByGalleryToken(generateLinkToken())).toBeNull();
    }

    // No capture row and no original changed while the layout did.
    const after = await snapshot();
    expect(after.rows).toEqual(before.rows);
    expect(after.originals).toEqual(before.originals);

    // Unhiding brings the capture back, in its place, under the current layout; deleted stays out.
    expect(await moderateCapture(hostId, event.id, captureIds[1], "unhide")).toBe(true);
    expect((await listCapturesForGalleryViewer(event.id)).map((c) => c.id)).toEqual(captureIds.slice(0, 3));
  });
});
