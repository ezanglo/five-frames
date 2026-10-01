# FiveFrames — Release Validation

The single canonical checklist for pre-release validation. Do not recreate slice-specific test
checklists in other files. Record results here.

## Purpose

Implementation is complete: every roadmap feature slice has shipped (see
[roadmap.md](./roadmap.md)). Release validation was intentionally not run piecemeal after each
slice. It is consolidated here into **one coordinated pass against one final deployment** of the
release candidate.

This file holds:

- the setup to complete immediately before the pass;
- the human evidence that already exists and is **not** repeated;
- every check that still has to run, grouped by workflow;
- an audit of older checklists this one supersedes.

Nothing below is marked PASS until it has actually been run against the release-candidate
deployment. Release work that isn't a test (configuration, migrations, business decisions) is
tracked separately in [progress.md → Release follow-ups](./progress.md#release-follow-ups-not-test-cases).

**Status: IN PROGRESS — automated part complete, no open FAIL; awaiting the human/real-device pass.** 52 cases: 11 PASS, 0 FAIL, 11 BLOCKED, 27 NOT RUN (human/real-device; automated proxy evidence noted where obtained), 3 DEFERRED (INAPP-01…03, accepted launch risk). First automated `/e2e-validate` pass against RC `a2a32b1`, 2026-10-01. Its five FAILs were repaired, and the targeted rerun against RC `8f37fba` (same day) cleared four of them. NET-02 then failed again for a new reason: a connection cut on the reserve or commit request left the guest stuck. That was repaired, and the targeted rerun against RC `6d8aca8` (same day) verified the repair (see [Targeted rerun on RC `6d8aca8`](#targeted-rerun-on-rc-6d8aca8)). NET-02 goes back to NOT RUN, because only a real Android phone can pass it. SMOKE-01's automated run passed. It must still run last, after the human pass.

### Run record

Fill in at the start of the pass. Never record a secret, a link token, or a full capture or
gallery URL in this file.

| Field | Value |
|---|---|
| Release-candidate commit (full SHA) | `6d8aca84a8a9aa5a8ea0909518b7b92b949683a1` (current; second targeted rerun). Earlier: `8f37fba7ed64b29c3c1a39260293f085c339e933` (first targeted rerun), `a2a32b13946f7902288739bfb6a943d6eb46fa0e` (first pass) |
| Vercel environment used (Production or Preview) | Production (Option A) |
| Deployment origin (no tokens) | `https://five-frames.vercel.app` |
| Supabase project | `five-frames-dev` (expected) |
| PayMongo mode | Test (expected) |
| Date(s) of the pass | 2026-10-01 (automated part on `a2a32b1`; targeted automated reruns on `8f37fba` and `6d8aca8`) |
| Tester(s) | `/e2e-validate` (Playwright Chromium/WebKit, E2E host A + operator O); human part pending |

### Repairs after RC `a2a32b1`

Repaired in one `/maintain-project` pass (2026-10-01), not yet deployed. The failed evidence above
stays as recorded. Checkpoint the repaired code as a new release candidate, record its SHA in the
run record, deploy it, then rerun only:

| Rerun | Why |
|---|---|
| NET-02 | Resumable (TUS) upload used the wrong Storage endpoint |
| HOST-08 | Guest frame count after hide/delete |
| HOST-05 | Abandoned checkout no longer reads as "Payment received" |
| OPS-03, then OPS-05 | Payment/refund audit rows (OPS-05 was never run) |
| HOST-10, plus the guest's "Download my photos" | Shared multi-download mechanism replaced |
| NET-04 (the Keep error observation only) | Capture errors no longer vanish |
| HOST-04, OPS-04 | Light recheck: Share-step payment copy and Console payment rendering changed |
| IOS-03, AND-02, VIS-04 | Photo picker changed. Already real-device cases in the remaining human pass, so no extra case |
| SMOKE-01 | Always last |

INAPP-01…03 stay DEFERRED. The Slice 16, 17 and 18 evidence isn't affected (see the invalidation
rule below).

### Targeted rerun on RC `8f37fba`

`/e2e-validate`, 2026-10-01, against `five-frames.vercel.app`. This covered only the rerun list
above. SMOKE-01 and every human/real-device case are still open. Gate: `vercel inspect` and Vercel
API metadata show the alias served `dpl_GbQ1erMNRZUDFUQw4sFuYCNj9DS2` (production, Ready) with
`githubCommitSha` `8f37fba…`, which equals frozen HEAD. Baseline at that HEAD: typecheck ✔,
lint ✔, 509/509 tests. Synthetic data only: E2E host A created **R1 "RV2 Main"** (paid by PayMongo
Test card) and **R2 "RV2 Manual"** (manually confirmed, then refunded). OPS-04 reused E3. No code,
deploy, provider configuration or migration change was made.

| Rerun | Result | Evidence |
|---|---|---|
| ENV-01 (gate) | PASS | Deployed commit = frozen HEAD `8f37fba` |
| HOST-05 | PASS | BROWSER-CHROMIUM + PROVIDER-TEST. Delivery-log line stays with ENV-04 |
| HOST-08 | PASS | BROWSER-CHROMIUM + WEBKIT |
| OPS-03 | PASS | BROWSER-CHROMIUM |
| OPS-05 | NOT RUN (desktop portion passed) | Real-phone reload of the old link remains. Emulated proxy passed |
| HOST-10 + guest "Download my photos" | NOT RUN (repair verified by automation) | Chromium headless + headed, WebKit. The browser's permission prompt can only be recorded by a human |
| NET-04 (Keep error observation) | Repair verified | BROWSER-CHROMIUM. NET-04 itself stays NOT RUN (real device) |
| Picker (IOS-03, AND-02, VIS-04) | Structure verified | `accept="image/*"`, no `capture`, single file, on guest and demo. Real-device picker remains |
| HOST-04, OPS-04 | PASS (light recheck) | BROWSER-CHROMIUM |
| NET-02 | **FAIL — new defect** | The TUS repair holds. A cut that lands on the reserve or commit request leaves the guest stuck (below) |

**New defect: a failed reserve/commit request leaves the capture sheet stuck (taxonomy B).**
- **What it violates:** NET-02 ("continues or restarts and completes"), NET-01 ("a calm,
  retryable message") and NET-04 ("never stuck").
- **Cause:** `confirmAttempt` in `app/(guest)/e/[token]/capture-slots.tsx` awaits `reserveSlot`
  (line 258) and `commitSlot` (line 293) with no failure branch. When the server-action request
  fails at the network, the promise rejects (`Failed to fetch`, uncaught). The phase stays
  `reserving` ("Keeping…") or `committing` ("Saving…"), with no message and no Retry, even after
  connectivity returns.
- **Reproduced, BROWSER-CHROMIUM:**
  - a 10 s offline cut right after the first TUS chunk. The upload finished, the commit POST
    failed, and the sheet showed "Saving…" for over 120 s. Seen twice on a 10.5 MB file.
  - aborting only the commit request on the standard (non-TUS) path: "Saving…" for over 60 s.
  - aborting only the reserve request: "Keeping…" for over 60 s.
- **What still holds:** no frame is lost and nothing is duplicated. After a reload, "Finish
  shot 1" plus re-picking the photo committed exactly once, in all three stuck sessions.
- **Repair target:** a network failure of reserve or commit should become a retryable attempt
  that reuses the same reserve key, through `lib/capture/attempt.ts`.
- **Regression expectation:** a unit test that a rejected reserve/commit dispatches a retryable
  error, plus a browser or integration check that a failed commit request followed by Retry
  commits once.
- **Rerun after the repair:** NET-02, NET-01's proxy and NET-04's proxy, then SMOKE-01.

**Observation, not a failure:** after capture closes, the guest's "N of 5 kept"
(`app/(guest)/e/[token]/page.tsx:149`) counts only visible photos. A guest with 2 commits, 1
hidden, sees "1 of 5 kept". The all-five-used view (`capture-slots.tsx:395`) counts moderated
slots: one deleted capture still read "5 of 5 kept". No frame is offered or regained either way.
This is a wording inconsistency for triage.

### Repairs after RC `8f37fba`

Repaired in one `/maintain-project` pass (2026-10-01), not yet deployed. The FAIL evidence above
stays as recorded.

- **NET-02 (reserve/commit cut).** Cause confirmed as recorded above: nothing caught a rejected
  reserve or commit request. The Keep sequence now lives in `lib/capture/keep.ts`. Every failure
  ends in an outcome:
  - a reserve or commit request that fails in transit shows "Couldn’t reach FiveFrames. Check
    your connection and tap Retry — your shot is safe." with Retry;
  - a request with no answer after 60 s gets the same message. The request isn't cancelled;
    the timeout just stops an endless spinner.
  - Retry stays idempotent. The persisted reserve key is reused, so a reserve whose response was
    lost returns the same row. After a failed commit, Retry commits the same uploaded
    reservation again without reserving or uploading. A commit that had already landed answers
    `committed` for that row.
  - A reserve that fails on page load no longer throws. The key is kept.
  - Covered by `lib/capture/keep.test.ts` (request lost, response lost and stalled, for reserve
    and commit; Retry after reconnect; five shots through lost responses end at exactly five
    captures; a new photo never commits an earlier upload). A new case in
    `captures.integration.test.ts` runs a lost reserve response and a lost commit response
    through real dev Postgres and Storage, and ends with one committed row and the next slot
    free. The Storage upload path and the TUS `/sign` endpoint are unchanged.
- **"N of 5 kept" after capture closes.** Same root cause as HOST-08: a count taken from the
  visible list. The closed view now counts moderated slots, through `keptFrameCount` in
  `lib/capture/guest-slots.ts`, so it matches the all-five-used view. Covered by
  `guest-slots.test.ts`.

Checkpoint the repaired code as a new release candidate, record its SHA in the run record,
deploy it, then rerun only:

| Rerun | Why |
|---|---|
| NET-02 | Reserve/commit cut leaves the sheet stuck |
| NET-01 (automated proxy, commit request aborted) | Same repair, standard upload path |
| NET-04 (automated proxy, reserve request aborted) | "Never stuck" |
| HOST-08 (light recheck: closed-capture "N of 5 kept" with one hidden capture) | Count wording |
| SMOKE-01 | Always last |

### Targeted rerun on RC `6d8aca8`

`/e2e-validate`, 2026-10-01, against `five-frames.vercel.app`. This covered only the rerun list
above.

- **Gate:** `vercel inspect` and Vercel API metadata show the alias served
  `dpl_FJVHeWHFVhLrX2bUufcTUF4rZ86i` (production, Ready) with `githubCommitSha` `6d8aca84…`, which
  equals local HEAD. The working tree was clean.
- **Baseline at that HEAD:** typecheck ✔, lint ✔, 520/520 tests (52 files, including the
  integration suites against dev Postgres and Storage).
- **Data:** synthetic only, all on R1 "RV2 Main". There were 10 new guest sessions named "RV3 …".
  Two R1 settings were changed for the run. Capture was closed and then reopened for HOST-08 and
  SMOKE-01. Reveal timing was changed to "Immediately" so that SMOKE-01's gallery step works with
  capture open; GAL-03's custom reveal plays this role in the human pass.
- **No changes:** no code, deploy, provider configuration or migration change was made.

| Rerun | Result | Evidence |
|---|---|---|
| ENV-01 (gate) | PASS | Deployed commit = local HEAD `6d8aca8` |
| NET-02 | Repair verified. Case stays NOT RUN (real Android) | BROWSER-CHROMIUM Pixel 7 + BROWSER-WEBKIT iPhone 15 emulation, 10.5 MB JPEG over TUS |
| NET-01 (automated proxy, commit request aborted) | Repair verified. Case stays NOT RUN (real iPhone) | BROWSER-WEBKIT iPhone 15 emulation |
| NET-04 (automated proxy, reserve request aborted) | Repair verified. Case stays NOT RUN (real device) | BROWSER-CHROMIUM Pixel 7 emulation, plus lost-response and stalled-request variants |
| HOST-08 (light recheck) | PASS | BROWSER-WEBKIT guest + BROWSER-CHROMIUM host. Closed view reads "2 of 5 kept" with one capture hidden |
| SMOKE-01 | Automated run passed. Case stays NOT RUN | BROWSER-CHROMIUM host/operator/gallery + BROWSER-WEBKIT guest. It must run last, after the human pass |

**Interruption matrix.** Each row is a fresh guest session that kept one photo, with Retry tapped
only once the connection was back. Every row ended the same way:
- the calm message "Couldn’t reach FiveFrames. Check your connection and tap Retry — your shot is safe." with Retry, or "Photo didn’t upload…" when the cut hit the upload;
- one Retry, then **exactly one** commit;
- the live count and the count after reload both read "4 of 5 shots left · 1 taken", with no "Finish shot" offered;
- no uncaught page error.

| Scenario | Engine | Requests seen | Message shown (after the failed request; sampled about every 1 s) |
|---|---|---|---|
| Cut on the **commit** request of a TUS upload: commit aborted, 10 s offline. This is the exact RC `8f37fba` defect | Chromium | reserve → `/sign` 201 → 2 `PATCH` 204 → commit failed → Retry → commit | 0.1 s (was "Saving…" for over 120 s) |
| 10 s offline right after the first TUS `PATCH` | Chromium | in-flight `PATCH` failed → "Photo didn’t upload…" → Retry → reserve (same key) → `HEAD` 200 → one `PATCH` (resumed) → commit | on screen at the first check, at reconnect |
| 10 s offline right after the first TUS `PATCH` | WebKit | upload finished, commit failed → Retry → commit only (no re-upload) | on screen at the first check, at reconnect |
| Commit request aborted, standard `PUT` path (NET-01 proxy) | WebKit | reserve → `PUT` 200 → commit failed → Retry → commit, no second upload | 0.7 s |
| Reserve request aborted (NET-04 proxy) | Chromium | reserve failed → Retry → reserve → `PUT` → commit | 1.0 s |
| Commit reached the server, its response dropped | Chromium | commit HTTP 200, response lost → Retry → commit answered for the same row | 0.2 s |
| Reserve reached the server, its response dropped | WebKit | reserve HTTP 200, response lost → Retry → reserve with the same key → one `PUT` → commit | 0.4 s |
| Commit request held for 75 s, then released | Chromium desktop | "Saving…" until the 60 s timeout, then the message. Retry waited behind the held request, then both resolved to one capture | 60.1 s |

Host Photos confirmed this server-side. The total went from 10 to 18 photos. Each `rv3 <scenario>`
message appears exactly once (twice for the TUS cut: two sessions), and each RV3 guest has exactly
one card. The dashboard went from 8 to 16 guests.

- **HOST-08 light recheck:** guest "RV3 Kept" (WebKit) kept two photos, and host A hid the
  second.
  - With capture open: "3 of 5 shots left · 2 taken", with slot 2 "Used", only shot 1's image
    shown, and "Take shot 3" offered.
  - After host A closed capture: "Capture has ended. Here’s what you kept." and **"2 of 5 kept"**.
    Only the visible photo is shown and no frame is offered. On RC `8f37fba` the same state read
    "1 of 5 kept".
- **SMOKE-01 (automated):**
  1. Host A reopened capture.
  2. A brand-new WebKit guest, "RV3 Smoke", joined from the capture link and kept one portrait:
     "4 of 5 · 1 taken", stable after reload.
  3. Every surface moved by exactly one:
     - dashboard: guests 17 → 18, photos 20 → 21;
     - host Photos: 20 → 21, and the "rv3 smoke" card is present;
     - gallery link (no session): "18 photos" → "19 photos", with exactly one new capture object;
     - Console after operator O reloaded: committed photos 18 → 19, guest sessions 17 → 18.
  4. No HTTP ≥ 400 response and no page error on any of the four surfaces.

**Defects:** none found in this scope.

---

## Test target

One Vercel deployment of the final intended release code. Every case runs against it.

- **Code:** the frozen release-candidate commit, deployed once. If a fix lands during the pass, the
  commit changes, and the rerun rules under [Results and triage](#results-and-triage) apply.
- **Backend:** the FiveFrames dev/test Supabase project (`five-frames-dev`, `ap-southeast-1`),
  unless the user explicitly changes this later.
- **Payment:** PayMongo **Test mode** only, with a Test-mode webhook registered to this deployment.
  No live keys anywhere. No real money.
- **Cron:** `CRON_SECRET` set on this deployment's environment.
- **No customer Production mutation.** No customer data exists yet. Vercel Production currently
  serves the dev database (a known interim state; see progress.md), so nothing in this pass
  touches a production database.
- **Test data:** synthetic accounts, events and photos only. Use photos you are comfortable
  storing in the dev project.

Browser automation and emulation (Chromium, WebKit, device emulation, user-agent spoofing, network
throttling) do **not** satisfy any case marked *real device*, *in-app* or *real network* below.

---

## Test environment setup checklist

Complete these immediately before the pass, in order. They are configuration, not tests: they
have no PASS field. Identify everything by name and purpose. Never paste a secret value into chat
or into a document.

- [ ] **S-01 Freeze the release candidate.** Choose the commit to validate (normally `main` at
  freeze time). The working tree is clean. Record the full SHA in the run record.
- [ ] **S-02 Choose the Vercel environment.** This is the user's decision:
  - **Option A — Production** (`five-frames.vercel.app`, dev-backed). This is also step 1 of the
    `share_path` deployment order. The drop migration still stays unapplied during the pass.
  - **Option B — Preview.** Production keeps running older code against the same dev database,
    including its daily cron and any webhook pointed at it.
  - Either way, use a stable origin that won't change on redeploy, so the webhook and auth
    redirect stay valid.
- [ ] **S-03 Set environment variables** on the chosen Vercel environment, by name:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` →
    the dev project;
  - `GUEST_SESSION_SECRET`;
  - `PAYMONGO_SECRET_KEY`, `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY` → copied from PayMongo's
    **Test-mode** API keys;
  - `PAYMONGO_WEBHOOK_SECRET` → the signing secret of the S-05 webhook;
  - `CRON_SECRET` → a fresh random value.
  - If any variable changes after deploying, redeploy and redo ENV-01.
- [ ] **S-04 Deploy** the S-01 commit to the S-02 environment. One deployment serves the whole
  pass.
- [ ] **S-05 Register the PayMongo Test-mode webhook** at `<origin>/api/webhooks/paymongo` for
  `checkout_session.payment.paid`. Put its secret in `PAYMONGO_WEBHOOK_SECRET` (S-03). If another
  Test-mode webhook points at a deployment running older code on the same database, disable it
  for the pass, so only the release candidate handles deliveries.
- [ ] **S-06 Supabase Auth URL configuration.** The dev project's redirect allowlist includes
  `<origin>/auth/confirm`, needed for sign-up confirmation and password reset.
- [ ] **S-07 Identities.**
  - **Host A:** an ordinary host. Sign it up fresh in HOST-01 with an inbox you control. It must
    not hold an operator grant.
  - **Operator O:** a different, confirmed dev account, granted with
    `pnpm ops:grant-operator <email>` against the dev project (the only sanctioned grant path).
    O also signs in as a host to own event E3.
- [ ] **S-08 Devices and apps.**
  - A real iPhone on current iOS (Safari), with HEIC photos in its library (the camera's default
    "High Efficiency" format).
  - A real Android phone on current Chrome. A photo of 6 MB or more on it, if available (for
    NET-02).
  - Facebook, Messenger and Instagram: **not needed for this pass.** INAPP-01…03 are DEFERRED
    (see section D).
  - A desktop browser (Chrome), plus Safari or Firefox if available.
  - A printer or a second screen to show the event QR.
- [ ] **S-09 Cron shell.** Load `CRON_SECRET` into an environment variable in your own terminal,
  for CRON-02.
- [ ] **S-10 A genuinely weak network** for NET-03: a crowded venue Wi-Fi, or a weak-signal spot
  on mobile data. Throttling does not count.

### Test events

All are created during the pass on the dev database:

| Event | Owner | Activated by | Used in |
|---|---|---|---|
| **E1** "RV Main" | Host A | PayMongo Test checkout | HOST, IOS, AND, INAPP, NET, GAL, CRON, SMOKE |
| **E2** "RV Manual" | Host A | Operator O, manual confirm, then refunded | OPS-03, OPS-05 |
| **E3** "RV Own" | Operator O | Never (the confirm is refused) | OPS-04 |
| **E4** "RV Capacity" | Host A | Operator O, manual confirm | CAP |

### Run order

Sections are grouped by workflow. Run them in this order, because later cases depend on state that
earlier ones create:

1. Setup S-01 … S-10
2. **A** ENV-01 … ENV-05
3. **B** HOST-01 … HOST-06 (E1 created, paid, capture open)
4. **C** IOS-01 … IOS-05, AND-01 … AND-03
5. ~~**D** INAPP-01 … INAPP-03~~ DEFERRED, not part of this pass (see section D)
6. **I** NET-01 … NET-04
7. **E** GAL-01 (gallery locked while capture is open)
8. **B** HOST-07 (close and reopen), with GAL-02 during the closed period
9. **E** GAL-03 (custom reveal)
10. **B** HOST-08 … HOST-11 (moderation, downloads, state)
11. **E** GAL-04 … GAL-06
12. **F** OPS-01 … OPS-05
13. **G** CAP-01, CAP-02
14. **H** CRON-01 … CRON-03
15. **J** VIS-01 … VIS-04. Note visual issues all along; record them here at the end.
16. **K** SMOKE-01, always last

---

## Existing evidence — do not repeat

These human checks already passed. Each still holds for the release candidate unless code it covers
changes before the freeze; see the invalidation rule below. The evidence type is stated, because
physical-device evidence and emulation evidence are not interchangeable.

| Evidence | Date | Type | What it proves |
|---|---|---|---|
| **Slice 15** visual/taste checks | 2026-09-30 | Human, desktop and phone browsers | Create → Look (desktop studio and phone); Settings → Look's two save models; all seven accents on guest join and Your Five, including marigold; themed guest header balance and legibility; the default event (violet, no image, no hashtag) looks finished |
| **Slice 16** keepsake Share/Save, both families | 2026-10-01 | **Physical, real devices** | iPhone Safari share sheet; Android Chrome share sheet; cancelling the native share sheet and retrying; Save fallback in the Facebook, Messenger and Instagram in-app browsers; saved Single-photo output matches its preview; saved Full Set output matches its preview |
| **Slice 17** signage print-and-scan | 2026-10-01 | **Physical prints, real phones**, busy theme image | QR format scanned on a real iPhone and a real Android phone; table card printed at 7 × 5 in and scanned from table distance; poster scanned from 1–2 m; digital format on a phone or tablet (and a larger screen) scanned by another phone; several accents with nothing themed in the QR's white margin; the Draft placeholder reads as a preview, has no download, and scans to nothing |
| **Slice 18** live dashboard | 2026-10-01 | Human, two browsers/devices, deployed final Slice 18 code | A guest join or committed capture appeared on the host dashboard within seconds without a manual refresh; ~30 s offline kept the tab on the FiveFrames page, not the browser's error page; after reconnection the dashboard recovered by itself and converged to the authoritative state |

The Slice 16 in-app evidence covers keepsake **Save** only. It does not show that a guest can
join, capture, commit or download an original in Facebook, Messenger or Instagram's browser.
That is INAPP-01…03, which are DEFERRED.

**Supporting evidence (automated or emulated; not device proof):**

- Slices 15–18 Playwright/Chromium passes at 390–1440 px: layout, picker states, Look, signage
  preview/download parity, the demo, and dashboard reconnect.
- Integration suites against the real dev Postgres and Storage: 474/474 tests at Slice 18.
- Full Set render performance gate on a Vercel Preview in `sin1`: p95 2,388 ms, peak RSS 563 MB,
  JPEG 137–309 KB (progress.md → Slice 16).

These reduce what the pass must cover. They are not a substitute for any *real device*,
*in-app* or *real network* case.

**Invalidation rule.** If any of these change between the evidence above and the frozen commit,
rerun the matching human checks as extra cases in this file:

- keepsake routes, templates, picker or share/save code (`lib/keepsakes/`,
  `components/ff/keepsakes/`, `lib/share/`, `app/(guest)/e/[token]/keepsake/`) → the Slice 16
  checks;
- signage rendering or the QR (`lib/media/signage*.ts`, `lib/media/qr.ts`, the signage routes) →
  the Slice 17 checks;
- `DashboardLive`, the `/live` route or `lib/events/dashboard-live.ts` → the Slice 18 checks.

As of HEAD `5a1291e`, the only later change to these areas was Slice 17 moving theme-image byte
reading out of `lib/dal/keepsakes.ts` into `lib/dal/event-theme.ts`. That is a refactor, covered
by the keepsake integration suites that passed after it. It is not judged to invalidate the
Slice 16 device evidence.

The repairs after RC `a2a32b1` touch none of these paths. They changed the guest capture screen
and picker, the guest's and host's multi-file original download, the host dashboard and Share-step
payment copy, the Console's payment rows, and the TUS endpoint. Keepsake routes, templates,
picker and share/save code are unchanged (`own-photos.tsx` changed only in "Download my photos"),
as are signage and `DashboardLive`/`/live`. No existing evidence is invalidated.

---

## Final consolidated validation checklist

Each case lists: **Where** (environment/device), **Needs** (prerequisites), **Steps**, **PASS
when**, then **Result** (`NOT RUN` · `PASS` · `FAIL` · `BLOCKED` · `DEFERRED`) and **Evidence /
notes**. `DEFERRED` means the user has accepted the case as a launch risk to verify after launch.
It is never a PASS and does not hold up completion of this pass.

### A. Environment and provider readiness

#### ENV-01 · Deployed build identity
- **Where:** Vercel dashboard or `vercel inspect`
- **Needs:** S-01, S-04
- **Steps:** Open the deployment serving the validation origin. Read its source commit and status.
- **PASS when:** the commit equals the release-candidate SHA in the run record, the status is
  Ready, and the validation origin resolves to this deployment.
- **Result:** PASS
- **Evidence / notes:** 2026-10-01, `vercel inspect` + Vercel API metadata. `five-frames.vercel.app` → `dpl_DFmJTFuV1ieKu64F3tPKqu3QjJT4`, target production, Ready, `githubCommitSha` `a2a32b1…` = run-record SHA.
  - **Targeted rerun, RC `8f37fba`:** `five-frames.vercel.app` → `dpl_GbQ1erMNRZUDFUQw4sFuYCNj9DS2`, target production, Ready, `githubCommitSha` `8f37fba7ed64…` = frozen HEAD = run-record SHA.
  - **Targeted rerun, RC `6d8aca8`:** `five-frames.vercel.app` → `dpl_FJVHeWHFVhLrX2bUufcTUF4rZ86i`, target production, Ready, `githubCommitSha` `6d8aca84a8a9…` = local HEAD (clean tree) = run-record SHA.

#### ENV-02 · Supabase backend identity and schema state
- **Where:** Vercel env settings (names and project ref only), `supabase migration list` against
  the linked dev project
- **Needs:** S-03
- **Steps:**
  1. Confirm the deployment environment's `NEXT_PUBLIC_SUPABASE_URL` points at the
     `five-frames-dev` project.
  2. List migrations against the dev project.
- **PASS when:**
  - the deployment uses the dev project;
  - every migration up to and including `20260930010000_event_theme_raw_formats.sql` is applied;
  - `20260930020000_retire_share_cards.sql` is **not** applied (deliberately, until the
    deployment-order follow-up).
- **Result:** PASS
- **Evidence / notes:** `supabase migration list --linked` (ref `lrheuifbgbplekxnljfv`): all through `20260930010000` applied, `20260930020000` not applied. Deployment's browser Storage traffic (signed upload/read URLs) goes to the same project ref. Env var *values* were not read (permission boundary).

#### ENV-03 · PayMongo Test mode; no live credentials
- **Where:** PayMongo dashboard; Vercel env settings
- **Needs:** S-03
- **Steps:**
  1. In PayMongo, confirm the account view is in Test mode.
  2. Whoever set S-03 confirms that both `PAYMONGO_*` keys came from the Test-mode keys page.
  3. Check that no environment this deployment reads holds a live key.
- **PASS when:** Test mode is on and no live PayMongo credential is configured for the validation
  deployment.
- **Result:** BLOCKED
- **Evidence / notes:** No PayMongo dashboard access; reading the deployment's `PAYMONGO_*` values was refused by the session's permission policy. PayMongo's hosted checkout shows no mode banner. Needs a human dashboard check.

#### ENV-04 · Webhook delivery to the validation deployment
- **Where:** PayMongo dashboard → Webhooks
- **Needs:** S-05; checked again after HOST-05
- **Steps:**
  1. Confirm the Test-mode webhook targets `<origin>/api/webhooks/paymongo`, is enabled, and is
     subscribed to `checkout_session.payment.paid`.
  2. After HOST-05, open its delivery log.
- **PASS when:** the log shows a successful (2xx) delivery to the validation origin for E1's
  payment, with no failed retries.
- **Result:** BLOCKED
- **Evidence / notes:** Depends on HOST-05 payment completion (not performed) and dashboard access.

#### ENV-05 · Public reachability
- **Where:** real phone on mobile data, not signed in to Vercel
- **Needs:** S-04
- **Steps:** Open `<origin>/` and `<origin>/demo`.
- **PASS when:** both load directly, with no Vercel login or deployment-protection wall. Guests
  and PayMongo must be able to reach the deployment.
- **Result:** NOT RUN
- **Evidence / notes:** Automated proxy only (not this case): `/`, `/demo` and every public route return 200 with no Vercel protection wall (curl, 2026-10-01). Real phone on mobile data still required.

### B. Full host journey

Run on a desktop browser unless stated. Host A, event E1.

#### HOST-01 · Sign-up with email confirmation
- **Where:** desktop browser; host A's inbox
- **Needs:** S-06
- **Steps:**
  1. Sign up as host A.
  2. Note what the app shows.
  3. Open the confirmation email and follow its link.
  4. Sign out and sign in again.
- **PASS when:**
  - after sign-up the app says to confirm your email, and does not drop you into a dashboard
    without a session;
  - the link lands on the validation origin (via `/auth/confirm`) signed in;
  - sign-in works afterwards.
- **Result:** NOT RUN
- **Evidence / notes:** Needs a controlled inbox. Not submitted from automation (would send a real confirmation email).

#### HOST-02 · Password reset
- **Where:** desktop browser; host A's inbox
- **Needs:** HOST-01, S-06
- **Steps:**
  1. Sign out, then use "Forgot password".
  2. Open the reset email and set a new password.
  3. Sign in with it.
- **PASS when:** the email arrives; its link opens the reset page on the validation origin; the
  new password works and the old one doesn't.
- **Result:** NOT RUN
- **Evidence / notes:** Needs a controlled inbox.

#### HOST-03 · Create and configure a Draft event (round trip)
- **Where:** desktop browser
- **Needs:** HOST-01
- **Steps:**
  1. Create E1. Set the name, today's date, a time, timezone Asia/Manila and a welcome message.
     Set reveal **After the event**, visibility **Anyone with the link**, and guest keepsakes on.
  2. On Look, pick any accent and, optionally, a theme image. Theme behavior itself is existing
     evidence; this only needs a themed event.
  3. Continue to Share, then reload Settings → Event & gallery and Settings → Look.
- **PASS when:** every value reloads exactly as entered. The event date and time show the same
  local value in the event's timezone, with no shift. The reveal, visibility and sharing labels
  are human-readable.
- **Result:** PASS
- **Evidence / notes:** BROWSER-CHROMIUM, E1 created by E2E host A. Name, date 2026-10-01, Asia/Manila, reveal "When capture closes", visibility "Anyone with the gallery link", teal, hashtag, welcome message, keepsakes on and theme image ("Saved") all reloaded exactly in Settings → Event & gallery and Look; options render labels. The product has no event *time* field (date only); the timezone round trip was exercised by GAL-03 instead.

#### HOST-04 · No usable link before payment; price breakdown
- **Where:** desktop browser
- **Needs:** HOST-03
- **Steps:**
  1. On unpaid E1, look through the dashboard, Share step, Settings → Links and Look → Signage.
  2. Open checkout.
- **PASS when:**
  - no capture link, gallery link, real QR or signage download exists anywhere (Look → Signage
    shows the "Draft preview" placeholder only);
  - checkout shows the ₱999 event price, fees, total and refundability before any redirect;
  - "Pay online" is the primary action;
  - the "Already arranged payment directly with FiveFrames?…" line is informational, with no
    button or form behind it, and there is no way for the host to mark the event paid.
- **Result:** PASS
- **Evidence / notes:** BROWSER-CHROMIUM, unpaid E1. No `/e/` or `/g/` link in the HTML of dashboard, Share, Settings, Links, Photos; Signage shows only "DRAFT PREVIEW" with 0 downloads; all four `/signage/<format>` routes return 404. Share step: ₱999, fees "Included — nothing extra", total ₱999, refund copy; "Pay online · ₱999" is the only button; the "Already arranged…" line has no control.
  - **Light recheck, RC `8f37fba` (BROWSER-CHROMIUM, unpaid R1):** same result. No `/e/` or `/g/` link on dashboard, Share, Settings, Links, Photos or Look. All four signage routes return 404. The Share step shows ₱999, "Included — nothing extra", total ₱999 and the refund copy, with "Pay online · ₱999" as the only button and the "Already arranged…" line with no control. The dashboard card reads "Finish setting up", and no screen says a payment was received.

#### HOST-05 · Checkout, cancel/retry, and webhook activation
- **Where:** desktop browser; PayMongo Test checkout
- **Needs:** HOST-04, ENV-03, ENV-04
- **Steps:**
  1. Pay online. On PayMongo's test checkout, cancel or go back to the app.
  2. Confirm E1 is still unpaid with no links.
  3. Pay online again and complete the payment with a PayMongo test method.
  4. Return to the app and wait for activation. Reload if needed.
- **PASS when:**
  - after the cancel, E1 is unpaid and retryable;
  - after paying, E1 shows Active, with capture link, gallery link, QR and signage downloads, and
    no stale "unpaid" banner;
  - capture is still **closed**;
  - ENV-04's delivery log shows the webhook;
  - OPS-02 later shows exactly **one** provider payment for E1, paid, and not flagged as a
    duplicate.
- **Result:** PASS (RC `8f37fba`). The "delivery log" line is checked under ENV-04, which stays BLOCKED.
- **Rerun evidence, RC `8f37fba` (BROWSER-CHROMIUM + PROVIDER-TEST, R1 "RV2 Main"):**
  - Pay online opened PayMongo's hosted checkout. Its back link returned to Share with "Payment was cancelled. Nothing was charged — you can try again below."
  - The dashboard then read **"Payment not finished"**, with "Continue to payment". Share read "A checkout was started but not finished. Continuing returns you to that same checkout…". There were no links on the dashboard, Share or Links, and no "payment received" wording anywhere.
  - "Continue to payment" → Pay online reopened the **same** PayMongo checkout session.
  - It was paid with PayMongo's documented test Visa (no 3DS) and synthetic contact details. PayMongo redirected to `/events/<id>?checkout=pending` after about 19 s, and the event was already Active then. Nothing else could activate it (no operator action).
  - Afterwards: capture and gallery links, and all four signage downloads (SVG attachments). Capture **Closed**. No "Payment not finished", "Checking your payment" or "payment received" copy.
  - Operator O's direct R1 detail URL (not the cross-host list): one payment, "PayMongo (self-service)", Paid, ₱999, PHP, no duplicate flag. No image in the Console.
  - The test card succeeding also behaves like Test mode. It is not the ENV-03 dashboard check.
- **Original evidence (RC `a2a32b1`):** BROWSER-CHROMIUM. Cancel from PayMongo returns to Share with "Payment was cancelled. Nothing was charged" and Pay online works again. **But the E1 dashboard then says "Payment received — confirming with PayMongo… Payment is being confirmed"** — creating a checkout session leaves a `provider_status = 'pending'` payment that `hasPendingProviderPayment` treats as received (`app/(host)/events/[eventId]/(manage)/page.tsx` notice). Completing the test payment was **not performed** (refused by the session's permission policy), so the activation, no-stale-banner and one-payment criteria are unrun. E1 has two abandoned pending checkout sessions.
  - **Repaired after RC `a2a32b1`; targeted rerun required against the next deployed release candidate.** Cause: the dashboard treated any `pending` provider row, which every started checkout leaves (cancelled or abandoned included, since PayMongo reports neither), as payment received. Now a pending row reads "Payment not finished" with "Continue to payment". Only PayMongo's success redirect shows "Checking your payment with PayMongo". No pre-activation copy says a payment was received. Retry reuse and webhook activation are unchanged. Covered by `lib/payments/draft-payment.test.ts` and `payments.integration.test.ts` (abandoned checkout → unpaid, unfinished, retryable, later webhook activates). Local headed-Chromium check passed. The rerun still needs the completed test payment, ENV-04 and the one-payment check.

#### HOST-06 · Capture stays closed until the host opens it
- **Where:** desktop browser + a phone
- **Needs:** HOST-05
- **Steps:**
  1. Open E1's capture link on a phone.
  2. On the host dashboard, open capture.
  3. Reload the phone.
  4. Download E1's QR or table card and print it, or show it on a second screen, for C.
- **PASS when:** before opening, the phone shows a calm "not open yet" state with no join form.
  After opening, the join form appears.
- **Result:** NOT RUN
- **Evidence / notes:** Host side done; real phone portion and QR print/display remain. Proxy only (not a PASS): BROWSER-WEBKIT (iPhone 15 emulation) on stand-in **E1m "RV Main (manual)"** (activated by OPS manual confirm because HOST-05 payment was not completed; capture gating doesn't depend on payment source, D16). Before opening: "Not open yet… Join opens when capture starts", no join form. After host opens capture: join form appears. QR/print portion not exercised.

#### HOST-07 · Close and reopen capture
- **Where:** desktop browser + the iPhone from C + a private browser window
- **Needs:** C, D and I done; GAL-01 done
- **Steps:**
  1. Close capture on E1.
  2. Reload the iPhone guest page.
  3. Open the capture link in a fresh private window.
  4. Run GAL-02 now.
  5. Reopen capture.
  6. On the iPhone, commit one more photo if a frame remains.
- **PASS when:**
  - while closed: the iPhone guest sees "capture has ended" plus their own photos with downloads,
    and the fresh visitor sees the closed state with no join form;
  - after reopening: the dashboard shows capture open, and the guest can commit again within
    their remaining frames.
- **Result:** BLOCKED
- **Evidence / notes:** Partial, E1m, BROWSER. While closed: guest sees "Capture has ended. Here's what you kept." with own photos and Download; a fresh visitor sees "Capture has ended" with no join form; GAL-02 run. Reopen: dashboard shows Open. Re-commit after reopening was **not demonstrated**: the iPhone-emulated guest got `frames_exhausted` from a pending reservation orphaned by the test harness (lost localStorage), and the pass was stopped by the permission policy before its 30-minute TTL lapsed.

#### HOST-08 · Moderation: hide, unhide, favorite, delete
- **Where:** desktop browser (Photos) + the guest phones
- **Needs:** captures from several guest sessions on E1
- **Steps:**
  1. Favorite one capture.
  2. Hide one of the iPhone guest's captures, then check the iPhone.
  3. Unhide it, then check again.
  4. Hide a different capture and **leave it hidden**.
  5. Delete one capture, confirming the dialog, then check that guest's phone.
- **PASS when:**
  - a hidden capture disappears from its guest's own view and returns after unhide;
  - a deleted capture disappears for good;
  - neither hide nor delete gives that guest a frame back (their remaining frames don't
    increase);
  - dashboard counts follow each change.
- **Result:** PASS (RC `8f37fba`)
- **Rerun evidence, RC `8f37fba` (BROWSER-CHROMIUM host, BROWSER-WEBKIT iPhone-emulated guest, desktop Chromium guest; R1):**
  - Favorite toggled ("Remove favorite" after reload).
  - Hiding the iPhone guest's shot 2 removed it from their view. The slot showed **"Shot 2 used"** and the count stayed "2 of 5 shots left · 3 taken". Unhide restored it, with the same count.
  - Hiding the desktop guest's square (left hidden) kept them at "3 of 5 · 2 taken", with "Shot 2 used".
  - Deleting the iPhone guest's landscape went through the dialog "It won't give the guest their shot back". The capture left Photos for good. The guest stayed at "2 of 5 · 3 taken", with "Shot 3 used".
  - Counts followed each change: Photos "9 photos · … · 1 hidden" → "0 hidden" → "1 hidden" → "8 photos"; the dashboard went 9 → 8.
  - The iPhone guest then kept two more. That reached "All 5 shots in", with 4 photos visible and no frame offered, so the deleted slot still counts.
  - Wording observation (not a failure) is in the rerun section above. Repaired after RC `8f37fba`; light recheck required against the next deployed release candidate (see [Repairs after RC `8f37fba`](#repairs-after-rc-8f37fba)).
  - **Light recheck, RC `6d8aca8` (BROWSER-WEBKIT iPhone-emulated guest, BROWSER-CHROMIUM host; R1): passed.** Guest "RV3 Kept" kept 2 and the host hid the second. With capture open the guest saw "3 of 5 · 2 taken", slot 2 "Used". After capture closed, the guest saw "Capture has ended. Here’s what you kept." and **"2 of 5 kept"**, with only the visible photo and no frame offered. See [Targeted rerun on RC `6d8aca8`](#targeted-rerun-on-rc-6d8aca8).
- **Original evidence (RC `a2a32b1`):** BROWSER-CHROMIUM + WEBKIT, E1m. Favorite toggles; hide removes the photo from its guest's view and unhide restores it; delete (dialog "It won't give the guest their shot back") removes it for good; dashboard/Photos counts follow. **FAIL: the guest's displayed remaining frames increase after hide or delete.** iPhone guest with 4 commits showed "1 of 5 shots left"; after one delete it showed "2 of 5 shots left · 3 taken". Android guest with 3 commits, 1 hidden, showed "3 of 5 shots left · 2 taken"; the hidden slot renders as an empty frame. `taken` counts only visible slots (`capture-slots.tsx`). Server-side refusal was observed (`frames_exhausted`), but whether the server would accept a commit beyond 5 was not verified (pass stopped).
  - **Repaired after RC `a2a32b1`; targeted rerun required against the next deployed release candidate.** Cause: the guest view drops hidden/deleted captures (correctly, §8.3), and the screen then counted those slots as free. The server now also sends the slot numbers of moderated captures (no ids or URLs). Your Five counts them as taken and shows them as "Used". Covered by `lib/capture/guest-slots.test.ts` and `captures.integration.test.ts` (hide, unhide and delete never change the count; UI and server agree; a sixth capture is refused). Local headed-Chromium check passed: hide, then delete plus unhide, both stayed "2 of 5 shots left · 3 taken".

#### HOST-09 · Individual original download
- **Where:** desktop browser (Photos)
- **Needs:** HOST-08
- **Steps:** Use the download control on one tile. Check the saved file.
- **PASS when:**
  - a file saves and the tab stays on Photos (no navigation);
  - the file is the original: for a phone photo its long edge is larger than 1,600 px (the
    display derivative's size), and it matches the guest's photo.
- **Result:** PASS
- **Evidence / notes:** BROWSER-CHROMIUM, E1m. Tile download saved `006-rv-iphone.jpg`, 2400×3200, byte-identical (MD5) to the uploaded fixture; tab stayed on Photos.

#### HOST-10 · Bulk original download and multi-download behavior
- **Where:** desktop Chrome; then Safari or Firefox if available
- **Needs:** HOST-08 (one capture hidden, one deleted)
- **Steps:**
  1. Click "Download all originals". Allow any "multiple downloads" prompt once.
  2. Count the files.
  3. Repeat in a second browser.
- **PASS when:**
  - in each browser, the file count equals the committed, non-deleted captures, **including** the
    hidden one and **excluding** the deleted one;
  - filenames are distinct;
  - at most one browser permission prompt appears. Record it exactly.
  - Downloads dropped silently after allowing the prompt are a FAIL.
- **Result:** NOT RUN (RC `8f37fba`). Automation verified the repair. The browser's own "download multiple files" prompt can only be recorded by a human in real desktop Chrome, then Safari or Firefox.
- **Rerun evidence, RC `8f37fba` (R1, 10 eligible originals including 1 hidden, excluding 1 deleted):**
  - Playwright Chromium headless, Chromium **headed** and WebKit each saved **10 of 10** files, with distinct filenames `001-…`–`010-…`. Every file was byte-identical (MD5) to its upload at full size; the 10.5 MB TUS uploads came back 4000×3000.
  - The hidden capture was included and the deleted one excluded.
  - Each original was a `fetch`, not a navigation: zero main-frame navigations, zero failed requests. The page showed "Downloading N of 10… If your browser asks, allow multiple downloads.", then "10 originals sent to your downloads."
  - Playwright handles downloads itself, so a permission prompt can't appear or be observed. That bullet is the human remainder.
  - **Guest "Download my photos":** the iPhone-emulated guest (4 visible; 1 deleted) got 4 of 4 byte-identical files in WebKit and again in Chromium, with no navigation and "4 photos sent to your downloads.". After capture closed, the desktop guest (1 visible, 1 hidden) got 1 of 1 ("Download my photo", "1 photo sent to your downloads."), with the hidden one excluded.
  - The button appears only once a guest's capture is finished (all five used or capture closed). A real-phone save is still covered by IOS-05 / AND-03.
- **Original evidence (RC `a2a32b1`):** BROWSER-CHROMIUM + BROWSER-WEBKIT (headless), E1m, 6 eligible originals (incl. 1 hidden, excl. 1 deleted). Chromium saved 2 then 4; WebKit saved 4 and 4; filenames distinct; no permission prompt in automation. All 6 original requests were issued as navigations, yet the UI reported **"Saved 6 originals."** `bulk-download-button.tsx` clicks a cross-origin `<a download>` every 300 ms; browsers ignore `download` cross-origin, so later navigations can cancel earlier ones. Confirm on headed desktop Chrome/Safari. The same failure class likely affects the guest's "Download my photos" (`DownloadOwnPhotosButton` in `own-photos.tsx`, the same sequential anchor-click pattern), which no case covers on its own. Include it in the fix.
  - **Repaired after RC `a2a32b1`; targeted rerun required against the next deployed release candidate.** Reproduced locally in headed Chromium: 6 navigations, all `ERR_ABORTED`, 2 of 6 files saved, UI "Saved 6 originals". Cause confirmed: each cross-origin link click navigates the tab, and the next one cancels any whose response hasn't arrived. Host and guest now share `lib/media/save-files.ts`: each original is fetched in full (CORS works on the signed URLs) and saved from a same-origin blob before the next starts. Still sequential signed URLs, no ZIP (D11), same authorization and scope. After the fix, the same headed run saved 6 of 6 full-size originals (hidden included, deleted excluded) with no navigation. The guest's "Download my photos" saved 2 of 2. The note now says "N originals sent to your downloads", not "Saved", because the page can't see what the browser keeps. Covered by `lib/media/save-files.test.ts`. Rerun: headed desktop Chrome, then Safari or Firefox. Record any "download multiple files" prompt exactly, and confirm the guest's "Download my photos" on a real phone.

#### HOST-11 · Event state and counts
- **Where:** desktop browser
- **Needs:** HOST-10
- **Steps:**
  1. Compare E1's dashboard against what the pass created.
  2. Compare with OPS-02.
- **PASS when:**
  - the lifecycle label matches the real state at each stage you observed (Draft → Active →
    Capture open ↔ closed);
  - "N of 250 guests" equals the guest sessions joined on E1;
  - the photo count equals committed minus deleted;
  - the Operator Console shows the same numbers.
- **Result:** BLOCKED
- **Evidence / notes:** Partial: E1m dashboard tracked each state (Draft → Active/closed → Open ↔ Closed) and counts (3 guests; 7 photos, then 6 after a delete). The Operator Console comparison was refused by the session's permission policy.

### C. Guest capture — real devices

Event E1, capture open. Interrupted uploads, weak networks and reload during upload are in
**I. Network resilience**, not repeated here.

**iPhone Safari**

#### IOS-01 · Join from the QR
- **Where:** real iPhone, Safari
- **Needs:** HOST-06
- **Steps:**
  1. Scan the printed or displayed E1 QR with the Camera app.
  2. Read the join screen.
  3. Enter a display name.
- **PASS when:**
  - the link opens in Safari;
  - the join screen states briefly: no app, no account, and that photos follow this event's own
    access rules;
  - after joining, five empty frames show, with no nagging or "use your frames" copy.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (WebKit iPhone emulation, E1m): join copy shows "No app to download · No account — just your first name · Your photos follow this event's own access settings"; after joining, five empty frames and a quiet "5 of 5 shots left". QR scan and real Safari still required.

#### IOS-02 · Camera capture with a message
- **Where:** real iPhone, Safari
- **Needs:** IOS-01
- **Steps:**
  1. Tap a frame and take a **portrait** photo with the camera.
  2. Add a short message on the preview.
  3. Keep the frame.
- **PASS when:**
  - the photo uploads and appears in your own photos with its message;
  - there is no delete or replace control for it;
  - remaining frames show quietly, if at all.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (WebKit): portrait JPEG + message committed and shows in own view with the message; no delete/replace control.

#### IOS-03 · Library photo (HEIC on the device)
- **Where:** real iPhone, Safari
- **Needs:** IOS-01
- **Steps:**
  1. Tap a frame and choose a **landscape** photo the iPhone camera took (normally HEIC on the
     device) from the library.
  2. Keep it, with no message.
- **PASS when:** it commits and appears normally.
  - If it fails after upload with a retry error, record **FAIL** with the photo's format. This is
    the known raw-HEIC follow-up, and whether it blocks launch is decided in triage.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (WebKit): landscape JPEG committed. HEIC can't be exercised in emulation. The proxy set the file directly, which bypasses the picker. The guest input has `capture="environment"`, which on current iOS Safari and Android Chrome may open the camera with no library option. Record exactly what the picker offers; if there's no library option, record FAIL (product.md §16 requires photo-library access).
  - **Picker changed after RC `a2a32b1`:** `capture="environment"` is removed. Guest and demo now share one standard `accept="image/*"` input (`components/ff/photo-picker-input.tsx`). Google's web.dev documents that with `capture`, Android opens the camera with no option to choose an existing picture, and that without it, Chrome and Safari on iOS and Android offer both the camera and existing images. On the rerun, record that both Take Photo and the library are offered.
  - **Structural check, RC `8f37fba` (BROWSER-WEBKIT iPhone 15 + BROWSER-CHROMIUM Pixel 7 emulation):** the deployed guest and `/demo` pages each have exactly one file input, `accept="image/*"`, no `capture` attribute, not `multiple`. "Take shot" and the demo trigger each open a single-file chooser. The demo kept a photo with zero non-GET or Storage requests. What the real iOS/Android picker offers is still this case's real-device check.

#### IOS-04 · Session continuity
- **Where:** real iPhone, Safari
- **Needs:** IOS-02
- **Steps:**
  1. Reload the page.
  2. Close the tab, then reopen the link from the QR.
- **PASS when:** both times it is the same session, with the same name, the same committed photos
  and the same remaining frames.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (WebKit): reload and a new tab in the same cookie jar kept the name, photos and remaining frames.

#### IOS-05 · Original download from your own view
- **Where:** real iPhone, Safari
- **Needs:** IOS-02
- **Steps:** Open your own photo → Original photo → Download. Repeat for a second photo.
- **PASS when:** each original saves (Photos or Files) untouched, at full size and without any
  keepsake design, and the page does not navigate away.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (WebKit): two originals downloaded byte-identical to the uploads at full size; page did not navigate.

**Android Chrome**

#### AND-01 · Join from the QR and camera capture
- **Where:** real Android phone, Chrome
- **Needs:** HOST-06
- **Steps:**
  1. Scan the E1 QR and join.
  2. Take a photo with the camera, add a message and keep it.
- **PASS when:** join behaves as IOS-01 and the capture as IOS-02.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (Chromium Pixel 7 emulation): join + square photo with message committed.

#### AND-02 · Library photo
- **Where:** real Android phone, Chrome
- **Needs:** AND-01
- **Steps:** Choose a landscape or square photo from the library and keep it.
- **PASS when:** it commits and appears in your own photos.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (Chromium): landscape library photo committed (the file was set directly, so the picker was bypassed). Record whether the picker offers the library despite `capture="environment"`; see IOS-03.
  - Picker changed after RC `a2a32b1` (`capture` removed; see IOS-03). Record that both camera and library are offered. Structure verified on RC `8f37fba` (see IOS-03).

#### AND-03 · Session continuity and original download
- **Where:** real Android phone, Chrome
- **Needs:** AND-01
- **Steps:**
  1. Reload the page.
  2. Download one original from your own view.
- **PASS when:** the reload keeps the same session and photos, and the original saves untouched
  without leaving the page.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (Chromium): reload kept the session; original downloaded byte-identical without navigation.

### D. In-app browser capture

For each app, open E1's capture link **inside** the app's own browser. Don't use "Open in browser".
Keepsake Save in these browsers is existing Slice 16 evidence, so it isn't repeated.

> **Scope decision (user, 2026-10-01): DEFERRED — accepted launch risk / post-launch
> verification.** In-app-browser *capture* is not a pre-release gate. INAPP-01…03 don't block
> completion of this pass and are run after launch. The product's compatibility target
> (product.md §16, "common in-app browsers") is unchanged; only the pre-release check is waived.
> The Slice 16 Save evidence does not prove the capture flow in these browsers.
>
> **Code review for confidence only (2026-10-01, HEAD `a2a32b1`; not in-app proof):**
> - No user-agent checks, in-app detection or browser-specific branches exist anywhere in
>   `app/`, `components/`, `lib/` or `proxy.ts`. The only in-app mentions are the keepsake
>   `?download=1` Save fallback.
> - Capture uses a standard `<input type="file" accept="image/*" capture="environment">` (at
>   `a2a32b1`; `capture` was removed afterwards, see IOS-03). The
>   upload is a plain `fetch` PUT, or `tus-js-client` at 6 MB and over. The reserve key uses
>   `crypto.randomUUID()` and `localStorage`, which is in try/catch, so blocked storage only loses
>   reload survival.
> - A single original downloads by plain navigation to a signed URL with an attachment
>   disposition. That is the same mechanism as the Slice 16 keepsake Save fallback, which did
>   work in all three apps.
> - Unknowns that only a real app shows: whether the embedding WebView implements the file
>   chooser, and how it handles `capture` and attachment downloads.
> - Chromium/WebKit proxy runs of join, capture and original download (C, I) passed apart from
>   NET-02. They are not in-app evidence.

#### INAPP-01 · Facebook
- **Where:** real phone, Facebook app's in-app browser
- **Needs:** HOST-06
- **Steps:**
  1. Post or send the E1 link and open it in Facebook.
  2. Join.
  3. Tap a frame. Record which options appear (camera, library).
  4. Commit one photo.
  5. Download its original from your own view.
- **PASS when:** join and the commit succeed in the in-app browser, the photo appears in your own
  view, and its original saves from within the in-app browser.
  - If saving the original only works after leaving the in-app browser, record **FAIL** with the
    exact behavior; triage decides whether it blocks launch.
  - Record every limitation exactly. Don't describe a workaround you didn't perform.
- **Result:** DEFERRED — accepted launch risk / post-launch verification
- **Evidence / notes:** Not run (user scope decision, 2026-10-01). Not a PASS. See the section D note.

#### INAPP-02 · Messenger
- **Where:** real phone, Messenger's in-app browser
- **Needs:** HOST-06
- **Steps:** Send the E1 link in a chat and open it in Messenger. Then do INAPP-01 steps 2–5.
- **PASS when:** same as INAPP-01.
- **Result:** DEFERRED — accepted launch risk / post-launch verification
- **Evidence / notes:** Not run (user scope decision, 2026-10-01). Not a PASS. See the section D note.

#### INAPP-03 · Instagram
- **Where:** real phone, Instagram's in-app browser
- **Needs:** HOST-06
- **Steps:** Send the E1 link in a DM (or another tappable link surface) and open it in Instagram.
  Then do INAPP-01 steps 2–5.
- **PASS when:** same as INAPP-01.
- **Result:** DEFERRED — accepted launch risk / post-launch verification
- **Evidence / notes:** Not run (user scope decision, 2026-10-01). Not a PASS. See the section D note.

### E. Gallery — real phone

Open gallery links on a phone that is **not** signed in as host A.

#### GAL-01 · Locked before reveal
- **Where:** real phone
- **Needs:** E1 capture open; reveal After the event
- **Steps:** Open E1's gallery link.
- **PASS when:** a calm locked state shows, with no photos, no theme image and no hashtag.
- **Result:** NOT RUN
- **Evidence / notes:** Real phone required. Proxy only: BROWSER-CHROMIUM (Pixel 7 emulation), E1m, capture open: "Gallery locked… Still under wraps", 0 capture images, no theme image, no hashtag.

#### GAL-02 · "After the event" reveal on capture close
- **Where:** real phone
- **Needs:** during HOST-07, while capture is closed
- **Steps:** Reload the gallery link.
- **PASS when:** the gallery opens and shows the committed, unhidden photos.
- **Result:** NOT RUN
- **Evidence / notes:** Real phone required. Proxy only: BROWSER-CHROMIUM, E1m, capture closed: "Gallery is open", 7 photos (all committed, none hidden yet), no names, no download control.

#### GAL-03 · Custom reveal time
- **Where:** desktop browser (Settings) + real phone
- **Needs:** HOST-07 done (capture open again)
- **Steps:**
  1. In Settings → Event & gallery, set reveal to **Custom**, about 5 minutes ahead in the event's
     timezone. Save.
  2. Reload Settings.
  3. Open the gallery link before the time.
  4. Reload it after the time.
- **PASS when:**
  - Settings reloads the same local time;
  - before the time the gallery is locked and shows the scheduled time;
  - after the time it opens, while capture is still open.
  - (The dashboard flipping by itself is existing Slice 18 evidence.)
- **Result:** NOT RUN
- **Evidence / notes:** Settings round trip (desktop) proven; real phone gallery views remain. Proxy for phone part: BROWSER-CHROMIUM, E1m. Custom reveal 14:33 Asia/Manila (06:33 UTC); Settings reloaded `2026-10-01T14:33`. Before: locked with "Thu, Oct 1 · 2:33 PM". After: open with 5 photos while capture stayed open.

#### GAL-04 · Revealed gallery and viewer, mixed orientations
- **Where:** real iPhone (Android optional)
- **Needs:** HOST-08 (one capture hidden, one deleted, one favorited); gallery revealed
- **Steps:**
  1. Open the gallery.
  2. Open a photo; swipe through several; close the viewer.
- **PASS when:**
  - portrait, landscape and square photos display undistorted;
  - the hidden and deleted captures are absent, and the favorited one is present;
  - the viewer opens, swipes both ways and closes back to the grid;
  - no photographer names and no download control appear.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (WebKit iPhone emulation, E1m): 5 photos; hidden and deleted absent, favorite present; grid tiles `object-fit: cover`, viewer `contain` at exact aspect ratios (0.75/1.33/1.00/0.67); no names, no download. Viewer swipe/close not verified (pass stopped). Real iPhone still required.

#### GAL-05 · "Only me" denies the link holder
- **Where:** desktop browser (Settings) + real phone
- **Needs:** GAL-04
- **Steps:**
  1. Set visibility to **Only me** and reload the gallery link on the phone.
  2. Set it back to **Anyone with the link**.
- **PASS when:** under Only me, the phone gets the private/denied state with no photos and no
  theme image. Access returns after switching back.
- **Result:** BLOCKED
- **Evidence / notes:** Not run: further reads of the deployment were refused by the session's permission policy.

#### GAL-06 · Invalid, rotated and revoked links
- **Where:** desktop browser (Settings → Links) + real phone
- **Needs:** GAL-05
- **Steps:**
  1. Change one character of the gallery link's token and open it.
  2. Rotate the gallery link, then open the old link and the new one.
  3. Revoke the link and open the new one again.
  4. Rotate once more and keep that link for SMOKE-01.
- **PASS when:**
  - the altered link gets a calm not-found;
  - after rotation the old link is denied and the new one works;
  - after revoke the link is denied;
  - the final rotation works.
- **Result:** BLOCKED
- **Evidence / notes:** Not run: further reads of the deployment were refused by the session's permission policy.

### F. Operator / manual payment

Automated (provider-side) refund execution is **out of scope**. Refunds are executed outside the
app and recorded through the Operator Console (D17).

#### OPS-01 · An ordinary host can't reach the Console
- **Where:** desktop browser
- **Needs:** host A signed in; then signed out
- **Steps:**
  1. As host A, open `/operator` and `/operator/events/<E1 id>`.
  2. Sign out and open `/operator`.
- **PASS when:** host A gets "We can't find that page" on both, and nothing reveals that the
  Console exists. Signed out, you are redirected to login.
- **Result:** PASS
- **Evidence / notes:** BROWSER-CHROMIUM. Host A on `/operator` and `/operator/events/<id>`: "We can't find that page", no Console chrome. Signed out: `/operator` → 307 `/login?next=/operator`.

#### OPS-02 · Cross-host visibility, metadata only
- **Where:** desktop browser, operator O
- **Needs:** E1 activated; E3 created by O
- **Steps:**
  1. Open `/operator`. Search by E1's name, then by host A's email.
  2. Open E1's detail.
- **PASS when:**
  - the list includes events from at least two hosts (host A's and O's own);
  - both searches find E1;
  - E1's detail shows lifecycle, payment state and source (exactly one paid provider payment, not
    flagged duplicate), activation, guest sessions vs cap, aggregate capture and moderation
    counts, capture state, reveal and visibility, and the hosted-until, grace-until and permanent
    deletion rows;
  - **no** guest photo and no theme image appears anywhere in the Console.
- **Result:** BLOCKED
- **Evidence / notes:** The cross-host Console list contains non-test hosts' events on this dev-backed Production; reading it was refused by the session's permission policy.

#### OPS-03 · Manual confirmation activates, with an audit record
- **Where:** desktop browser, operator O; then host A
- **Needs:** E2 created by host A and left unpaid
- **Steps:**
  1. On E2's Console detail, open the confirm form. Leave a required field empty and try to
     submit.
  2. Fill in method, amount 999, paid-at and a note. Open the confirmation dialog, then Cancel.
  3. Submit again and confirm.
  4. As host A, open E2.
- **PASS when:**
  - the missing field is flagged before the dialog;
  - Cancel leaves the form untouched;
  - after confirming, E2 is Active, and host A sees its capture link, QR and signage downloads,
    with capture closed;
  - the payment row shows source manual, method, amount and currency, paid-at in the event's
    timezone, confirmed-at, confirmed-by O, and the note.
- **Result:** PASS (RC `8f37fba`)
- **Rerun evidence, RC `8f37fba` (BROWSER-CHROMIUM, R2 "RV2 Manual", operator O):**
  - Empty Amount: native "Please fill out this field." and no dialog.
  - Filled with Bank transfer, 999, paid-at `2026-10-02T00:30` (Manila; a UTC previous-day boundary) and a note. The dialog read "Confirm this manual payment? This activates the event and issues its guest link and QR immediately.". Cancel left all four values untouched.
  - Confirm, then reload. The Console row shows:
    - Source Manual · Method Bank transfer (verified) · Status Confirmed · Amount ₱999 · Currency PHP;
    - **Paid at "Fri, Oct 2, 2026 · 12:30 AM"** (round trip exact);
    - Confirmed at "Thu, Oct 1, 2026 · 5:37 PM" · **Confirmed by** the E2E operator's email;
    - the note.
  - Host A then saw R2 Active, capture **Closed**, a capture link, and all four signage downloads (attachments).
- **Original evidence (RC `a2a32b1`):** BROWSER-CHROMIUM, E2 "RV Manual". Empty Amount blocked by native `required` validation before any dialog; dialog Cancel left method/amount/paid-at/note untouched; confirm activated E2; host A sees capture link, QR and all four signage downloads (SVG attachments) with capture closed. **FAIL: the Console payment row shows only Source, Status, Amount and Note.** Paid-at, confirmed-at and confirmed-by are never rendered (`PaymentAttempt` in `app/(operator)/operator/events/[eventId]/page.tsx`). The paid-at timezone round trip (entered 00:30 Manila, a UTC day-boundary case) could not be checked in the UI.
  - **Repaired after RC `a2a32b1`; targeted rerun required against the next deployed release candidate.** Cause: every field was stored and selected but never rendered, and `confirmed_by`/`refunded_by` were bare user ids. The Console now shows source, method, status, amount, currency, paid-at, confirmed-at and confirmed-by (operator email), note, refunded-at, refunded-by and refund note, in the event's timezone. Covered by `lib/payments/audit.test.ts` and `payments.manual.integration.test.ts` (confirm then refund, with a day-boundary paid-at). Local headed-Chromium check passed: 00:30 Manila showed as "Fri, Oct 2, 2026 · 12:30 AM".

#### OPS-04 · An operator can't confirm their own event
- **Where:** desktop browser, operator O
- **Needs:** E3 created by O as host, unpaid
- **Steps:** On E3's Console detail, try to confirm a manual payment.
- **PASS when:** the confirm is refused with a clear message, E3 stays unpaid, and no payment row
  is created.
  - The own-event *refund* refusal is covered by integration tests and isn't run here.
- **Result:** PASS
- **Evidence / notes:** BROWSER-CHROMIUM, E3 "RV Own" (owned by operator O): alert "You cannot confirm payment for an event you own."; E3 stays Unpaid, "No payment attempt yet".
  - **Light recheck, RC `8f37fba` (BROWSER-CHROMIUM, same E3):** the same refusal alert. After a reload E3 is still Unpaid, "No payment attempt yet", and the reworked payment section renders no row.

#### OPS-05 · Manual refund disables links, with an audit record
- **Where:** desktop browser, operator O; real phone
- **Needs:** OPS-03. Before refunding, open E2's capture link on the phone once.
- **Steps:**
  1. On E2's Console detail, record a refund with a note.
  2. Reload the Console.
  3. As host A, open E2.
  4. Reload E2's old capture link on the phone.
- **PASS when:**
  - E2 is back to unpaid/Draft, and host A sees no links and the Pay online checkout again;
  - the old capture link shows a calm not-found;
  - the payment shows Refunded, with refunded-at, refunded-by O and the note;
  - no false "duplicate payment" banner appears.
- **Result:** NOT RUN (RC `8f37fba`; desktop portion passed). Remaining: step 4's reload of the old capture link on a real phone.
- **Rerun evidence, RC `8f37fba` (BROWSER-CHROMIUM; R2 after OPS-03):**
  - Before the refund, R2's capture link opened in a Pixel 7-emulated Chromium on "Not open yet".
  - Operator O recorded a refund with a note. The dialog read "Record this refund as completed? The event returns to unpaid and its guest link and QR stop working immediately.".
  - After a Console reload: header Unpaid; Status **Refunded**; Refunded at "Thu, Oct 1, 2026 · 5:37 PM"; **Refunded by** the E2E operator's email; refund note shown. The original confirmation rows are kept, and the confirm form is offered again.
  - Host A: R2's dashboard reads "Finish setting up". There are no `/e/` or `/g/` links on the dashboard, Links or Share. "Pay online" appears on Share. Signage returns 404.
  - No "duplicate" wording on the Console or the host dashboard.
  - Reloading the old capture link in the same emulated session showed the calm "We can't find this event · Double-check the link". That is proxy only; the real phone is still required.
  - The old E2 from the RC `a2a32b1` pass is still Active and was not used.

### G. Capacity

#### CAP-01 · A new guest past the cap sees a calm "full" state
- **Where:** iPhone + Android + a desktop private window
- **Needs:**
  - E4 created by host A, activated by O's manual confirm, capture opened by host A;
  - `guest_session_cap = 2` set for **E4 only**, by a dev-database data update (there is no UI
    control). Record how it was set.
- **Steps:**
  1. Join E4 on the iPhone and on the Android phone.
  2. Check the dashboard.
  3. Open E4's link in the desktop private window.
- **PASS when:**
  - the dashboard reads "2 of 2 guests";
  - the third visitor sees the calm "This event is full for now" state, with no join form and no
    error tone.
- **Result:** BLOCKED
- **Evidence / notes:** Setting `guest_session_cap = 2` on E4 was refused by the session's permission policy. E4 "RV Capacity" is activated (manual confirm), capture closed, cap unchanged.

#### CAP-02 · Already-joined guests keep normal access
- **Where:** iPhone (joined in CAP-01)
- **Needs:** CAP-01
- **Steps:**
  1. Reload E4 on the iPhone.
  2. Commit a photo.
- **PASS when:** the guest is still in the same session, with their frames, and the commit
  succeeds. The guest count stays at 2.
- **Result:** BLOCKED
- **Evidence / notes:** Depends on CAP-01.

### H. Lifecycle cron

The route runs on a daily schedule (`vercel.json`). These cases invoke it manually and never wait
for the schedule. Nothing else in the lifecycle depends on cron (architecture §4, D18).

#### CRON-01 · Missing or wrong secret is rejected
- **Where:** your terminal
- **Needs:** S-04
- **Steps:**
  1. `curl -i <origin>/api/cron/lifecycle`
  2. The same, with `-H "Authorization: Bearer wrong"`.
- **PASS when:** both return **401** `{"error":"Unauthorized"}`.
- **Result:** PASS
- **Evidence / notes:** curl 2026-10-01: no header → `401 {"error":"Unauthorized"}`; `Bearer wrong` → same.

#### CRON-02 · Authorized request succeeds
- **Where:** your terminal (S-09); desktop browser, operator O
- **Needs:** CRON-01
- **Steps:**
  1. In E1's Console detail, record hosted-until, grace-until and the permanent-deletion row.
  2. Run `curl -i -H "Authorization: Bearer $CRON_SECRET" <origin>/api/cron/lifecycle`.
- **PASS when:**
  - it returns **200** with JSON containing `reservationsExpired`,
    `permanentDeletionsProcessed`, `permanentDeletionsSucceeded` and `failures`;
  - `failures` is empty;
  - every event counted as processed really has an elapsed grace period. Expect 0 for this dev
    data, and record the numbers.
- **Result:** BLOCKED
- **Evidence / notes:** Needs the deployment's `CRON_SECRET` in a human shell (S-09). Note: the cron affects every event on this database, including non-test events.

#### CRON-03 · An unaffected event is unchanged
- **Where:** desktop browser (operator O, host A)
- **Needs:** CRON-02
- **Steps:**
  1. Reload E1's Console detail.
  2. As host A, open E1's Photos and download one original.
- **PASS when:**
  - hosted-until, grace-until and the permanent-deletion row are identical to before;
  - E1's photos are all present;
  - the original downloads.
- **Result:** BLOCKED
- **Evidence / notes:** Depends on CRON-02.

### I. Network resilience

Real networks and real devices only. Browser throttling is not venue validation. Dashboard
reconnect isn't rerun here: the Slice 18 evidence stands unless its invalidation rule triggers.

#### NET-01 · Interrupted upload and retry (standard path)
- **Where:** real iPhone, Safari, E1
- **Needs:** IOS-01; a frame free
- **Steps:**
  1. Choose a photo and keep it.
  2. Turn on Airplane Mode while the upload is in progress. Observe.
  3. Turn Airplane Mode off and retry.
- **PASS when:**
  - the interruption shows a calm, retryable message, and no frame is consumed while it fails;
  - after the retry exactly **one** new photo exists, in your own view and in host Photos;
  - the frame count is consistent.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (WebKit, aborted Storage PUT): calm "Photo didn't upload. Check your connection and tap Retry — your shot is safe.", no frame consumed; Retry committed exactly once (2 PUTs, remaining 2 → 1, stable after reload).
  - RC `8f37fba` rerun finding: that proxy aborted only the Storage PUT. Aborting the **commit** request on this same standard path leaves the sheet on "Saving…" with no retryable message (see NET-02 and the rerun section). Rerun this proxy after the repair. Repaired after RC `8f37fba`; targeted rerun required against the next deployed release candidate (see [Repairs after RC `8f37fba`](#repairs-after-rc-8f37fba)).
  - **Proxy rerun, RC `6d8aca8` (BROWSER-WEBKIT iPhone 15 emulation, R1): repair verified.** The commit request was aborted after the `PUT` landed. The calm "Couldn’t reach FiveFrames. Check your connection and tap Retry — your shot is safe." showed with Retry within 0.7 s. Retry sent one commit and no second upload. The guest showed "4 of 5 · 1 taken", stable after reload, and exactly one card in host Photos. The real-iPhone Airplane Mode run remains. See [Targeted rerun on RC `6d8aca8`](#targeted-rerun-on-rc-6d8aca8).

#### NET-02 · Interrupted large upload (resumable path)
- **Where:** real Android phone, Chrome, E1
- **Needs:** AND-01; a photo of 6 MB or more; a frame free
- **Steps:**
  1. Keep the large photo.
  2. Mid-upload, cut all connectivity for about 10 s, then restore it.
- **PASS when:** the upload continues or restarts and completes without a duplicate or a lost
  frame. Exactly one new capture exists.
  - With no photo of 6 MB or more available, record **BLOCKED** (no large file).
- **Result:** NOT RUN (real Android). Automated proxy repair verified on RC `6d8aca8`. History: FAIL on RC `a2a32b1` (TUS endpoint), FAIL on RC `8f37fba` (reserve/commit cut left the guest stuck).
- **Rerun evidence, RC `6d8aca8` (BROWSER-CHROMIUM Pixel 7 + BROWSER-WEBKIT iPhone 15 emulation, R1, 10.5 MB JPEG over TUS): repair verified.**
  - **The RC `8f37fba` defect:** the commit request of a TUS upload was aborted and the browser went offline for 10 s. The calm "Couldn’t reach FiveFrames…" with Retry showed within 0.1 s (it had been "Saving…" for over 120 s). After reconnecting, one Retry sent one commit and no re-upload.
  - **10 s offline after the first `PATCH`, Chromium:** "Photo didn’t upload…" → Retry → reserve with the same key → `HEAD` 200 → one resumed `PATCH` → one commit.
  - **The same cut in WebKit:** the upload finished, the cut landed on the commit, and Retry re-committed only.
  - **Every run:** exactly one capture ("4 of 5 · 1 taken", stable after reload, one card in host Photos), with no uncaught page error.
  - The lost-response and stalled-request variants are in [Targeted rerun on RC `6d8aca8`](#targeted-rerun-on-rc-6d8aca8).
  - Still needs the real-Android interrupted run.
- **Rerun evidence, RC `8f37fba` (BROWSER-CHROMIUM Pixel 7 + BROWSER-WEBKIT iPhone 15 emulation, R1, 10.5 MB JPEG):**
  - **Repair verified:**
    - `POST …/upload/resumable/sign` → 201, then 6 MB `PATCH`es → 204.
    - Uninterrupted (WebKit): committed in about 19 s.
    - Cut while the first chunk was in flight (Chromium), 10 s offline: the calm "Photo didn't upload. Check your connection and tap Retry — your shot is safe." Retry after reconnecting sent `HEAD` 200 (resume) and the rest of the `PATCH`es, then **exactly one** commit ("4 of 5 · 1 taken", stable after reload).
    - WebKit, with the cut after chunk 1 landed: Retry → `HEAD` → **one** `PATCH` (resumed from the offset) → one commit.
    - Host bulk download returned every TUS original byte-identical (HOST-10).
  - **New defect:** in two Chromium runs, a 10 s cut right after the first chunk landed on the **commit** request. `POST /e/<token>` failed with `ERR_INTERNET_DISCONNECTED`, and the sheet stayed on **"Saving…" for over 120 s after reconnection**, with no message and no Retry.
  - No frame was lost and nothing was duplicated. After a reload, "Finish shot 1" plus re-picking the photo committed exactly once.
  - Still needs the real-Android interrupted run after the repair.
  - **Repaired after RC `8f37fba`; targeted rerun required against the next deployed release candidate.** A failed or stalled reserve/commit request now ends in Retry, and Retry reuses the same reserve key or uploaded reservation. See [Repairs after RC `8f37fba`](#repairs-after-rc-8f37fba).
- **Original evidence (RC `a2a32b1`):** BROWSER-CHROMIUM + BROWSER-WEBKIT, 10.5 MB JPEG (≥ 6 MB → TUS path), reproduced 3 times on 3 sessions. The TUS create `POST <ref>.storage.supabase.co/storage/v1/upload/resumable` returns **400 `{"statusCode":"403","code":"AccessDenied","message":"Invalid Compact JWS"}`** before any byte is sent, with or without a network interruption. The guest sees "Check your connection and tap Retry" and retrying never succeeds; no frame is consumed. **Every photo of 6 MB or more is currently impossible to keep.** Re-run on a real Android phone after the fix.
  - **Repaired after RC `a2a32b1`; targeted rerun required against the next deployed release candidate.** Cause: the client posted the `x-signature` token to `/storage/v1/upload/resumable`, which in Supabase Storage only takes a JWT bearer. Signed TUS uploads live under `/upload/resumable/sign` (supabase/storage `src/http/routes/tus`). Reproduced against dev Storage: the bare endpoint gives `400 Invalid Compact JWS`, `/sign` gives `201`. The endpoint now carries `/sign`. The resume fingerprint also includes the reservation's object path, so a re-picked file can't resume into an earlier reservation's object. `captures.resumable.integration.test.ts` uploads a 10+ MB JPEG through real dev Storage with the browser's exact options: interrupt after the first chunk, retry with the same key, resume, exactly one commit; a failed upload consumes no frame. It fails with the original 400 when the fix is reverted. Local headed Chromium kept a 6.7 MB photo over TUS with exact bytes. Still needs the real-Android interrupted run.

#### NET-03 · Genuinely weak network
- **Where:** real phone(s) on the S-10 network
- **Needs:** a session with a frame free (a new session on E1 is fine)
- **Steps:**
  1. Record the place, network type and signal.
  2. Commit one or two photos, retrying if prompted.
- **PASS when:**
  - each photo either commits, or shows a calm retry that then commits;
  - no duplicate capture appears, and no frame is lost;
  - the conditions are recorded.
- **Result:** NOT RUN
- **Evidence / notes:** Real network required.

#### NET-04 · Backgrounding and reload during an upload
- **Where:** real iPhone and/or Android, E1
- **Needs:** frames free
- **Steps:**
  1. Start an upload, switch to another app for about 30 s, then return.
  2. Start another upload and reload the page mid-upload.
- **PASS when:** each time the state settles as **either** committed **or** frame still
  available, never both and never stuck. A retry on an available frame commits exactly once.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (Chromium, upload held, page reloaded mid-upload): settled as frame still available with "Finish shot"; resuming reused the persisted reserve key and committed exactly once. Observation: if a guest's pending reservation outlives their localStorage, the UI offers a free frame but Keep returns `frames_exhausted` and **shows no message** (the error is set, then cleared by `resetAttemptUI()` in `capture-slots.tsx`) until the 30-minute TTL lapses.
  - **Repaired after RC `a2a32b1`; targeted rerun required against the next deployed release candidate.** (error visibility only). Attempt state now goes through `lib/capture/attempt.ts`. An attempt that ends without a commit (all five used, capture ended, attempt lapsed) clears the photo and keeps its message until the guest chooses a photo, discards or taps Keep/Retry. Covered by `lib/capture/attempt.test.ts`. Local headed-Chromium check passed: "Capture has ended." was still shown 4 s after Keep. The orphaned-reservation case itself is unchanged: a free-looking frame still refuses until the TTL lapses, now with a visible message.
  - **Rerun, RC `8f37fba` (BROWSER-CHROMIUM, R1) — error persistence repair verified.** A guest had a photo in preview, the host closed capture, then the guest tapped Keep. "Capture has ended." was on screen at +1, +4, +10 and +20 s, and the preview was cleared. After a reload: "Capture has ended. Here's what you kept."
  - **New finding against this case's "never stuck":** a reserve or commit request that fails at the network leaves the sheet stuck on "Keeping…" or "Saving…" (see NET-02 and the rerun section). NET-04 stays NOT RUN (real device) and must be rerun after that repair. Repaired after RC `8f37fba`; targeted rerun required against the next deployed release candidate (see [Repairs after RC `8f37fba`](#repairs-after-rc-8f37fba)).
  - **Proxy rerun, RC `6d8aca8` (BROWSER-CHROMIUM Pixel 7 emulation + WebKit/desktop variants, R1): "never stuck" repair verified.**
    - Reserve request aborted: "Couldn’t reach FiveFrames…" with Retry within 1 s. Retry → reserve → `PUT` → one commit.
    - Reserve response lost after the server handled it (WebKit): Retry reused the same key and got one reservation, one `PUT` and one commit.
    - Commit held for 75 s: "Saving…" until the 60 s timeout, then the message and Retry. Retry waited behind the held request, and both resolved to one capture.
    - Each run settled at "4 of 5 · 1 taken" after reload, with one card in host Photos.
    - Backgrounding and reload on a real phone remain.

### J. Visual sign-off

These approvals were pending from the design passes (progress.md). Note visual issues throughout
the pass and record them here. A taste rejection is a FAIL with notes, handled as design work.

#### VIS-01 · Brand identity
- **Where:** real phone + desktop (light and dark browser themes); iPhone home screen
- **Needs:** none
- **Steps:**
  1. Check the logo lockup's size and alignment in each header: marketing, auth, host (with the
     Host tag), guest, Operator (with the Operator tag), demo, and 404.
  2. Check the browser-tab icon in light and dark themes.
  3. Add the site to the iPhone home screen.
- **PASS when:** the user approves all three.
  - The printed table card is existing Slice 17 evidence.
- **Result:** NOT RUN
- **Evidence / notes:** Human taste approval.

#### VIS-02 · Marketing motion
- **Where:** a real laptop with a trackpad or mouse; Safari and Firefox desktop; a real phone
- **Needs:** none
- **Steps:**
  1. On `/`, judge whether the five-print hero reads as FiveFrames and feels calm and weighted.
  2. Check that Safari and Firefox render the prints crisply (shadows, tilt).
  3. On the phone, check that the hero entrance and the "Why five" drop-in feel light and
     scrolling doesn't jank.
  4. Turn on the OS "Reduce motion" setting and reload.
- **PASS when:** the user approves 1–3, and with Reduce motion on the homepage is fully still.
- **Result:** NOT RUN
- **Evidence / notes:** Human taste approval.

#### VIS-03 · Contracted handoff redesign and desktop composition
- **Where:** real phone + desktop at 1024, 1280 and 1440
- **Needs:** the screens visited during B–F
- **Steps:**
  1. Judge whether guest, host, auth, gallery and demo screens read as the contracted handoff.
  2. Look specifically at host screens (events list, create wizard, event Dashboard, Photos,
     Settings) and the Operator Console at desktop widths. These were never visually audited.
  3. On a real phone's Preview sheet, check keyboard behavior, and that the guest header sits
     under the status bar without overlap.
- **PASS when:** the user approves. Any screen that doesn't read as the handoff is recorded by
  name.
- **Result:** NOT RUN
- **Evidence / notes:** Human taste approval. Objective proxy: no horizontal overflow at 390/1024/1280/1440 on public, auth, 404, guest, gallery and host pages (Chromium).

#### VIS-04 · Public demo on a real phone
- **Where:** real phone, `/demo`
- **Needs:** none
- **Steps:**
  1. Pick your own photo from the library and keep it. Fill a few frames.
  2. Look at the keepsake section (optional taste check).
  3. Tap Start over.
  4. Tap "Create your event".
- **PASS when:**
  - the picker works;
  - the page states demo photos stay on the device;
  - Start over clears every frame;
  - the CTA goes to sign-up;
  - nothing presents itself as a real event link or QR.
  - The keepsake taste note is optional and doesn't affect the result.
- **Result:** NOT RUN
- **Evidence / notes:** Proxy (Chromium Pixel 7 emulation): own photos via "Use your own photo" kept 3 frames; copy says photos stay on the device; Start over → 5 of 5; CTA → `/signup`; no `/e/` or `/g/` link; zero non-GET or Storage requests (D14). Real phone picker still required. The demo input also has `capture="environment"`; check that the library is offered (see IOS-03).
  - Picker changed after RC `a2a32b1` (`capture` removed; shares the guest input; see IOS-03). Local Chromium at 390 and 1280: own photo → preview → Keep, zero non-GET or Storage requests. Real-phone picker still required. Deployed structure verified on RC `8f37fba` (see IOS-03).

### K. Final smoke pass

Not a second matrix. It only proves the final environment still joins up after everything above.

#### SMOKE-01 · Host → Guest → Gallery → Operator
- **Where:** desktop (host A, operator O) + a phone in a fresh private tab
- **Needs:** every case above run
- **Steps:**
  1. Host A opens E1's dashboard and opens capture if it is closed.
  2. A brand-new guest joins E1 from the QR or link and commits one photo.
  3. Open the newest gallery link from GAL-06.
  4. Operator O reloads E1's detail.
- **PASS when:**
  - the guest's photo appears in host Photos and in the gallery;
  - the dashboard and the Console both show one more guest session and one more photo;
  - no step errors.
- **Result:** NOT RUN. The automated run passed on RC `6d8aca8`. SMOKE-01 is always last, so it runs again after the human/real-device pass, with a real phone.
- **Evidence / notes:**
  - **RC `a2a32b1`:** not run (pass stopped; the Console step was refused).
  - **Automated run, RC `6d8aca8` (BROWSER-CHROMIUM host A + operator O + a sessionless gallery tab, BROWSER-WEBKIT iPhone 15 emulated guest; R1 with reveal set to "Immediately").**
    - Host A reopened capture.
    - New guest "RV3 Smoke" joined from the capture link and kept one photo: "4 of 5 · 1 taken", stable after reload.
    - Host Photos went 20 → 21, and the photo is shown.
    - Dashboard: guests 17 → 18, photos 20 → 21.
    - Gallery link: 18 → 19 photos, with one new capture.
    - Console after operator O reloaded: committed photos 18 → 19, guest sessions 17 → 18.
    - No HTTP error or page error at any step.

---

## Results and triage

- **Record** the result and the evidence on each case. Evidence can be screenshots, device and OS
  versions, times, and PayMongo log entries. Leave out secrets, tokens and full private URLs.
  Then update the case count under Purpose.
- **BLOCKED** means the case could not run (no device, no large file, an environment problem).
  Give the reason. It is never a PASS.
- **FAIL:** record it and keep going if later cases don't depend on it. Fixes happen outside the
  pass, through `/maintain-project` or `/build-app`, with regression coverage. A fix creates a
  new release candidate. Record the new SHA, redeploy, then rerun:
  - the failed case;
  - every case touching the changed code;
  - any existing evidence the change invalidates;
  - SMOKE-01.
- **Done** means every case is PASS, BLOCKED with the user's explicit acceptance, or DEFERRED by
  the user's explicit decision (currently INAPP-01…03), and no launch-blocking FAIL remains. Then record a one-line outcome in progress.md. The next lifecycle
  step is `/release-review`.

---

## Superseded and not-repeated checks (audit)

Older checklists that this file replaces. Their history stays in progress.md and git.

| Older check | Disposition |
|---|---|
| Slice 10 Web Share checklist (share card, 6 items) | **Superseded** by Slice 16 keepsake Share/Save real-device evidence. The share card is retired |
| Old Slice 14 §7 Web Share | **Superseded** by Slice 16 evidence |
| Old Slice 14 §3 physical QR and signage, all formats | **Superseded** by Slice 17 physical print-and-scan evidence |
| Slice 8 "all four signage formats render the required copy" | **Superseded** by Slice 17 (rebuilt, themed renderer; physical scans) |
| Brand identity: "one printed table card" | **Superseded** by Slice 17 print, which carries the outlined lockup |
| Redesign checklist item 7: "a newly generated share card" | **Obsolete.** The share card no longer exists |
| Slice 18 live update, offline and recovery | **Passed** 2026-10-01; not repeated |
| Slice 2 real-device capture (2026-09-21), Slice 3 resumable upload (2026-09-21), Slice 8 real PayMongo checkout (2026-09-22) | **Historical.** Earlier code (capture UI, checkout and payments have changed since). Re-covered by C, D, I and HOST-05 |
| Old Slice 14 H1 / §1 | → ENV-03, ENV-04 |
| Old Slice 14 H2 / §2, §10 | → HOST-03 … HOST-11 |
| Old Slice 14 H3, H4 / §4, §5 | → IOS-01 … IOS-05, AND-01 … AND-03 |
| Old Slice 14 H5 / §6 | → INAPP-01 … INAPP-03 |
| Old Slice 14 H6 / §8 | → GAL-01 … GAL-06 |
| Old Slice 14 H7 / §9 | → OPS-01 … OPS-05 |
| Old Slice 14 H8 / §12 | → CAP-01, CAP-02 |
| Old Slice 14 H9 / §13 | → CRON-01 … CRON-03 |
| Old Slice 14 §11 network, plus the network parts of H3/H4 | → NET-01 … NET-04 |
| Redesign visual-approval checklist items 1–6 | → C, E, HOST-02 … HOST-10, VIS-03 (functional parts are in the workflow sections) |
| Redesign item 7 (Operator Console dialogs, wrong URL, icons) | → OPS-01, OPS-03, VIS-01 |
| Brand identity, marketing motion and desktop/browser passes: pending human sign-off | → VIS-01, VIS-02, VIS-03 |
| Optional "if convenient" sanity checks for Slices 5, 7, 11 and 12 | → GAL-05/06, OPS-01/02, HOST-09/10, CRON-01…03 |
| Slice 18 optional demo keepsake taste check | → VIS-04 (optional part) |
