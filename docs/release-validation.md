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

**Status: NOT RUN.** 52 cases, 0 run.

### Run record

Fill in at the start of the pass. Never record a secret, a link token, or a full capture or
gallery URL in this file.

| Field | Value |
|---|---|
| Release-candidate commit (full SHA) | |
| Vercel environment used (Production or Preview) | |
| Deployment origin (no tokens) | |
| Supabase project | `five-frames-dev` (expected) |
| PayMongo mode | Test (expected) |
| Date(s) of the pass | |
| Tester(s) | |

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
  - Facebook, Messenger and Instagram installed and signed in on at least one phone.
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
5. **D** INAPP-01 … INAPP-03
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

---

## Final consolidated validation checklist

Each case lists: **Where** (environment/device), **Needs** (prerequisites), **Steps**, **PASS
when**, then **Result** (`NOT RUN` · `PASS` · `FAIL` · `BLOCKED`) and **Evidence / notes**.

### A. Environment and provider readiness

#### ENV-01 · Deployed build identity
- **Where:** Vercel dashboard or `vercel inspect`
- **Needs:** S-01, S-04
- **Steps:** Open the deployment serving the validation origin. Read its source commit and status.
- **PASS when:** the commit equals the release-candidate SHA in the run record, the status is
  Ready, and the validation origin resolves to this deployment.
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

#### ENV-03 · PayMongo Test mode; no live credentials
- **Where:** PayMongo dashboard; Vercel env settings
- **Needs:** S-03
- **Steps:**
  1. In PayMongo, confirm the account view is in Test mode.
  2. Whoever set S-03 confirms that both `PAYMONGO_*` keys came from the Test-mode keys page.
  3. Check that no environment this deployment reads holds a live key.
- **PASS when:** Test mode is on and no live PayMongo credential is configured for the validation
  deployment.
- **Result:** NOT RUN
- **Evidence / notes:**

#### ENV-04 · Webhook delivery to the validation deployment
- **Where:** PayMongo dashboard → Webhooks
- **Needs:** S-05; checked again after HOST-05
- **Steps:**
  1. Confirm the Test-mode webhook targets `<origin>/api/webhooks/paymongo`, is enabled, and is
     subscribed to `checkout_session.payment.paid`.
  2. After HOST-05, open its delivery log.
- **PASS when:** the log shows a successful (2xx) delivery to the validation origin for E1's
  payment, with no failed retries.
- **Result:** NOT RUN
- **Evidence / notes:**

#### ENV-05 · Public reachability
- **Where:** real phone on mobile data, not signed in to Vercel
- **Needs:** S-04
- **Steps:** Open `<origin>/` and `<origin>/demo`.
- **PASS when:** both load directly, with no Vercel login or deployment-protection wall. Guests
  and PayMongo must be able to reach the deployment.
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

#### HOST-09 · Individual original download
- **Where:** desktop browser (Photos)
- **Needs:** HOST-08
- **Steps:** Use the download control on one tile. Check the saved file.
- **PASS when:**
  - a file saves and the tab stays on Photos (no navigation);
  - the file is the original: for a phone photo its long edge is larger than 1,600 px (the
    display derivative's size), and it matches the guest's photo.
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Evidence / notes:**

#### IOS-04 · Session continuity
- **Where:** real iPhone, Safari
- **Needs:** IOS-02
- **Steps:**
  1. Reload the page.
  2. Close the tab, then reopen the link from the QR.
- **PASS when:** both times it is the same session, with the same name, the same committed photos
  and the same remaining frames.
- **Result:** NOT RUN
- **Evidence / notes:**

#### IOS-05 · Original download from your own view
- **Where:** real iPhone, Safari
- **Needs:** IOS-02
- **Steps:** Open your own photo → Original photo → Download. Repeat for a second photo.
- **PASS when:** each original saves (Photos or Files) untouched, at full size and without any
  keepsake design, and the page does not navigate away.
- **Result:** NOT RUN
- **Evidence / notes:**

**Android Chrome**

#### AND-01 · Join from the QR and camera capture
- **Where:** real Android phone, Chrome
- **Needs:** HOST-06
- **Steps:**
  1. Scan the E1 QR and join.
  2. Take a photo with the camera, add a message and keep it.
- **PASS when:** join behaves as IOS-01 and the capture as IOS-02.
- **Result:** NOT RUN
- **Evidence / notes:**

#### AND-02 · Library photo
- **Where:** real Android phone, Chrome
- **Needs:** AND-01
- **Steps:** Choose a landscape or square photo from the library and keep it.
- **PASS when:** it commits and appears in your own photos.
- **Result:** NOT RUN
- **Evidence / notes:**

#### AND-03 · Session continuity and original download
- **Where:** real Android phone, Chrome
- **Needs:** AND-01
- **Steps:**
  1. Reload the page.
  2. Download one original from your own view.
- **PASS when:** the reload keeps the same session and photos, and the original saves untouched
  without leaving the page.
- **Result:** NOT RUN
- **Evidence / notes:**

### D. In-app browser capture

For each app, open E1's capture link **inside** the app's own browser. Don't use "Open in browser".
Keepsake Save in these browsers is existing Slice 16 evidence, so it isn't repeated.

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
- **Result:** NOT RUN
- **Evidence / notes:**

#### INAPP-02 · Messenger
- **Where:** real phone, Messenger's in-app browser
- **Needs:** HOST-06
- **Steps:** Send the E1 link in a chat and open it in Messenger. Then do INAPP-01 steps 2–5.
- **PASS when:** same as INAPP-01.
- **Result:** NOT RUN
- **Evidence / notes:**

#### INAPP-03 · Instagram
- **Where:** real phone, Instagram's in-app browser
- **Needs:** HOST-06
- **Steps:** Send the E1 link in a DM (or another tappable link surface) and open it in Instagram.
  Then do INAPP-01 steps 2–5.
- **PASS when:** same as INAPP-01.
- **Result:** NOT RUN
- **Evidence / notes:**

### E. Gallery — real phone

Open gallery links on a phone that is **not** signed in as host A.

#### GAL-01 · Locked before reveal
- **Where:** real phone
- **Needs:** E1 capture open; reveal After the event
- **Steps:** Open E1's gallery link.
- **PASS when:** a calm locked state shows, with no photos, no theme image and no hashtag.
- **Result:** NOT RUN
- **Evidence / notes:**

#### GAL-02 · "After the event" reveal on capture close
- **Where:** real phone
- **Needs:** during HOST-07, while capture is closed
- **Steps:** Reload the gallery link.
- **PASS when:** the gallery opens and shows the committed, unhidden photos.
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Evidence / notes:**

#### GAL-05 · "Only me" denies the link holder
- **Where:** desktop browser (Settings) + real phone
- **Needs:** GAL-04
- **Steps:**
  1. Set visibility to **Only me** and reload the gallery link on the phone.
  2. Set it back to **Anyone with the link**.
- **PASS when:** under Only me, the phone gets the private/denied state with no photos and no
  theme image. Access returns after switching back.
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

#### OPS-04 · An operator can't confirm their own event
- **Where:** desktop browser, operator O
- **Needs:** E3 created by O as host, unpaid
- **Steps:** On E3's Console detail, try to confirm a manual payment.
- **PASS when:** the confirm is refused with a clear message, E3 stays unpaid, and no payment row
  is created.
  - The own-event *refund* refusal is covered by integration tests and isn't run here.
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

#### CAP-02 · Already-joined guests keep normal access
- **Where:** iPhone (joined in CAP-01)
- **Needs:** CAP-01
- **Steps:**
  1. Reload E4 on the iPhone.
  2. Commit a photo.
- **PASS when:** the guest is still in the same session, with their frames, and the commit
  succeeds. The guest count stays at 2.
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Evidence / notes:**

#### NET-02 · Interrupted large upload (resumable path)
- **Where:** real Android phone, Chrome, E1
- **Needs:** AND-01; a photo of 6 MB or more; a frame free
- **Steps:**
  1. Keep the large photo.
  2. Mid-upload, cut all connectivity for about 10 s, then restore it.
- **PASS when:** the upload continues or restarts and completes without a duplicate or a lost
  frame. Exactly one new capture exists.
  - With no photo of 6 MB or more available, record **BLOCKED** (no large file).
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Evidence / notes:**

#### NET-04 · Backgrounding and reload during an upload
- **Where:** real iPhone and/or Android, E1
- **Needs:** frames free
- **Steps:**
  1. Start an upload, switch to another app for about 30 s, then return.
  2. Start another upload and reload the page mid-upload.
- **PASS when:** each time the state settles as **either** committed **or** frame still
  available, never both and never stuck. A retry on an available frame commits exactly once.
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Evidence / notes:**

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
- **Result:** NOT RUN
- **Evidence / notes:**

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
- **Done** means every case is PASS, or BLOCKED with the user's explicit acceptance, and no
  launch-blocking FAIL remains. Then record a one-line outcome in progress.md. The next lifecycle
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
