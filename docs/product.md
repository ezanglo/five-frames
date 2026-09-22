# FiveFrames — Product Definition

Status: ready for technical bootstrap
Last updated: 2026-09-23 (resolved the pre-confirmation host-facing state for supplier-assisted/manual payment, §7.2; no separate persisted "arranged" lifecycle state)
Initial market: Philippines

---

## 1. Executive Summary

FiveFrames is a mobile-first web app for capturing shared moments at any live event — weddings, birthdays, parties, reunions, trips, company gatherings, and other shared occasions. Every guest gets a deliberately small allowance of captures — **exactly five photos** — collected into a private event gallery owned by the host.

The limit is the product, not a storage restriction. The intent is that guests capture a few moments that actually matter to them, then put the phone away and enjoy the event. FiveFrames is explicitly **not** an unlimited shared album and **not** a social feed.

Guests join by scanning a QR code or opening an event link. They enter a display name, receive an anonymous session, and immediately see their available frames. No accounts, no email, no OTP, no app install.

Hosts are the only people with accounts. A host creates and configures an event, pays a one-time fee, opens capture at the venue, and later moderates, reveals, downloads and shares the gallery.

---

## 2. Product Vision

> FiveFrames helps event guests contribute a handful of genuinely meaningful moments — and helps hosts receive a curated, guest-eyed record of the occasion — by making captures scarce instead of unlimited.

The long-term bet is that a small, high-signal collection is more valuable than a large, noisy one: valuable enough to build post-event products on (Replay, photobook) rather than just hosting files.

---

## 3. Target Users and Market

**Initial market:** Philippines. Peso pricing, local payment methods (GCash, Maya, cards), venue conditions with congested Wi-Fi and mobile data.

**Buyer / host:** whoever is organizing the event and wants a curated collection of it — an engaged couple planning a wedding, a family member organizing a birthday or reunion, a coordinator or planner setting up the event on someone else's behalf, or a company/team organizing a group event or trip. Comfortable with a phone and a browser; not technical.

**Guest:** an event attendee of any age with a smartphone. May be on iOS or Android, using Safari, Chrome, or a common in-app browser (Facebook, Messenger, Instagram). Will not install anything. Will not create an account. May have weak or intermittent connectivity at the venue.

---

## 4. Product Principles

These principles constrain feature decisions and UI copy. They are product requirements, not preferences.

1. **Scarcity is the feature.** Each guest session gets exactly five photo frames. The count is not configurable, not purchasable, and not extendable.
2. **Calm over engagement.** No streaks, leaderboards, badges, progress nags, reminders to "finish your frames", or any mechanic designed to increase usage.
3. **Unused frames are a success, not a failure.** The UI must never imply the guest is behind or wasting something.
4. **Copy tone: "capture what matters", not "you still have 3 left."** Remaining frames may be shown factually and quietly; they must not be framed as an unfinished task.
5. **Presence beats browsing.** Default behavior keeps guests from scrolling other people's photos during the event.
6. **Private by default.** Media is never placed behind guessable public URLs, and nothing becomes broadly viewable without an explicit host action.
7. **Never hold memories hostage.** The host can always download their media before anything expires.
8. **No AI during capture.** AI may assist post-event curation later; it must never appear in the guest capture flow, and must never fabricate memories, alter faces, or invent captions.
9. **Trust is stated up front, briefly.** The guest entry/join screen must clearly and concisely communicate that no app is required, no account is required, and that a guest's captures belong to this event and follow the event's own access rules. This is short interface copy, not a privacy policy, and must not claim stronger privacy guarantees than the access model in §8 actually provides.

---

## 5. Roles

| Role | Identity | Core capabilities |
|---|---|---|
| **Host** | Registered account (single owner per event) | Create/configure event, pay, open and close capture, reveal gallery, moderate (hide/unhide/delete/favorite), download, configure sharing and gallery visibility, rotate/revoke links, request cancellation/refund, renew hosting |
| **Guest** | Anonymous browser session + display name, scoped to one event | Join via QR/link, capture/select and commit up to 5 photos, add an optional short message per capture, view and download **their own** captures, share own captures when the host allows, view the revealed gallery if the host shared the gallery link and visibility permits |
| **Gallery viewer** | Possession of the gallery link (no session required) | View the revealed gallery when visibility is "anyone with the link" |
| **Demo visitor** | No identity, no session, nothing persisted | Try the five-frame capture interaction and a resulting sample gallery using sample/demo or non-persistent local content only (see §7.1). Cannot create, pay for, or distribute a real event. |
| **Operator** | An internal FiveFrames administrator or staff account, explicitly authorized by FiveFrames; not tied to a single event or host account | Via the Operator Console (§5.1): list/search events and inspect operational state across all events for support purposes; confirm a supplier-assisted/manual payment (§7.2, §7.2.1) only after actually receiving and verifying funds; execute and record manual refunds for manually collected payments (§15.1). Cannot confirm payment or refund for an event they themselves own. |

The operator role is internal to FiveFrames, not a customer-facing account type, and is not part of the host/guest permission model — it exists solely to keep payment confirmation for manual sales outside the host's own control. Operator status is granted explicitly by FiveFrames; it is never acquired automatically. Being a paying customer or an event host never grants manual-payment confirmation authority on its own — a host who is separately and explicitly authorized as an operator still cannot confirm or refund payment for an event they themselves own. At launch, FiveFrames expects to have only one or a very small number of operator accounts (see Open Questions).

**Co-hosts are out of scope for MVP.** One owning host account per event. Shared logins are not an intended workflow; the "my partner and our coordinator both need access" case is a known post-MVP gap (see Future Ideas).

### 5.1 Operator Console

FiveFrames requires a small internal tool — the **Operator Console** — so authorized operators (§5) can understand and support real events without directly querying production databases or relying on several provider dashboards (payment provider, Supabase, hosting platform) for ordinary customer-support questions.

**What it is:** an internal operations tool for FiveFrames staff.

**What it is not:** a customer-facing host dashboard, and not a general-purpose admin/BI platform. It is not CRM software, accounting software, a POS/cash-drawer system, a marketing dashboard, a general BI/analytics suite, infrastructure monitoring, a replacement for the payment provider's, Supabase's, or Vercel's own operational dashboards, or a general RBAC/organization-management product. It must not accumulate speculative charts or metrics merely because it is shaped like a dashboard.

**The Console is the required interface for privileged operator actions.** Confirming a supplier-assisted/manual payment (§7.2, §7.2.1) and recording a manual refund (§15.1) happen through the Operator Console — there is no other sanctioned, undocumented way to perform them. This keeps those mutations server-authoritative and auditable (Invariant §12.13), consistent with how activation and payment confirmation already work.

**Operator visibility spans all events, all hosts.** Ordinary customer-support questions ("what's the status of this guest's event", "did this payment go through", "is capture still open") are not limited to events on the manual-payment path, so operator list/search and detail visibility is not restricted to a payment-related subset.

#### 5.1.1 MVP capabilities

Prefer read-only visibility except for the explicitly authorized mutations below. An authorized operator can:

- List and search events, across all hosts.
- Identify the host and the basic event information needed for support (event name, date, owning host).
- See the event's lifecycle state (§7).
- See payment state and payment source — self-service (provider) vs. supplier-assisted/manual (§7.2) — and the payment/reference information already captured in the auditable manual payment record (§7.2.1).
- See whether event activation succeeded.
- See joined guest-session count and the event's configured capacity (§9.5).
- See aggregate capture and moderation counts (counts only — see privilege boundaries below on guest media).
- See capture open/closed state (§7.3).
- See gallery reveal/visibility state (§7.4, §8.2).
- See relevant retention/expiry state (§15.2), as those lifecycle capabilities are implemented.
- Confirm a supplier-assisted/manual payment (mutation; unchanged rule that an operator cannot confirm for an event they own).
- Record a manually executed refund (mutation; same ownership restriction).

This list is expected to grow incrementally as later MVP capabilities (e.g. retention/expiry) are implemented, rather than the Console being designed as a complete future back office up front (see Roadmap, out of scope for this document).

#### 5.1.2 Privilege boundaries

The Operator Console must not become a general "god mode" over customer events. Being an authorized operator, and having access to the Console, does not by itself grant the ability to:

- impersonate a host;
- change event ownership;
- grant a guest additional frames, or otherwise change the five-frame invariant (§12.12);
- bypass payment confirmation — the existing rule that a host can never self-declare payment (§7.2) is unchanged;
- arbitrarily force an event active outside the confirmed-payment paths already defined in §7.2;
- edit a customer's event configuration merely because the actor is an operator;
- delete customer media as an ordinary support action — this differs from the host's own moderation capability (§11.2), which remains host-only;
- browse private guest photography by default. The Console shows aggregate capture/moderation counts and operational metadata, not guest media.

**Operator access to actual guest media is explicitly out of scope for this addition.** If staff access to private media is ever needed for customer support, that is a separate, consequential privacy/product decision requiring its own explicit authorization and audit requirements — it is not something this change, or a future incremental Console update, introduces on its own.

The existing rule that an operator cannot confirm a manual payment or execute a refund for an event they themselves own is unchanged (§5, §15.1).

---

## 6. Identity Model

**Guest identity is per browser session, per event.** A guest session is created when someone opens the event link and enters a display name. The session carries the guest's frame allowance and their private view of their own captures.

**Decision — session loss:** if a guest clears storage, switches devices, or loses the session, they are treated as a **new participant with a fresh allowance**. There is no recovery code, no phone number, no email, and no account. This is a deliberate trade: join friction stays at zero, and a determined person can obtain extra frames.

Consequences that the rest of the product must respect:

- All limits are enforced **per guest session**, never "per person". Wording in the product and in analytics must not claim otherwise.
- Host-visible "guest count" means **guest sessions that joined**, not verified humans.
- A guest who loses their session also loses their private view of previously submitted captures. Those captures remain in the host's gallery and are unaffected.

---

## 7. Event Lifecycle

States are meaningful product concepts and drive what each role can do.

| State | How it is entered | Guest capture | Gallery | Notes |
|---|---|---|---|---|
| **Draft** | Host creates event | Closed | None | Full configuration allowed. No event link, no QR, no guest preview. |
| **Pending payment** | Host starts checkout | Closed | None | Awaiting payment confirmation. |
| **Active** | Payment succeeds | Closed until host opens | Hidden until reveal | Event link and printable QR are issued here. Host may still edit configuration. |
| **Capture open** | Host explicitly opens capture | Open | Hidden unless revealed | Typically opened at the venue. |
| **Capture closed / Ended** | Host closes capture, or automatic safety-net close fires | Closed | Per reveal setting | Gallery, moderation, downloads and sharing continue. |
| **Expired** | 12 months of hosted access elapses | Closed | Read-only / unavailable | Host downloads remain available through the grace period. |
| **Archived / Deleted** | Grace period ends, or host deletes | Closed | Gone | Media permanently deleted. |

### 7.1 Pre-purchase demo

**Decision:** FiveFrames offers a public demo so a prospective host can understand the guest capture experience and the resulting gallery before paying.

- Accessible without payment and without a host account.
- Demonstrates the core mechanic: capturing into five frames and seeing the resulting gallery experience.
- Uses sample/demo content, or a non-persistent local demonstration on the visitor's own device — not real guest-submitted media, and nothing durable stored server-side against a real guest identity.
- **The demo never creates a real, activated event.** It is not a draft event, does not enter the lifecycle table above, and has no event record a host could later "finish" into a real event.
- **The demo never issues a real capture link or gallery link.** Anything shareable from within the demo (if anything is shareable at all) must be unambiguously marked as a demo and must not function as a working event or gallery link.
- The demo does not weaken Invariant §12.7 (payment before an event link or QR exists) — no path through the demo produces a distributable link or QR without payment.
- The demo is not a free-event tier: it cannot be used to actually run, distribute, or collect real guest captures for an occasion. It exists to preview the concept only.
- The demo must not allow unbounded persistent media storage or upload abuse (e.g., an anonymous visitor repeatedly uploading arbitrary real files that get retained). Sample content and any local/non-persistent demonstration mechanics are left to architecture and design.

### 7.2 Payment and activation

- A host may **create and fully configure a draft event before paying**.
- There is **no guest-experience preview before payment** in MVP.
- FiveFrames supports two paths to activation, both reaching the same paid/active state:
  1. **Self-service online payment** — the host pays directly through the configured payment provider ("Pay online"). Activation is triggered by the provider's own trusted confirmation of a successful payment.
  2. **Supplier-assisted / manual payment** — used when FiveFrames has arranged the sale directly with the host through a direct conversation (host, couple, coordinator, family, or organizer) and accepts cash or another explicitly agreed offline payment. Activation is triggered **only** when an authorized FiveFrames operator confirms — after actually receiving and verifying the payment — that it was received (§7.2.1).
- **The host can never self-declare payment and activate an event.** Under both paths, activation always originates from a source external to and independent of the host: the payment provider (path 1), or an authorized FiveFrames operator (path 2). A host cannot mark their own event as paid.
- The **event link and printable QR are issued only after payment is confirmed**, through either path. An unpaid or unconfirmed event can never be distributed to guests.
- Payment failure (path 1) or payment not yet confirmed (path 2) leaves the event in draft/pending-payment. Nothing is activated and no links are issued.
- Before payment, the host must be shown a clear breakdown: the FiveFrames event price, any processing/service fees (path 1) or the agreed amount (path 2), the total, and which amounts are refundable versus non-refundable.

**What the host sees before a manual payment is confirmed.** Supplier-assisted/manual payment is an off-platform commercial arrangement between FiveFrames and the host — it does not create a separate persisted "arranged" or "pending confirmation" lifecycle state merely to represent that a conversation or arrangement took place. An unpaid event remains in the same unpaid/pending-payment state (§7 lifecycle table) regardless of which path the host may pursue, until an operator actually confirms receipt (§7.2.1). The ordinary unpaid checkout screen shows one lifecycle state, communicated as:

- **Primary action: "Pay online."** Self-service checkout remains available to every unpaid host, including one who has separately arranged payment directly with FiveFrames — arranging manual payment never disables or hides online payment.
- **Secondary explanatory copy**, for hosts who already arranged payment directly with FiveFrames, to the effect of: "Already arranged payment directly with FiveFrames? Your event will activate once we confirm receipt." This copy is informational only. It must not let the host declare or mark their own payment as made, must not create or update any manual-payment record, must not notify anyone or trigger activation by itself, must not reserve or flag the event as paid, and must not become a self-service "request manual payment" workflow. It is calm, factual wording layered on the existing unpaid state — not a new state, status value, or workflow.

### 7.2.1 Manual payment record

For supplier-assisted/manual payments, FiveFrames keeps an auditable payment record with enough information to identify:

- the event the payment is for,
- the amount and currency,
- the payment method/category (e.g., cash, manually verified bank transfer, another explicitly accepted offline arrangement),
- the date the payment was made,
- the date the payment was confirmed,
- which authorized FiveFrames operator confirmed it,
- an optional transaction/reference/note (e.g., a bank reference or receipt note), where appropriate.

This is internal operational data that makes manual confirmation auditable — it is not an invoice, receipt-generation feature, or accounting record for the host. How it is stored is an architecture decision (§17); the product requirement is that this information exists and is auditable per manual payment, not how it is persisted.

Manual payment may include cash, a manually verified bank transfer, or another explicitly accepted offline arrangement. Personal-wallet-to-personal-wallet transfers (e.g., paying into a personal GCash/Maya account) are **not the primary or default payment method** — the default customer-facing path is "Pay online" through the provider. Manual payment is a deliberate, FiveFrames-initiated exception for specific early sales, not a general alternative that hosts can request or choose for themselves.

### 7.3 Capture window

**Decision:** capture is **host-controlled to open**, with a manual close and an automatic safety-net close.

- Payment activates the event but does **not** open guest capture.
- The configured event date/time does **not** automatically open capture.
- The host explicitly opens capture when ready, typically at the venue.
- The host may close capture manually at any time, and may re-open it while the event is still within the safety-net window.
- If the host forgets, FiveFrames automatically closes capture a fixed grace period after the event's configured end/date (launch policy parameter, expected 48–72 hours). After the automatic close, capture cannot be re-opened.
- While capture is closed, a guest opening the event link sees a calm explanatory state, not an error.

### 7.4 Gallery reveal

- The gallery is **hidden by default** and becomes viewable only on reveal.
- Reveal options: **after the event (default)**, immediately, or a custom reveal time.
- Reveal is independent of capture being open or closed; the host may reveal while capture is still open if they choose.
- Reveal makes the **gallery link** live, subject to the visibility setting below.

---

## 8. Access and Privacy Model

### 8.1 Two separate links

1. **Event (capture) link + printable QR** — what guests scan at the venue. Grants the ability to join and capture while capture is open.
2. **Gallery (view-only) link** — a distinct link the host can share, including with people who never attended. It is not the capture link.

Both links are long and unguessable. The host can rotate or revoke either link if it leaks.

### 8.2 Gallery visibility

Host-selected, with two tiers:

- **Anyone with the gallery link** — possession of the link is the credential. No PIN, no invitation flow.
- **Only me (host)** — the gallery link does not grant access; only the host account can view.

The "guests only" tier was explicitly rejected: with anonymous, browser-scoped sessions it cannot be enforced beyond "holds a session on this browser", and the label would promise more privacy than it delivers.

### 8.3 Guest access to their own captures

Independent of gallery visibility, a guest **always retains a private view of the captures submitted in their own session** — viewable and downloadable — for as long as that session exists and the event has not expired. Gallery visibility governs seeing **other people's** captures, not your own.

Exception: if the host hides or deletes a specific capture, it is removed from the guest's view as well.

### 8.4 Media protection

- Media must not be reachable at obviously guessable public URLs.
- Media is served through short-lived, access-checked URLs.
- Deriving a share asset (see §10) must not expose the gallery or other guests' captures.

---

## 9. Frames, Commitment and Limits

### 9.1 The allowance

Each guest session receives exactly **5 photo frames**. Fixed. Not configurable by the host, not purchasable, not extendable.

There is no video capture in MVP. Guests capture photos only. (Video is a future idea — see §18 Post-MVP.)

### 9.2 Capture flow

```
Guest opens event link / scans QR
↓
Enters display name → anonymous session created
↓
Sees 5 photo slots
↓
Capture or select a photo
↓
Preview, optionally add a short message
↓
Confirm ("keep frame")
↓
Upload (direct to storage)
↓
System safely accepts the media
↓
Frame is consumed — capture appears in guest's own view
```

A native picker/camera flow is acceptable and preferred where it is more reliable than an in-browser capture UI. Cross-device reliability outranks capture polish.

### 9.3 Commitment is final

**Decision:** once a guest confirms a capture and the system has accepted it, **that frame is permanently consumed for that guest session**. No undo, no delete-by-guest, no replace.

- The host may hide or delete any capture from the gallery; this never returns a frame to a guest.
- Finality governs **guest-initiated** undo. The only circumstance in which a frame returns is when the system could not safely accept the media at all (failed or abandoned upload) — in that case nothing was ever committed.
- Rationale: scarcity is the entire mechanic, and a restorable frame turns "keep frame" into "try again".
- The UI must make the confirmation step clear enough that this is fair — the guest sees a preview and an explicit confirm before anything is committed.

### 9.4 Message text

Each capture may carry one optional short message from the guest. Messages are part of the capture, subject to the same moderation (hiding a capture hides its message) and are inputs to post-event products later.

### 9.5 Event capacity (fair-use boundary)

The five-frame allowance is per guest session (§9.1); it does not by itself bound how large one flat-price event can grow. A launch-scale boundary is needed so a single paid event cannot scale without limit.

**Launch capacity hypothesis:** up to **250 joined guest sessions per event**, implying a theoretical maximum of **1,250 committed guest captures** per event (250 sessions × 5 frames).

- This is a **launch hypothesis to validate** through load testing and early real events — not an eternal product constant, and not something the product should treat as permanently fixed the way the 5-photo allowance is (§9.1, §12).
- It is a fair-use boundary on **event size**, distinct from and in addition to the per-session frame limit.
- **Reaching the cap is calm and non-destructive:** guest sessions already admitted to the event are completely unaffected and keep their full remaining allowance. A new guest attempting to join once the event is at capacity sees a calm, factual "this event is currently full" state — not an error — and is not charged, blamed, or told the event failed.
- Reaching the cap does not close capture for existing guests, does not delete or hide anything, and does not affect the host's ability to moderate, reveal, or download.
- The host should be able to see when an event is near or at capacity, but MVP does not need pricing tiers or a paid way to raise the cap — that is out of scope for this change.

---

## 10. Sharing

Sharing is **host-controlled** and **enabled by default**.

- **What it is:** guests may use FiveFrames' in-app sharing flow to generate and share a branded/custom-frame version of **their own** captures. This is a **separate share-card image** containing the photo plus event name, date, hashtag, message and FiveFrames branding. **The original media is never modified.**
- **When:** allowed **including before the gallery is revealed**.
- **Host control:** the host can disable FiveFrames sharing for the event. This setting governs only FiveFrames-provided sharing features; it cannot and does not prevent a guest from independently sharing media already on their own device. Product copy must not overstate this.
- **Isolation requirement:** pre-reveal sharing of a guest's own capture must not reveal the gallery or expose any other guest's captures.
- **Gallery captures:** once the gallery is revealed and visibility permits, sharing of revealed gallery captures follows the same host setting.
- **Mechanism:** Web Share API where supported; manual image download is an acceptable fallback. MVP must not depend on direct Instagram or Facebook publishing APIs.

---

## 11. Host Experience

### 11.1 Event configuration

- Event name, date, timezone, host message.
- Gallery reveal timing (after event / immediate / custom time).
- Gallery visibility (anyone with link / only me).
- Sharing enabled or disabled.
- Event hashtag and share-card details.

### 11.2 Dashboard

- Event status and lifecycle state, with the capture open/close control.
- Guest session count and photo count.
- Gallery grid with moderation: **hide, unhide, delete, favorite**.
- Downloads: individual captures and bulk download of originals.
- Gallery link, capture link, and event signage (§11.3).
- Sharing and visibility settings.

### 11.3 Event signage

Once an event is activated, the host can obtain a small set of practical, FiveFrames-branded signage for the venue — not a general invitation/design editor. At minimum:

- A printable event QR.
- A compact table-card format.
- A larger poster/sign format.
- A phone-screen/digital format suitable for sharing directly (e.g., in a group chat or displayed on a screen at the venue).

Each format includes the event name, a short guest instruction, and a clear "No app. No account." reassurance. Messaging emphasizes the core mechanic without pressure — for example, "Scan. You have five frames." rather than urgency-driven copy.

This is a bounded set of ready-made assets, not a customizable design tool.

### 11.4 Live updates

Counts and newly arriving captures **should** update automatically within a few seconds. This is a quality expectation, not a correctness dependency: **the product must remain fully correct if realtime updates are delayed or unavailable**, with refresh/polling as an acceptable fallback.

---

## 12. Product Invariants

These must hold regardless of architecture. How they are enforced is an engineering decision; that they hold is not.

1. A guest session can never hold more than **5 committed photos**, even under concurrent or retried requests.
2. A frame is consumed **only** when the system has safely accepted the media. Failed, abandoned, cancelled or timed-out uploads never permanently consume a frame.
3. Retries are **idempotent**: retrying a submission never produces a duplicate committed capture.
4. A committed capture is final for the guest — no guest-side delete or replace — and host-side removal never restores a frame. A frame returns only when the system never safely accepted the media, meaning no capture was ever committed.
5. Limits are enforced **server-side and authoritatively**. Client state is never the source of truth for remaining frames.
6. Guest capture is possible **only** while the event is paid, active, and capture has been explicitly opened by the host and not yet closed.
7. Payment must be confirmed before an event link or QR exists. Unpaid or unconfirmed events are not distributable. Confirmation comes from the payment provider's own trusted flow for self-service payments, or from an authorized FiveFrames operator verifying actual receipt for manual payments — **never from the host self-declaring payment** (§7.2).
8. Media is never served from guessable public URLs, and a hidden or unrevealed gallery is never viewable by an unauthorized party.
9. A host can only access, moderate or download events they own.
10. Original media is never modified. Derived assets are additional files.
11. The host can download their media at any point before permanent deletion.
12. The frame count (5 photos) is a product constant and is not configurable per event.
13. Privileged operator mutations (confirming a supplier-assisted/manual payment, recording a manual refund) are server-authoritative and auditable, and occur only through the Operator Console (§5.1) — never as a host-declared, ad hoc, or undocumented action.

---

## 13. Failure and Recovery Expectations

Venue conditions are assumed to be bad: congested Wi-Fi, weak mobile data, interrupted uploads, backgrounded browsers.

| Situation | Expected product behavior |
|---|---|
| Upload fails or times out | Guest keeps the frame and can retry. Clear, calm error, no blame. |
| Guest retries a failed upload | No duplicate committed capture is created. |
| Connection drops mid-upload | Upload resumes or restarts without consuming a frame. |
| Guest closes or reloads the browser mid-upload | On return in the same session, state is consistent; either the capture committed or the frame is still available. Never both. |
| Guest loses session entirely | Treated as a new participant with a fresh allowance (§6). |
| Guest opens link before capture opens | Calm "not open yet" state, not an error. |
| Guest opens capture link after capture closed | Calm "capture has ended" state, plus their own captures if their session still exists. The full gallery is reached only through the gallery link. |
| Event is at its guest-session capacity (§9.5) and a new guest tries to join | Calm "this event is currently full" state, not an error. Guests already joined are unaffected and keep their full remaining allowance. |
| Self-service payment fails | Event stays unpaid; nothing is activated; host can retry. |
| A host has arranged supplier-assisted/manual payment but an operator has not yet confirmed receipt | Event stays in the ordinary unpaid/pending-payment state (no separate "arranged" state, §7.2); no link or QR exists; host cannot self-activate; "Pay online" remains available; calm secondary copy tells the host confirmation is pending. |
| Realtime updates unavailable | Dashboard still correct via refresh; no data loss, no incorrect counts. |
| Host tries to reveal a gallery with no captures | Allowed; empty-state gallery, no error. |

---

## 14. Media Expectations

- Store the **original untouched**, plus derived **display**, **thumbnail**, and **share-card** assets.
- Must accept common iPhone/Android formats, including **HEIC/HEIF** if still prevalent on target devices/browsers. The exact conversion path is to be validated during implementation rather than designed up front.
- Large media uploads go **directly to storage**, not proxied through the application server.
- Upload should be resilient to interruption (resumable or safely restartable) on weak venue connections.

---

## 15. Commercial Model

- **Who pays:** the host. Guests never pay, and there are no paid extra frames — ever.
- **What is purchased:** one event, one-time payment, including approximately **12 months of hosted gallery access**.
- **Launch pricing strategy (hypotheses, not requirements):**
  - **Initial launch price hypothesis: ₱999 per event.** Used for the first real paid events, to validate willingness to pay before moving toward the post-validation target.
  - **Post-validation target price hypothesis: ₱1,490 per event.** Not a fake "regular price" shown crossed out at launch — FiveFrames must not present ₱1,490 as a reference/anchor price unless it has actually sold at that price. The move from ₱999 toward ₱1,490 happens once early paid events validate demand at the lower price.
  - One event remains a one-time purchase; guests never pay, at either price point.
- **Renewal hypothesis:** approximately **₱499/year** to extend hosted access. Unaffected by the launch pricing strategy above unless later evidence creates a real contradiction.
- **Two payment paths, one commercial outcome (§7.2):** self-service online payment through the configured provider, or supplier-assisted/manual payment for sales FiveFrames arranges and confirms directly (§7.2.1). Both purchase the same one event / one-time price; manual payment is not a discount tier or a different product.
- **Self-service online payment methods:** **GCash, Maya, and cards** must be supported for the Philippine launch. The provider/technical layer may expose additional appropriate Philippine rails as they become available (e.g., QR Ph, supported online banking) — this is left to architecture and is not a requirement to launch with more than the three named methods.
- **Supplier-assisted/manual payment:** cash, a manually verified bank transfer, or another explicitly accepted offline arrangement (§7.2.1). Not customer self-service, not the default or primary payment method, and never available for a host to select on their own — FiveFrames initiates it as part of a direct sales conversation.
- **Provider:** PayMongo is a plausible candidate for the self-service online path. **The provider is not a product requirement**; architecture may choose differently as long as the three named self-service methods are supported.
- **Pre-payment disclosure:** clear breakdown of event price, processing/service fees (self-service) or the agreed amount (manual), total, and refundable versus non-refundable amounts.

### 15.1 Cancellation and refunds

- **Eligibility is unchanged by payment path:** before the host first opens guest capture, the event charge is refundable on request, **excluding clearly disclosed non-refundable fees already incurred** (payment-processing or other third-party fees FiveFrames cannot recover), where permitted and disclosed. Once capture has been opened, the event is considered started and the event charge is **non-refundable by default**; exceptional refunds are handled manually. These eligibility rules apply identically to self-service and manually collected payments.
- **Provider payments** may be refunded through the payment provider's own refund mechanism.
- **Manually collected payments have no provider to refund through.** A refund requires a **manually executed refund** (e.g., a manual bank transfer or cash return) performed by an authorized FiveFrames operator, plus an auditable record that the refund was completed — at minimum the event, amount, who executed it, and when.
- A refund, however executed, returns the event to an unpaid state and disables its links.
- Exact fee treatment must follow the payment provider's rules and applicable local requirements.

### 15.2 Retention and expiry

- Hosted gallery access lasts ~12 months from event activation.
- The host is warned in advance of expiry.
- At expiry, the gallery becomes read-only/expired; **downloads remain available** throughout a stated grace period (expected ~30 days, exact duration is a launch policy decision).
- After the grace period, media is **permanently deleted**.
- Renewal restores full access.
- The host may bulk-download originals at any time before deletion.

---

## 16. Platform Requirements

- **Mobile-first web application.** No native app, no install, no app store.
- Must work from a QR scan or a pasted link, in one tap, with no account.
- Must work on current iOS and Android, Safari and Chrome, and common in-app browsers (Facebook, Messenger, Instagram).
- Requires camera and photo-library access via standard web/native picker flows.
- Must tolerate poor connectivity and interrupted sessions.
- Host dashboard is web; mobile-usable, not necessarily mobile-only.
- Event signage suitable for real venues, including a printable QR, a table-card format, a poster format, and a phone-screen/digital format (§11.3).

---

## 17. Technical Constraints and Recommendations

Classified so bootstrap can tell what is fixed from what is preferred.

**Product requirements (fixed)**
- Mobile web, no installation.
- Server-authoritative frame limits with strong consistency guarantees.
- Direct-to-storage upload for large media.
- Private, access-checked media delivery.
- Support for GCash, Maya and cards in the Philippines (self-service path), plus an auditable manual payment record and operator-only confirmation for the supplier-assisted path (§7.2.1).
- An internal Operator Console (§5.1) as the sole, server-authoritative and auditable path for operator mutations (manual payment confirmation, manual refund recording), with read-only operational visibility into events across all hosts for support purposes.

**Technical recommendations (preferred, replaceable)**
- Next.js, React, TypeScript, Tailwind, shadcn/ui, Vercel.
- PostgreSQL, because capture limits and state transitions need strong server-side guarantees.
- Managed infrastructure with as few moving parts as practical.
- A single backend platform covering Postgres, host auth, photo storage and realtime is attractive; **Supabase is an obvious candidate but is not committed.** Separate services are acceptable if clearly better.
- PayMongo as a likely payment provider.

**Explicitly left to architecture**
- How frame limits are enforced (reservation rows, constraints, transactions, or otherwise).
- Realtime mechanism (sockets, polling, or provider-native).
- Image derivative pipeline and HEIC handling specifics.
- Storage and signing strategy.
- ORM, schema, job processing, folder structure.

---

## 18. MVP Scope

### Required for MVP
- Host account, event creation and configuration (name, date, timezone, message).
- Draft → payment → active lifecycle, with price breakdown before payment.
- Self-service online payment via GCash, Maya and cards; activation on provider-confirmed success.
- Supplier-assisted/manual payment path for FiveFrames-arranged sales, with a manual payment record (§7.2.1: event, amount/currency, method/category, payment date, confirmation date, confirming operator, optional reference/note) and activation only on authorized-operator confirmation — never host self-declaration.
- One unpaid customer-facing state with "Pay online" as the primary action, plus calm secondary copy for hosts who already arranged payment directly with FiveFrames (§7.2) — no separate persisted "arranged" payment state.
- Event link + printable QR issued only once payment is confirmed, through either path.
- Host-controlled capture open/close, with automatic safety-net close.
- Guest join via QR/link with display name and anonymous session; no accounts.
- 5 photo frames per guest session, enforced server-side.
- Capture flow: capture/select → preview → optional message → confirm → direct upload → commit.
- Reliable upload behavior under bad network, with safe retries and no duplicate commits.
- Guest's private view of their own captures, with download.
- Gallery with reveal timing (after event / immediate / custom).
- Separate view-only gallery link; visibility "anyone with link" or "only me"; link rotation/revocation.
- Host moderation: hide, unhide, delete, favorite.
- Host downloads: individual and bulk originals.
- Host-controlled sharing toggle; branded share-card generation for photos; Web Share API with download fallback.
- Private media delivery for photos.
- Host dashboard with status, counts, gallery, controls.
- 12-month hosted access with expiry warning, grace period and download access.
- Public pre-purchase demo (§7.1): sample/non-persistent content only, no real event, no real link or QR ever issued.
- Event capacity fair-use boundary (§9.5): launch hypothesis of up to 250 guest sessions per event, with a calm at-capacity state for new joins once reached.
- Event signage (§11.3): printable QR, table card, poster, and digital/phone-screen formats, each carrying event name, guest instruction, and "No app. No account." reassurance.
- Guest trust cues on the join screen (§4 principle 9): no app required, no account required, captures follow this event's access rules.
- Operator Console (§5.1): event list/search and per-event operational detail view across all events, plus the two existing operator mutations — confirm a supplier-assisted/manual payment, record a manual refund — each performed only through the Console rather than an ad hoc or undocumented process.

### MVP optional (ship if cheap, not launch-blocking)
- Realtime dashboard updates (fallback to refresh/polling is acceptable).
- Custom reveal time (after-event default and immediate reveal are sufficient to launch).
- Automated refund execution (manual handling through the provider is acceptable initially).

### Post-MVP
- Replay: browser-based "memories" experience from guest photos, timestamps, messages, host favorites and licensed music.
- Physical photobook from the same collection.
- AI-assisted duplicate detection, curation, moment grouping, and first-draft Replay/Book.
- Co-host access or a read-only dashboard link.
- Guest video capture: a short clip per guest session, with its own managed upload/processing pipeline and branded video share assets. Not designed for in MVP; the MVP architecture reserves nothing for it.
- Guest session recovery.
- Renewal/subscription management beyond a basic extension.
- Live photo wall / slideshow at the venue: not in MVP unless later customer evidence justifies it.

### Explicitly excluded
Native apps · guest accounts, email or OTP · unlimited uploads · configurable frame/shot counts · paid extra frames · filters applied to original captures · likes, comments, followers, profiles · streaks, leaderboards, badges, engagement nudges, photo missions/games/bingo · long-form video · in-browser video editor · photobook editor · RSVP/invitations · seating tools · semantic search · microservices · self-managed video transcoding · direct Instagram/Facebook publishing · AI capture features or AI anywhere in the capture flow · AI-generated or altered memories, faces, or captions · social-feed mechanics generally · free-event tier · invoicing software · a point-of-sale (POS) system · cash-drawer/till features · general accounting software · host self-activation (a host marking their own event paid) · multiple pricing tiers · operator impersonation of hosts · operator-initiated event ownership changes · operators granting extra guest frames · operators bypassing payment confirmation or forcing an event active · operators editing customer event configuration merely by virtue of being operators · operator deletion of customer media as a routine support action · operator (staff) access to actual guest media by default · a general CRM, accounting, POS, marketing-analytics, or infrastructure-monitoring product · a general RBAC/organization-management product.

**On competitor feature creep:** none of the items above — nor guest video capture, co-host accounts, or a live photo wall/slideshow (all three already tracked as Post-MVP ideas, not MVP scope) — are being pursued merely because competitor products have them. This applies in particular to configurable shot counts, unlimited guest uploads, live photo walls/slideshows, filters on original media, guest video, RSVP/invitations, seating tools, games/photo missions, co-host accounts, AI capture features, and social likes/comments/follows. Any of these may be revisited later, but only from real customer evidence — not from competitive parity pressure.

---

## 19. Open Questions and Hypotheses

**Hypotheses to validate**
- Initial launch price ₱999 for one event, moving toward a post-validation target of ₱1,490 once early paid events validate willingness to pay at ₱999 (§15).
- Renewal ₱499/year.
- Launch event capacity of up to 250 joined guest sessions (1,250 theoretical committed captures) is the right fair-use boundary for one flat-price event (§9.5) — to validate via load testing and early real events.
- Five photos is the right allowance.
- Guests accept commitment finality without frustration.
- Hosts are comfortable opening capture manually at the venue.
- The pre-purchase demo (§7.1) meaningfully increases a prospective host's willingness to pay, without being mistaken for a free way to run a real event.

**Open — do not block MVP definition**
- Exact safety-net close duration after the event (48–72 hours).
- Exact expiry grace period before permanent deletion (~30 days).
- Whether HEIC still requires conversion on target devices (validate during implementation).
- Final payment provider selection.
- Whether bulk download is a zip, a batched flow, or provider-native.
- Copy and legal text for refunds, retention and deletion (needs a business/legal decision before launch).
- Whether the branded share card design is fixed by FiveFrames or partially host-customizable beyond name/date/hashtag/message.
- Exact timing and criteria for moving launch price from ₱999 toward the ₱1,490 target (needs a business decision once early paid-event data exists).
- Exact demo content/mechanism (sample media vs. fully local/non-persistent demonstration) — left to architecture and design.
- Which specific individual(s) hold operator accounts at launch (expected: the founder only, or a very small number of staff) and when/how that expands to additional staff — the qualification rule itself (§5) is decided, only headcount and timing remain open.
- Which additional Philippine payment rails (e.g., QR Ph, specific online banking integrations) the self-service path exposes beyond GCash, Maya and cards, and when — left to the provider/technical layer (§15).

**Accepted risks (decided, not open)**
- Session loss grants a fresh allowance; frame limits are per session, not per person.
- The sharing toggle cannot prevent a guest from sharing media already on their device.
- One host account per event; couples, families, or coordinators needing shared access is a known gap.

---

## 20. Acceptance Criteria

Observable behavior that defines launch readiness.

**Guest capture**
1. A guest can scan a QR code, enter a display name, and reach their frames without an account, email, OTP, or install.
2. A guest session can never end up with more than 5 committed photos, including under rapid repeated taps, concurrent requests, and retries.
3. A failed or interrupted upload leaves the guest's frame available.
4. Retrying a submission after a failure produces exactly one committed capture, never two.
5. After committing, a guest has no way to delete or replace that capture.
6. A returning guest on the same browser sees their remaining frames and their own captures.
7. A guest whose session is lost is treated as a new participant, and the product's wording never claims otherwise.
8. Nowhere in the guest experience does the UI pressure the guest to use remaining frames.
9. The guest join screen states, briefly, that no app is required, no account is required, and that captures follow this event's own access rules.

**Lifecycle and payment**
10. An unpaid or unconfirmed event has no working event link or QR, regardless of payment path.
11. Guests cannot capture until the host has explicitly opened capture, even on the event date.
12. Capture stops when the host closes it, and stops automatically after the safety-net period if the host does not.
13. A failed self-service payment leaves the event unactivated and retryable.
14. The host sees price (or agreed amount), fees, total and refundability before paying, for either payment path.
15. Once an event reaches its guest-session capacity (§9.5), a new guest attempting to join sees a calm "event is full" state; guests already joined are unaffected and keep capturing normally.
16. A prospective host can experience the pre-purchase demo (§7.1) without paying and without creating any real event, link, or QR; nothing produced by the demo functions as a real capture or gallery link.
17. A host offered supplier-assisted/manual payment has no action available to mark their own event as paid; the event stays unactivated, with no link or QR, until an authorized FiveFrames operator confirms it. Before confirmation, the host's checkout still shows "Pay online" as the primary action, plus calm secondary copy explaining that confirmation activates the event; online payment is never disabled by the existence of a manual arrangement (§7.2).
18. Confirming a manual payment records an auditable payment record identifying the event, amount/currency, method/category, payment date, confirmation date, and confirming operator (§7.2.1); confirmation activates the event and issues its link and QR exactly as a successful self-service payment would.
19. Being a host or a paying customer never by itself grants the ability to confirm or refund a manual payment; that ability exists only for accounts FiveFrames has explicitly authorized as operators (§5). An operator who also owns an event cannot confirm payment or a refund for that event — a different authorized operator must do so.

**Operator Console**
20. An authorized operator can list and search events across all hosts, and open an event's detail to see its lifecycle state, payment state and source, activation status, joined guest-session count and configured capacity, aggregate capture/moderation counts, capture open/closed state, and gallery reveal/visibility state — without directly querying the database or an external provider dashboard.
21. Confirming a supplier-assisted/manual payment and recording a manual refund happen only through the Operator Console; there is no other sanctioned path for these actions.
22. The Operator Console grants no ability to impersonate a host, change event ownership, grant a guest extra frames, bypass payment confirmation, force an event active outside the defined payment paths, edit a customer's event configuration, or delete customer media as a routine action.
23. The Operator Console does not expose guest media/photography by default; only aggregate counts and operational metadata are visible.

**Gallery, privacy and sharing**
24. Before reveal, the gallery is not viewable by anyone holding the gallery link.
25. With visibility "only me", the gallery link does not grant access to anyone but the host.
26. A guest can always view and download their own captures regardless of gallery visibility, unless the host hid or deleted that capture.
27. Media cannot be retrieved from a guessable URL without an access check.
28. A host cannot view, moderate, or download another host's event.
29. With sharing enabled, a guest can generate and share a branded share card for their own photo before reveal, and doing so exposes neither the gallery nor any other guest's capture.
30. With sharing disabled by the host, the FiveFrames sharing flow is unavailable to guests.
31. Share-card generation leaves the original media unmodified.

**Host operations**
32. Host can hide, unhide, delete and favorite captures, and the guest's view reflects hides and deletions.
33. Host can download individual captures and all originals in bulk.
34. Dashboard counts remain correct when realtime updates are unavailable.
35. For an activated event, the host can obtain each event signage format — printable QR, table card, poster, and digital/phone-screen — each showing the event name, a short guest instruction, and a "No app. No account." reassurance.
36. A manually collected payment that is refunded shows an auditable record that the refund was manually executed, including who executed it and when, and the event returns to an unpaid state with its links disabled — identical in outcome to a provider refund.

**Platform**
37. Full guest flow works on current iPhone Safari, Android Chrome, and Facebook/Messenger/Instagram in-app browsers.
38. The full flow has been tested on real iPhone and Android devices under realistic venue network conditions (weak Wi-Fi, congested mobile data, interrupted uploads).

---

## 21. Success Definition

**MVP is ready when:** a prospective host can try the public demo, then create and pay for an event at the initial launch price, receive event signage (§11.3), open capture at the venue, guests can join without accounts and see the trust cues on the join screen, frame limits and the event-capacity boundary hold under real concurrency and retries, uploads survive ordinary bad-network behavior, the gallery and moderation work, sharing respects event settings, media stays private per the access model above, and the whole flow has been validated on real iPhones and Android phones in realistic venue conditions.

**The product is validated when:** the constrained guest-capture model works at a real event — guests understand the limit, use some or all of their frames without frustration, the host values the resulting collection, and the host would pay again or recommend it. The launch price hypothesis is validated once a meaningful number of hosts pay ₱999 without price being a stated blocker, at which point pricing can move toward the ₱1,490 target. Only then does scope expand toward Replay and the photobook.

**What must not be optimized:** captures per guest, session length, return visits, or any other engagement metric. An event where guests each used two frames and stayed present is a success.
