import { describe, expect, it } from "vitest";
import type { CommitResponse, ReserveResponse } from "@/app/(guest)/e/[token]/actions";
import {
  ATTEMPT_COPY,
  attemptReducer,
  initialAttemptState,
  type AttemptState,
} from "./attempt";
import { keepPhoto, type KeepOutcome } from "./keep";

/**
 * NET-02 regression: a reserve or commit request that fails in transit must end in Retry, and
 * Retry must converge on exactly one capture. The fake server is idempotent the same way the
 * real one is (reserve_key, commit of a committed row); `captures.integration.test.ts` runs the
 * lost-response cases against real dev Postgres and Storage.
 */

type Row = { captureId: string; slotIndex: number; status: "pending" | "committed"; uploaded: boolean };

class FakeServer {
  rows = new Map<string, Row>();

  reserve(key: string): ReserveResponse {
    const existing = this.rows.get(key);
    if (existing?.status === "committed") {
      return { kind: "already_committed", captureId: existing.captureId, slotIndex: existing.slotIndex };
    }
    let row = existing;
    if (!row) {
      if (this.rows.size >= 5) return { kind: "frames_exhausted" };
      row = { captureId: `capture-${this.rows.size}`, slotIndex: this.rows.size, status: "pending", uploaded: false };
      this.rows.set(key, row);
    }
    return {
      kind: "reserved",
      captureId: row.captureId,
      slotIndex: row.slotIndex,
      uploadUrl: "https://storage.test/upload",
      uploadToken: "upload-token",
      resumableEndpoint: "https://storage.test/upload/resumable/sign",
      bucket: "captures",
      objectName: `${row.captureId}/original`,
    };
  }

  upload(captureId: string) {
    this.byId(captureId).uploaded = true;
  }

  commit(captureId: string): CommitResponse {
    const row = this.byId(captureId);
    if (row.status !== "committed") {
      if (!row.uploaded) return { kind: "not_uploaded" };
      row.status = "committed";
    }
    return {
      kind: "committed",
      capture: { id: row.captureId, message: null, committed_at: "2026-10-01T00:00:00.000Z" },
      thumbnailUrl: null,
      displayUrl: null,
      downloadUrl: null,
    } as CommitResponse;
  }

  committed() {
    return [...this.rows.values()].filter((r) => r.status === "committed");
  }

  private byId(captureId: string) {
    const row = [...this.rows.values()].find((r) => r.captureId === captureId);
    if (!row) throw new Error(`no row ${captureId}`);
    return row;
  }
}

/** How the network treats the next request of one kind. */
type Net = "ok" | "request-lost" | "response-lost" | "hang";

function over<T>(net: Net, call: () => T): Promise<T> {
  switch (net) {
    case "ok":
      return Promise.resolve().then(call);
    case "request-lost":
      return Promise.reject(new TypeError("Failed to fetch"));
    case "response-lost":
      return Promise.resolve()
        .then(call)
        .then(() => Promise.reject(new TypeError("Failed to fetch")));
    case "hang":
      return new Promise<T>(() => {});
  }
}

/** Your Five as the page drives it: one persisted key, the attempt reducer, Keep/Retry presses. */
class Guest {
  key: string | null = null;
  keysSent: string[] = [];
  calls: string[] = [];
  state: AttemptState;
  net: { reserve: Net; upload: Net; commit: Net } = { reserve: "ok", upload: "ok", commit: "ok" };
  private minted = 0;

  constructor(readonly server: FakeServer) {
    this.state = attemptReducer(initialAttemptState, {
      type: "chosen",
      file: { name: "shot.jpg" } as File,
      previewUrl: "blob:preview",
    });
  }

  async press(timeoutMs?: number): Promise<KeepOutcome> {
    const outcome = await keepPhoto(
      {
        pendingKey: () => this.key,
        rememberNewKey: () => (this.key = `key-${this.minted++}`),
        reserve: (key) => {
          this.calls.push("reserve");
          this.keysSent.push(key);
          return over(this.net.reserve, () => this.server.reserve(key));
        },
        upload: (reserved) => {
          this.calls.push("upload");
          return over(this.net.upload, () => this.server.upload(reserved.captureId));
        },
        commit: (captureId) => {
          this.calls.push("commit");
          return over(this.net.commit, () => this.server.commit(captureId));
        },
        onStep: (phase) => (this.state = attemptReducer(this.state, { type: "step", phase })),
        timeoutMs,
      },
      this.state.uploaded,
    );

    if (outcome.kind === "retryable") {
      this.state = attemptReducer(this.state, {
        type: "retryable",
        error: outcome.error,
        uploaded: outcome.uploaded,
      });
    } else {
      // The page forgets the key once the attempt commits or ends.
      this.key = null;
      this.state =
        outcome.kind === "committed"
          ? attemptReducer(this.state, { type: "committed" })
          : attemptReducer(this.state, { type: "ended", reason: outcome.reason });
    }
    return outcome;
  }

  /** A fresh photo chosen for the next shot. */
  choose() {
    this.state = attemptReducer(this.state, {
      type: "chosen",
      file: { name: "next.jpg" } as File,
      previewUrl: "blob:next",
    });
  }
}

function expectRetryState(guest: Guest) {
  // The sheet leaves "Keeping…"/"Saving…" for Retry with a calm message, photo still there.
  expect(guest.state.phase).toBe("error");
  expect(guest.state.error).toBe(ATTEMPT_COPY.connectionLost);
  expect(guest.state.file).not.toBeNull();
}

describe("Keep after a reserve request fails in transit", () => {
  it("never reached the server: Retry, nothing reserved, then one capture after reconnect", async () => {
    const server = new FakeServer();
    const guest = new Guest(server);
    guest.net.reserve = "request-lost";

    const failed = await guest.press();
    expect(failed).toEqual({ kind: "retryable", error: ATTEMPT_COPY.connectionLost, uploaded: null });
    expectRetryState(guest);
    expect(server.rows.size).toBe(0);

    guest.net.reserve = "ok";
    const retried = await guest.press();
    expect(retried.kind).toBe("committed");
    expect(guest.keysSent).toEqual(["key-0", "key-0"]);
    expect(server.committed()).toHaveLength(1);
    expect(guest.state.error).toBeNull();
  });

  it("reached the server but the response was lost: Retry gets the same reservation back", async () => {
    const server = new FakeServer();
    const guest = new Guest(server);
    guest.net.reserve = "response-lost";

    await guest.press();
    expectRetryState(guest);
    expect(server.rows.size).toBe(1);
    expect(server.committed()).toHaveLength(0);

    guest.net.reserve = "ok";
    const retried = await guest.press();
    expect(retried).toMatchObject({ kind: "committed", captureId: "capture-0", slotIndex: 0 });
    expect(guest.keysSent).toEqual(["key-0", "key-0"]);
    expect(server.rows.size).toBe(1);
    expect(server.committed()).toHaveLength(1);
  });
});

describe("Keep after a commit request fails in transit", () => {
  it("never reached the server: Retry re-commits the same reservation without reserving again", async () => {
    const server = new FakeServer();
    const guest = new Guest(server);
    guest.net.commit = "request-lost";

    const failed = await guest.press();
    expect(failed).toEqual({
      kind: "retryable",
      error: ATTEMPT_COPY.connectionLost,
      uploaded: { captureId: "capture-0", slotIndex: 0 },
    });
    expectRetryState(guest);
    expect(server.committed()).toHaveLength(0);

    guest.net.commit = "ok";
    guest.calls = [];
    const retried = await guest.press();
    expect(retried).toMatchObject({ kind: "committed", captureId: "capture-0" });
    expect(guest.calls).toEqual(["commit"]);
    expect(server.committed()).toHaveLength(1);
  });

  it("committed on the server but the response was lost: Retry converges on that one capture", async () => {
    const server = new FakeServer();
    const guest = new Guest(server);
    guest.net.commit = "response-lost";

    await guest.press();
    expectRetryState(guest);
    expect(server.committed()).toHaveLength(1);

    guest.net.commit = "ok";
    const retried = await guest.press();
    expect(retried).toMatchObject({ kind: "committed", captureId: "capture-0", slotIndex: 0 });
    expect(server.rows.size).toBe(1);
    expect(server.committed()).toHaveLength(1);
  });

  it("with the uploaded reservation forgotten (reload), the same key still converges", async () => {
    const server = new FakeServer();
    const guest = new Guest(server);
    guest.net.commit = "response-lost";
    await guest.press();

    // A reload keeps the persisted key but not the reducer state.
    guest.state = { ...guest.state, uploaded: null };
    guest.net.commit = "ok";
    guest.calls = [];
    const retried = await guest.press();
    expect(retried).toMatchObject({ kind: "committed", captureId: "capture-0" });
    expect(guest.calls).toEqual(["reserve", "commit"]);
    expect(server.committed()).toHaveLength(1);
  });

  it("a commit that finds no upload drops the uploaded reservation, so Retry re-uploads", async () => {
    const server = new FakeServer();
    const guest = new Guest(server);
    // The upload's bytes never landed, yet the client believes the PUT went through.
    const realUpload = server.upload.bind(server);
    server.upload = () => {};

    const failed = await guest.press();
    expect(failed).toEqual({ kind: "retryable", error: ATTEMPT_COPY.notUploaded, uploaded: null });

    server.upload = realUpload;
    guest.calls = [];
    await guest.press();
    expect(guest.calls).toEqual(["reserve", "upload", "commit"]);
    expect(server.committed()).toHaveLength(1);
  });
});

describe("Keep never consumes an extra frame", () => {
  it("five shots, each with a lost reserve and a lost commit, end at exactly five captures", async () => {
    const server = new FakeServer();
    const guest = new Guest(server);

    for (let shot = 0; shot < 5; shot++) {
      if (shot > 0) guest.choose();
      guest.net = { reserve: "response-lost", upload: "ok", commit: "ok" };
      await guest.press();
      guest.net = { reserve: "ok", upload: "ok", commit: "response-lost" };
      await guest.press();
      guest.net = { reserve: "ok", upload: "ok", commit: "ok" };
      expect((await guest.press()).kind).toBe("committed");
    }
    expect(server.rows.size).toBe(5);
    expect(server.committed()).toHaveLength(5);

    guest.choose();
    expect(await guest.press()).toEqual({ kind: "ended", reason: "frames_exhausted" });
    expect(server.rows.size).toBe(5);
  });
});

describe("a stalled request", () => {
  it("times out to Retry instead of spinning, and Retry stays idempotent", async () => {
    const server = new FakeServer();
    const guest = new Guest(server);
    guest.net.commit = "hang";

    const failed = await guest.press(10);
    expect(failed).toMatchObject({ kind: "retryable", uploaded: { captureId: "capture-0" } });
    expectRetryState(guest);

    guest.net.commit = "ok";
    expect((await guest.press(10)).kind).toBe("committed");
    expect(server.committed()).toHaveLength(1);
  });
});

describe("the next attempt after a transport failure", () => {
  it("Retry clears the stale message while it runs, and a new photo forgets the old upload", async () => {
    const server = new FakeServer();
    const guest = new Guest(server);
    guest.net.commit = "request-lost";
    await guest.press();
    expect(guest.state.uploaded).not.toBeNull();

    // Retry goes straight to committing; the old message must not linger under "Saving…".
    const saving = attemptReducer(guest.state, { type: "step", phase: "committing" });
    expect(saving.phase).toBe("committing");
    expect(saving.error).toBeNull();

    // Choosing a different photo must never commit the earlier upload in its place.
    guest.choose();
    expect(guest.state.uploaded).toBeNull();
    expect(guest.state.error).toBeNull();
    expect(attemptReducer(guest.state, { type: "discarded", resuming: true }).uploaded).toBeNull();
  });
});
