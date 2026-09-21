"use server";

import { redirect } from "next/navigation";
import { getEventByToken } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { commitCapture, reserveCapture } from "@/lib/dal/captures";
import {
  getGuestSessionIdFromCookie,
  setGuestSessionCookie,
} from "@/lib/auth/guest-session";
import { isCaptureOpen } from "@/lib/events/lifecycle";
import { createSignedReadUrl } from "@/lib/media/storage";
import { CAPTURES_BUCKET } from "@/lib/media/constants";
import type { CaptureRow } from "@/lib/db/types";

export type JoinActionState = { error: string | null };

export async function joinEvent(
  token: string,
  _prevState: JoinActionState,
  formData: FormData,
): Promise<JoinActionState> {
  const event = await getEventByToken(token);
  if (!event || !isCaptureOpen(event)) {
    return { error: "Capture isn't open for this event right now." };
  }

  const raw = formData.get("displayName");
  const displayName = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  if (!displayName) {
    return { error: "Enter a name so the host knows who captured what." };
  }

  const session = await createGuestSession(event.id, displayName);
  await setGuestSessionCookie(token, event.id, session.id);

  redirect(`/e/${token}`);
}

/** Guest-facing result shapes are plain data — serializable across the client/server boundary. */
export type ReserveResponse =
  | {
      kind: "reserved";
      captureId: string;
      slotIndex: number;
      uploadUrl: string;
      uploadToken: string;
      resumableEndpoint: string;
      bucket: string;
      objectName: string;
    }
  | { kind: "already_committed"; captureId: string; slotIndex: number }
  | { kind: "expired" }
  | { kind: "capture_not_open" }
  | { kind: "frames_exhausted" }
  | { kind: "not_joined" };

export async function reserveSlot(
  token: string,
  reserveKey: string,
): Promise<ReserveResponse> {
  const event = await getEventByToken(token);
  if (!event) return { kind: "capture_not_open" };

  const guestSessionId = await getGuestSessionIdFromCookie(token, event.id);
  if (!guestSessionId) return { kind: "not_joined" };

  const outcome = await reserveCapture(event.id, guestSessionId, reserveKey);

  switch (outcome.kind) {
    case "reserved":
      return {
        kind: "reserved",
        captureId: outcome.capture.id,
        slotIndex: outcome.capture.slot_index,
        uploadUrl: outcome.uploadUrl,
        uploadToken: outcome.uploadToken,
        resumableEndpoint: outcome.resumableEndpoint,
        bucket: CAPTURES_BUCKET,
        objectName: outcome.capture.storage_path,
      };
    case "already_committed":
      return {
        kind: "already_committed",
        captureId: outcome.capture.id,
        slotIndex: outcome.capture.slot_index,
      };
    case "expired":
      return { kind: "expired" };
    case "capture_not_open":
      return { kind: "capture_not_open" };
    case "frames_exhausted":
      return { kind: "frames_exhausted" };
  }
}

export type CommitResponse =
  | { kind: "committed"; capture: CaptureRow; thumbnailUrl: string | null; downloadUrl: string | null }
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "capture_not_open" }
  | { kind: "not_uploaded" }
  | { kind: "not_joined" };

export async function commitSlot(
  token: string,
  captureId: string,
  message: string,
): Promise<CommitResponse> {
  const event = await getEventByToken(token);
  if (!event) return { kind: "capture_not_open" };

  const guestSessionId = await getGuestSessionIdFromCookie(token, event.id);
  if (!guestSessionId) return { kind: "not_joined" };

  const trimmedMessage = message.trim().slice(0, 280);
  const outcome = await commitCapture(
    event.id,
    guestSessionId,
    captureId,
    trimmedMessage || null,
  );

  if (outcome.kind !== "committed") return outcome;

  if (!outcome.capture.thumbnail_path) {
    return { kind: "committed", capture: outcome.capture, thumbnailUrl: null, downloadUrl: null };
  }

  const [thumbnailUrl, downloadUrl] = await Promise.all([
    createSignedReadUrl(outcome.capture.thumbnail_path),
    createSignedReadUrl(outcome.capture.storage_path),
  ]);

  return { kind: "committed", capture: outcome.capture, thumbnailUrl, downloadUrl };
}
