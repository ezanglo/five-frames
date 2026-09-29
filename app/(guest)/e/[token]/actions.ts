"use server";

import { redirect } from "next/navigation";
import { getEventByToken } from "@/lib/dal/events";
import { createGuestSession } from "@/lib/dal/guest-sessions";
import { commitCapture, filenameForGuestOriginal, reserveCapture } from "@/lib/dal/captures";
import { getShareCardForGuestCapture } from "@/lib/dal/share-cards";
import {
  getGuestSessionIdFromCookie,
  setGuestSessionCookie,
} from "@/lib/auth/guest-session";
import { hasReachedGuestCapacity, isCaptureOpen } from "@/lib/events/lifecycle";
import { createSignedReadUrl } from "@/lib/media/storage";
import { CAPTURES_BUCKET } from "@/lib/media/constants";
import type { CaptureRow } from "@/lib/db/types";

export type JoinActionState = { error: string | null; atCapacity?: boolean };

export async function joinEvent(
  token: string,
  _prevState: JoinActionState,
  formData: FormData,
): Promise<JoinActionState> {
  const event = await getEventByToken(token);
  if (!event || !isCaptureOpen(event)) {
    return { error: "Capture isn't open for this event right now." };
  }

  // A fresh read here is a UX nicety, not the enforcement — the atomic join call below
  // re-checks the same condition regardless (product.md §9.5, decision D13).
  if (hasReachedGuestCapacity(event)) {
    return { error: null, atCapacity: true };
  }

  const raw = formData.get("displayName");
  const displayName = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  if (!displayName) {
    return { error: "Enter a name so the host knows who captured what." };
  }

  const outcome = await createGuestSession(event.id, displayName);
  if (outcome.kind === "at_capacity") {
    return { error: null, atCapacity: true };
  }

  await setGuestSessionCookie(token, event.id, outcome.session.id);

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
  | {
      kind: "committed";
      capture: CaptureRow;
      thumbnailUrl: string | null;
      displayUrl: string | null;
      downloadUrl: string | null;
    }
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
    return {
      kind: "committed",
      capture: outcome.capture,
      thumbnailUrl: null,
      displayUrl: null,
      downloadUrl: null,
    };
  }

  const [thumbnailUrl, displayUrl, downloadUrl] = await Promise.all([
    createSignedReadUrl(outcome.capture.thumbnail_path),
    createSignedReadUrl(outcome.capture.display_path ?? outcome.capture.thumbnail_path),
    createSignedReadUrl(
      outcome.capture.storage_path,
      60 * 10,
      filenameForGuestOriginal(outcome.capture.slot_index, outcome.capture.mime_type),
    ),
  ]);

  return { kind: "committed", capture: outcome.capture, thumbnailUrl, displayUrl, downloadUrl };
}

/**
 * The guest sharing flow (product.md §10): generates or retrieves the branded share card for
 * one of the requesting guest's own captures. Server-authoritative like every other guest
 * action here — the event is resolved fresh from the token, the guest session from the signed
 * cookie, and the actual ownership/eligibility check happens in the DAL, not in this action.
 * Returned as a data URL rather than a signed storage URL: the card is synthesized content,
 * not an original media object, the same reasoning lib/media/signage.ts already applies to
 * signage (an access-gated route builds and hands back bytes directly, no separate credential).
 */
export type ShareCardResponse =
  | { kind: "ok"; dataUrl: string }
  | { kind: "sharing_disabled" }
  | { kind: "not_found" }
  | { kind: "not_joined" };

export async function getShareCard(
  token: string,
  captureId: string,
): Promise<ShareCardResponse> {
  const event = await getEventByToken(token);
  if (!event) return { kind: "not_found" };

  const guestSessionId = await getGuestSessionIdFromCookie(token, event.id);
  if (!guestSessionId) return { kind: "not_joined" };

  const outcome = await getShareCardForGuestCapture(event, guestSessionId, captureId);
  if (outcome.kind !== "ok") return outcome;

  return { kind: "ok", dataUrl: `data:image/png;base64,${outcome.bytes.toString("base64")}` };
}
