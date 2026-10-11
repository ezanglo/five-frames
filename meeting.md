# FiveFrames — Founders' Meeting #1

> My personal playbook for our first proper business meeting. Keep this open and work top to
> bottom. Fill in the blanks as we go.

| | |
|---|---|
| **Purpose** | Agree what FiveFrames is, see the real product together, and decide how we get from "it's built" to "it worked at a real event" |
| **Expected duration** | ~120 minutes (a 90-minute version is marked in the agenda) |
| **Attendees** | Me, my wife |
| **Date / place** | ______________________ |
| **Note-taker** | ______________________ (suggest: whoever isn't talking, or switch halfway) |

### How to read this document

Every block is tagged so I know what kind of moment it is:

| Tag | Means |
|---|---|
| **[EXPLAIN]** | Something I tell her, in plain words |
| **[DEMO]** | Something I show on screen or on a phone |
| **[DISCUSS]** | Questions for both of us, no right answer yet |
| **[DECIDE]** | We should leave with an answer (or a deliberate "not yet") |
| **[ACTION]** | A task with an owner and a date |
| ⚠️ | A known limitation, gap, or "needs manual verification" |

### What a good outcome looks like

By the end we should have:

- [ ] A shared, one-sentence understanding of what FiveFrames is and who it's for
- [ ] Both seen the real product, end to end, from host setup to gallery
- [ ] A clear picture of what's built, what isn't, and what blocks a real pilot
- [ ] A first answer on business direction (managed service, self-service, or both — and in what order)
- [ ] A rough pilot plan for October–November 2026
- [ ] A first pass at who owns what
- [ ] A short list of action items with owners and dates
- [ ] A date for meeting #2

---

## Preparation checklist (do this the day before)

### Product and accounts

- [ ] Open https://www.fiveframes.app on the laptop and on my phone. Confirm it loads.
- [ ] ⚠️ **Do a full dry run myself the day before**: create an event, activate, open capture, join from my phone, keep one photo, reveal. Release validation isn't finished (see §3 "Honest status"), so I want to find surprises before she does.
- [ ] Decide which account hosts the demo event (see §3 "Demo setup"). My recommendation: **she creates her own host account live** and uses its Free event.
- [ ] ⚠️ Check that a sign-up confirmation email actually arrives, and how fast. Supabase sends it, and its email templates are still the Supabase defaults (progress.md "Release follow-ups"). Whether a custom SMTP sender is set up: **needs manual verification** in the Supabase dashboard. If email is slow, have her sign up *before* the meeting.
- [ ] Check whether my account has operator access in production. progress.md lists "First production operator grant(s)" as still open. **Needs manual verification.** If I'm not an operator, skip demo step P.
- [ ] Check whether my own account has already used its Free event (one per account, ever).

### Devices and materials

- [ ] Laptop (host view) + charger
- [ ] Two phones (guest views): mine and hers. Ideally one iPhone and one Android if we have them
- [ ] Phones charged, on mobile data *and* Wi-Fi available (so we can switch if one is bad)
- [ ] A few nice photos already in each phone's library (as a fallback to the camera)
- [ ] One "theme image" for the Look step: a photo of us, saved as **JPEG or PNG**. ⚠️ Raw HEIC isn't supported (product.md §14). An iPhone screenshot or an exported JPEG is safest
- [ ] Optional: one printed QR from an earlier test, to show what signage looks like on paper
- [ ] This document, a notes app or paper, and a calendar for dates

### Things to avoid during the demo

- [ ] **Don't open the live pilot event** that's already in production (progress.md says production holds one). Don't scroll the Operator Console event list on screen; search for our demo event by name instead
- [ ] **Don't confirm a manual payment** in the Operator Console for the demo. It writes a permanent entry to the payments ledger, and the amount must be more than ₱0
- [ ] **Don't record a refund** or **raise capacity** on a real customer's event
- [ ] No real payment can happen by accident: online payment is switched off (`PAYMENT_MODE = "manual"` in `lib/payments/mode.ts`). There is no "Pay online" button anywhere

---

## Agenda

| # | Section | 120-min plan | 90-min plan | Type |
|---|---|---|---|---|
| 1 | Opening and context | 5 | 5 | Explain |
| 2 | The problem and our value | 8 | 5 | Explain + Discuss |
| 3 | Live product demo | 30 | 25 | Demo |
| 4 | Product feedback | 10 | 8 | Discuss |
| — | Break | 5 | 0 | |
| 5 | Our business vision | 10 | 8 | Discuss + Decide |
| 6 | Pilot strategy | 15 | 12 | Discuss + Decide |
| 7 | Operating as a service | 7 | 5 | Discuss |
| 8 | Registration, money, pricing | 10 | 7 | Discuss (mostly research items) |
| 9 | Marketing and partnerships | 7 | 5 | Discuss |
| 10 | Roles | 5 | 5 | Discuss + Decide |
| 11 | Risks | 3 | skim | Read together |
| 12–13 | Decisions + action plan | 5 | 5 | Decide + Action |
| 15 | Closing | — (inside 12–13) | — | |
| | **Total** | **~120** | **~90** | |

If we're running long: skip the break, skim §11 together at the end, and turn §8 into
homework ("each of us researches X before meeting #2").

---

## Section 1 — Opening and context (5 min)

**[EXPLAIN]** Why we're here.

Something like:

> "I want this to be our first real meeting about FiveFrames as a *business*, not me showing you
> an app. I've built a lot, and I'll show you all of it. But the bigger questions are ours to
> answer together: what kind of business this is, how we'd run it, what we try first, and who
> does what. Nothing's decided yet. I'd rather you poke holes now than later."

**[EXPLAIN]** What FiveFrames is, in one breath:

> "At an event, every guest scans a QR code and gets exactly five photos. No app, no account.
> They shoot what matters to them, then put the phone away. All the photos go into one private
> gallery for the host, which opens when the host decides."

The current vision, in short points:

- **Five photos per guest, fixed.** The limit is the point, not a storage restriction.
- **No app, no sign-up for guests.** Scan the QR or open a link, type a first name, start.
- **Private by default.** The gallery is hidden until the host reveals it. Links are long and unguessable.
- **Be present.** Fewer photos means more looking up from the phone.
- **Two ways to sell it:** as an *event service* we deliver (like a photobooth or a caterer), and as *self-service* where a host runs it alone.

**[EXPLAIN]** Make clear what's open:

> "The 'service business plus self-service' idea is where my head is, but it's not decided.
> That's one of the things I want us to agree on today."

---

## Section 2 — The problem and our value (8 min)

**[EXPLAIN]** The problem, as it actually plays out at events:

- The **photographer** gets the important, posed and planned moments.
- The **photobooth** gives guests a fun, dedicated photo activity.
- **Guests** catch the candid stuff: the lola laughing, the kids under the table, the view from the back.
- Those guest photos end up **scattered** across phones, group chats, Facebook and Instagram.
- The **host often never sees most of them**, or gets them weeks later, half of them blurry duplicates.

**[EXPLAIN]** Where FiveFrames fits:

> "We're not replacing the photographer or the photobooth. We're the third thing: a simple way to
> collect what the guests saw, from where they stood, into one place the host owns."

**[EXPLAIN]** Why exactly five:

> "If everyone can upload 200 photos, you get a camera roll nobody looks at. Five makes people
> choose. Each shot is a small decision: 'is this worth one of my five?' The host ends up with a
> smaller collection that's actually worth going through. And guests spend the rest of the night
> at the party, not on their phones."

Two details worth mentioning:

- A kept photo is final. There's a preview first, retakes before keeping are free, but once kept it's spent. That's what makes five meaningful.
- Unused frames are fine. The app never nags anyone to "use your remaining 3". That's a deliberate product rule.

**[EXPLAIN]** Value to each person:

| Who | What they get |
|---|---|
| **Host** (couple, celebrant, family organizer, company) | The guests' view of their own event, in one private gallery, downloadable in full, with no chasing people in group chats |
| **Guest** | A small, fun role at the event; no app or account; their own five photos to keep and download; a styled "keepsake" image to share |
| **Coordinators / suppliers** | Something easy to add to a package that doesn't compete with what they already sell, and gives their client one more thing to remember |

⚠️ Everything in this table is our *belief*, not validated demand. We don't have customer data yet.

**[DISCUSS]** Questions for her:

- When you think about weddings or birthdays we've been to, does this problem ring true?
- Would *you* have wanted this at our own events? Which ones?
- Does "only five" feel exciting, or limiting? Who might find it limiting?
- Who do you think would pay for this: the couple, the parents, the coordinator, a company?
- What would make you skeptical if a friend pitched this to you?

---

## Section 3 — Live product demo (30 min)

### Honest status before we start

**[EXPLAIN]** Briefly, before she sees anything:

> "Everything I'm about to show is built and deployed at fiveframes.app. What isn't done is
> the final testing pass on real phones and real venue networks. So if something hiccups, that's
> exactly the kind of thing we need to find before a real event."

What the repo says (progress.md, release-validation.md, as of 2026-10-11):

- All planned feature work is **complete** and the release candidate is **deployed**.
- The formal release validation is **in progress**: 55 cases, 8 passed, 0 failing, 9 blocked, 32 not run yet (mostly real iPhone/Android and real-network tests), 6 deferred.
- **Deferred on purpose:** testing inside Facebook, Messenger and Instagram's built-in browsers (INAPP-01…03). ⚠️ This matters a lot here, because many Filipinos open links from Messenger.
- **Deferred to after launch (not built):** Send to Google Drive, co-host access. The site may show them as "coming soon" on Premium.
- **Not built:** a host can't delete an event (progress.md "Other open items"). There's no emailed expiry warning; it's in-app only.

### Demo setup

**Recommended setup:**

| Role | Device | Who drives |
|---|---|---|
| Host | Laptop | **Her**, with me guiding. Hands-on gives better feedback than watching |
| Guest 1 | My phone | Me |
| Guest 2 | Her phone | Her, when it's guest time |
| Operator (optional) | Laptop, my account | Me, only if my account has operator access |

**Which account hosts the event:** her own new host account, using its Free event.

- Why: she experiences sign-up as a real host would. And because it's *her* event, I can show operator "support access" on it. An operator can't use support access on an event they own.
- The cost: each account gets **one Free event, ever**. Using hers for the demo is fine; she isn't going to be a customer.
- The Free plan limits what we'll see: 10 guests, 7 days of hosted access, link + on-screen QR + phone-screen sign only, and one keepsake style per family. **I'll show the full signage and all keepsake styles in the Look previews before choosing Free** (a draft with no plan chosen previews everything).
- Cleanup: there's no "delete event" for hosts. A Free event expires after 7 days, then a 30-day download grace period, then the daily cleanup job deletes the media automatically (`lib/events/policy.ts`, decision D18). So the demo event cleans itself up.

**Test photos:** take real ones during the demo (each other, the table, the room). Keep library photos as a fallback.

**QR:** the event's QR appears on screen right after activation. We scan it straight off the laptop screen with our phones.

### Fallback plan

| If this breaks | Do this instead |
|---|---|
| Sign-up email doesn't arrive | Use an account she created earlier, or use mine as host and skip step P |
| The site won't load / network is bad | Switch to phone hotspot. Then fall back to `/demo` (runs entirely on the phone, nothing uploads) |
| A photo upload fails | Good! Show the Retry: the shot isn't used up. That's a real feature (see step J) |
| Keepsake won't render | Explain the idea, show the styles in the Look previews instead |
| Anything else | Say "this is exactly why we test before a pilot", write it in the notes (§14), move on. Don't debug live |

Rule for myself: **if a feature doesn't work, describe what it's supposed to do and say plainly that it didn't work today.** Don't pretend.

### "What to watch for" checklist

Keep this visible while she uses it. Tick and note as I see it.

- [ ] Where does she hesitate or re-read?
- [ ] What does she tap that isn't a button?
- [ ] What wording confuses her?
- [ ] What feels unnecessary or like too many steps?
- [ ] Where does she smile or say "oh, nice"?
- [ ] What would worry her as a host (privacy, cost, "what if it fails on the day")?
- [ ] Does she understand that the five are *per phone/browser*, not per person?
- [ ] Does she understand that a kept photo is final?

---

### A. Public site

1. **Open:** `https://www.fiveframes.app` (route `/`). Then the top links: `/how-it-works`, `/pricing`, `/faq`. Footer: `/terms`, `/privacy`.
2. **Do:** scroll the home page slowly. Open Pricing.
3. **She'll see:** the pitch, sample "prints", the keepsake showcase, gallery layouts, and three plans: **Free** (first event), **Standard ₱499**, **Premium ₱999**.
4. **Explain:** "This is the shop window. A coordinator or couple would land here from a link we send."
5. **Why it matters:** it's what a stranger sees before they ever talk to us.
6. ⚠️ **Limits:**
   - Marketing photos are stock stand-ins until we have pilot photos we're allowed to use (docs/asset-credits.md).
   - The Terms and Privacy pages are drafts that still need a lawyer's review. The `support@` and `privacy@fiveframes.app` mailboxes they mention must exist (**needs manual verification**).
   - There's no "contact us" link yet: `SALES_CONTACT` is `null` in `lib/payments/mode.ts`.
   - Premium already promises "We set it up with you" and "Direct help on the day" (`lib/marketing/content.ts`). That's a service promise. We'll come back to it in §5.
7. **Optional, 1 min:** open `/demo` on her phone ("Try the guest experience"). Nothing uploads, nothing is saved. It's for prospects who want to feel it before buying.
8. **Transition:** "Let's do it for real. You're the host."

### B. Host account and event creation

1. **Open:** `/signup` → confirm email → `/login` → `/dashboard`.
2. **Do:** she signs up with her email and a password, opens the confirmation email ("Check your inbox"), signs in.
3. **She'll see:** "Your account is ready" and a **Create an event** button.
4. **Explain:** "Only hosts have accounts. Guests never do."
5. **Why it matters:** the host account owns the photos. It's what lets them download everything later.
6. ⚠️ **Limits:** confirmation emails use Supabase's default template. Delivery speed and sender setup: **needs manual verification** (see prep).
7. **Transition:** "Now let's make an event. Pretend it's a birthday."

### C. Event configuration (Details, then Look)

1. **Open:** **Create event** → `/events/new` ("What's the occasion?"). The wizard has three steps: **Details → Look → Share**.
2. **Do — Details:** event name, date, timezone (defaults to Manila), and a welcome message guests will see on the join screen. Continue. It saves as a draft.
3. **Do — Look** (`/events/<id>/setup?step=look`, "Make it yours"): upload our theme photo (JPEG/PNG), pick an accent color from the swatches, add a hashtag like `#OurTestParty`.
4. **She'll see:** live previews of the guest phone screens, the keepsake styles, and every signage format, all in her chosen color and image. Signage shows a placeholder QR, because no real link exists yet.
5. **Explain:** "This is the only 'design' the host does: one picture, one color, one hashtag. Skip it and it still looks finished. No editor, on purpose."
6. **Why it matters:** this is what makes it feel like a premium event product and not a generic app. Hosts, especially couples, care how it looks.
7. **Show while you're here:** flip through **all five Single-photo keepsake styles** and **all five "Your five" (Full Set) styles**, and every signage format (QR, table card, poster, phone-screen, table-number cards). We won't get all of these on a Free event later.
8. ⚠️ **Limits:** raw HEIC theme images are refused. Theme image is public-facing (anyone with the event link or a printed sign sees it); the upload screen says so.
9. **Transition:** "Now it has to be activated before any QR exists."

### D. Plan choice and activation

1. **Open:** **Share** step (`/events/<id>/setup?step=share`, "Ready to activate…?").
2. **Do:** show the plan picker: Free, Standard, Premium. Click Premium first and point out the price breakdown and the status line. Then choose **Free** and press **Activate free event**.
3. **She'll see:**
   - For a paid plan: the price, "Processing fees: Included — nothing extra", "How you pay: Directly to FiveFrames", and that the link and QR are issued once FiveFrames confirms payment. **There is no pay button.**
   - For Free: immediate activation, link and QR appear.
4. **Explain:**
   > "Right now every paid sale goes through *us*. Someone talks to us, pays by GCash, bank or
   > cash, and I confirm it in an admin screen. Then their event switches on. Online card/GCash
   > checkout is built (PayMongo) but switched off until we decide to turn it on."
5. **Why it matters:** no event link or QR can exist before activation, so nobody can run an event without paying (or using their one Free event). The host can never mark their own event as paid.
6. ⚠️ **Limits / discrepancies to flag:**
   - **Self-service today really means Free only.** A stranger can sign up and run a Free event alone, but can't buy Standard or Premium without contacting us, and there's no contact link yet.
   - A paid event can't be activated at ₱0. The Console requires an amount above zero (`app/(operator)/actions.ts`). This matters for free pilots (§6).
   - The online checkout page (`/events/<id>/checkout`) exists but is unused while payment mode is manual.
7. **Transition:** "It's live. Here's what you'd give guests."

### E. QR code and guest invitation

1. **Open:** the Share step after activation, then **Dashboard** tab (`/events/<id>`), card **Share with guests**. Also **Settings → Links** (`/events/<id>/settings/links`).
2. **Do:** show the QR on screen and **Copy** the link. On the dashboard show the signage buttons (on paid plans: **Download QR**, **Table card**, **Poster**, **Phone-screen sign**, plus table-number cards). In Links, show **Rotate link** and **Revoke link** — but *don't* press them now.
3. **She'll see:** a QR and a readable link like `fiveframes.app/e/our-test-party/…`.
4. **Explain:**
   > "Two different links. The capture link (and QR) lets guests join and shoot. The gallery link
   > is view-only and is a separate thing you share later. If either one leaks, you rotate it and
   > the old one dies immediately."
5. **Why it matters:** printed signs at tables are how guests find out FiveFrames exists. The QR is never styled over: always dark on light, so it scans.
6. ⚠️ **Limits:** on Free, only the on-screen QR, the link and the phone-screen sign. Printed signage on paper was physically scan-tested in an earlier slice (Slice 17), but the final real-device pass is still pending.
7. **Transition:** "Before we open it, let's see what a guest sees if they scan too early."

### F. Guest joins (capture still closed)

1. **Open:** scan the QR from the laptop screen with my phone.
2. **Do:** look at the screen *before* opening capture.
3. **She'll see:** the themed event page saying it's not open yet ("Almost time!", "Capture opens when your host starts it").
4. **Explain:** "Activating doesn't start capture. The host switches it on at the venue. The event date doesn't open it automatically."
5. **Why it matters:** hosts can share the QR days early without anyone shooting before the event.
6. **Do next:** on the laptop **Dashboard**, flip the **Capture** switch on ("Open it when guests arrive"). Refresh the phone.
7. **She'll see on the phone:** the join screen with three reassurances: "No app to download", "No account — just your first name", "Your photos follow this event's own access settings". Then "What should we call you?"
8. **Do:** I type my first name. She scans with her phone and joins as a second guest.
9. **Explain:** "That's it. No download, no email, no password."
10. ⚠️ **Limits:**
    - The five are per **browser**, not per person. If someone clears their browser or switches phones, they start fresh with five new frames. It's a deliberate trade-off (product.md §6).
    - Guest count means "browsers that joined", not verified people.
    - ⚠️ Messenger/Facebook/Instagram in-app browsers are **not yet tested**.
11. **Transition:** "Now the five frames."

### G. The five frames

1. **Open:** the guest screen after joining.
2. **She'll see:** "Hi, ___!", "Welcome to …", "No rush — keep only the moments that matter.", and five empty slots with **Take shot 1**.
3. **Explain:** "Five slots. That's all anyone gets. No countdown, no pressure."
4. **Why it matters:** this calm tone is the whole product personality.
5. **Transition:** "Take one."

### H. Capturing or choosing a photo

1. **Do:** tap **Take shot 1**. The phone's own picker opens: take a photo or choose from the library.
2. **She'll see:** the normal camera/library chooser, not a custom camera.
3. **Explain:** "We use the phone's own camera. It's more reliable across phones than building our own, and it lets people pick a photo they already took."
4. ⚠️ **Limits:** raw HEIC files that reach us unconverted currently fail at processing with a retry error (the frame isn't used up) instead of a clean "unsupported" message. Whether real iPhone library photos are affected is test IOS-03, **not yet run**.
5. **Transition:** "Before it counts, there's a preview."

### I. Preview and optional message

1. **She'll see:** the photo, **Add a message** ("Say something about this moment"), and the line "Once kept, this photo is final. Retakes are free and don't use a shot." Plus **Discard this photo**.
2. **Do:** type a short message. Discard once to show retakes are free, then pick again.
3. **Explain:** "The message travels with the photo into the gallery. Retaking is free. Only 'Keep' counts."
4. **Why it matters:** it's fair. Nobody burns a frame by accident.
5. **Transition:** "Now keep it."

### J. Keeping (submitting) a frame

1. **Do:** tap **Keep photo**.
2. **She'll see:** a short upload, then the slot fills ("Shot 1 used").
3. **Explain:**
   > "Behind the scenes, the photo goes straight from the phone to our private storage. Only when
   > it has fully arrived does the frame count. If the upload fails, they keep the frame and get a
   > Retry. Tapping Keep twice never uses two frames."
4. **Why it matters:** venue Wi-Fi is bad. Guests must never lose a frame to a failed upload. This is the most important technical promise in the product.
5. **Optional live test:** turn on airplane mode, take shot 2, tap Keep, see the error and **Retry**, turn data back on, retry. ⚠️ Only do this if the dry run went smoothly.
6. **Transition:** "Let's look at what the guest has."

### K. Guest's own photos and keepsakes

1. **Open:** the guest screen, section "Your moments".
2. **Do:** tap a photo. Show **Download original** and **Make a keepsake**. In the keepsake picker, show **One photo** and **Your five**. Press **Share** or **Save keepsake**.
3. **She'll see:**
   - The original, untouched.
   - A keepsake: a styled image with the event name, color, hashtag and a small FiveFrames mark. On a Free event there's one style; paid events get five per family.
   - "Your five": a preview using the photos kept so far, with Share and Save switched off until all five are kept.
4. **Explain:**
   > "The original is never edited. A keepsake is a separate image made on the spot for sharing,
   > like a photobooth print. It never shows the guest's name or the event link, so sharing it
   > publicly doesn't let strangers in. And every shared keepsake quietly carries our mark."
5. **Why it matters:** this is our free word-of-mouth marketing, and it's what guests take home.
6. **Do next (if time):** keep all five on one phone to show "That's a wrap, ___!" and the completed "Your five, together".
7. ⚠️ **Limits:** native share sheets on real phones are human-only to verify. In-app browsers may only allow saving.
8. **Transition:** "Meanwhile, the host is watching this happen."

### L. Host dashboard and live controls

1. **Open:** laptop, **Dashboard** tab.
2. **She'll see:** "Guests joined" and "Photos taken" update by themselves, the **Capture** switch ("Live now"), and the gallery card.
3. **Do:** flip **Capture** off. Show "Closed. You can reopen it if guests are still shooting." Check the guest phone: "Capture has ended. Here's what you kept."
4. **Explain:** "If the host forgets to close it, it closes automatically 72 hours after the event date. After that it can't reopen."
5. **Why it matters:** the host (or we, on their behalf) controls the night without touching guests' phones.
6. **Transition:** "Now the photos themselves."

### M. Photos tab: moderation and downloads

1. **Open:** **Photos** tab (`/events/<id>/photos`).
2. **Do:** filter by guest, sort newest/oldest. On one photo: **Mark as favorite**, then hide it (show "Hidden from gallery", then **Unhide**). Open the **Delete photo** dialog and read it out ("This can't be undone. It won't give the guest their shot back."), then cancel. Press **Download all**.
3. **She'll see:** a management grid with each photo's guest and message. Download all saves ZIP files (up to 500 photos each), or falls back to one-by-one downloads in browsers that can't.
4. **Explain:** "The host can clean up anything before revealing. Hiding or deleting never gives the guest their frame back. And the host can download every original, at full quality, anytime until the event is deleted."
5. **Also show:** making one guest's "Your five" (Full Set) keepsake from this tab, if that guest has five photos.
6. ⚠️ **Limits:** "Download all" for more than 500 photos (multi-part) hasn't been hand-tested.
7. **Transition:** "Now let's open the gallery to everyone."

### N. Gallery reveal and the gallery link

1. **Open:** first, the gallery link in a private browser window *before* revealing (from Dashboard: **Copy gallery link**).
2. **She'll see:** "Still under wraps" / "Gallery opens soon".
3. **Do:** back on the Dashboard press **Reveal gallery** and confirm. Reload the gallery link.
4. **She'll see:** everyone's visible photos, grouped by hour ("7 PM"), in Masonry layout. Tap a photo to see it whole with its message.
5. **Do:** **Settings** (`/events/<id>/settings`) → "After the party": show **When should the gallery reveal?** (after the event, immediately, or a custom time), **Who can open the gallery link?** (anyone with the link, or only me), **Gallery layout** (Masonry, Rows, Grid) and **Time sections**. Switch the layout and reload the gallery.
6. **Explain:** "The gallery stays hidden until the host says so. The default is to reveal automatically when capture closes. The host can also keep it to themselves."
7. **Why it matters:** this is the "wow" moment after the event, and the privacy promise.
8. ⚠️ **Limits:** readable share links and link previews in chat apps (D28) are "awaiting human verification" (test GAL-09).
9. **Transition:** "Last: what *we* see as FiveFrames."

### O. Signage and sharing (paid events)

Already covered in C (previews) and E (download buttons). Add, if not yet shown:

- **Table-number cards** (Standard and Premium): the host types how many tables (1–100) and gets one card per table, each with the same QR.
- **Sharing setting** in Settings: switches keepsakes on or off for guests. ⚠️ Exact location and label in Settings: **needs manual verification** during the dry run. Turning it off doesn't stop a guest sharing photos already on their phone, and our copy is careful not to claim that.

### P. Operator Console and support access (only if I'm an operator)

1. **Open:** `/operator`. **Search for her event by name**. Don't scroll the list.
2. **She'll see:** event status, plan, guest count vs capacity, *counts only* of photos (never the photos themselves), and buttons: **Confirm a manual payment**, **Record a manual refund**, capacity override, **Open in support access**, **Support log**. Also `/operator/payments`: a ledger of payments and refunds with monthly totals and an export.
3. **Do:** **Open in support access**. Every page now shows a banner naming her as the host. Change something harmless (e.g. the welcome message), save.
4. **Do:** on her laptop session, open her Dashboard: she sees **"FiveFrames support activity"** listing what "FiveFrames support" changed.
5. **Explain:**
   > "This is how we'd run a managed event without being there. I can fix her settings, open or
   > close capture, hide a photo, and from the Console raise the guest limit. I can't pay for her, delete her photos or
   > her event. Every single thing I do is logged and she can see it."
6. **Why it matters:** this is the backbone of a *managed service*. It's what lets us offer "we set it up with you" and "help on the day" remotely.
7. ⚠️ **Limits:**
   - Production operator access may not be granted yet (**needs manual verification**). Granting it is done only with `pnpm ops:grant-operator`, which runs against production from this laptop. Don't do it casually.
   - No second sign-in factor on operator accounts yet (recommended before real customers).
   - Operators can't use support access on events they own. So **we must never own a customer's event**; the customer creates it on their own account.
8. **Transition:** "That's the whole product. Let's talk about how it felt."

---

## Section 4 — Product feedback (10 min)

**[DISCUSS]** Start broad, then narrow. Let her talk first; I take notes and don't defend.

**First impressions**
- What's the one thing you'll remember from that?
- If you had to describe it to your sister in one sentence, what would you say?

**Guest experience**
- Was anything on the guest phone confusing?
- Did "five, and keeping is final" feel fair or stressful?
- Would your titas manage this on their own? Your lolo?

**Host experience**
- Was setting up the event easy? Which step felt longest?
- Would you trust this at your own wedding? What would you need to see first?
- Did you understand the difference between the capture link and the gallery link?

**Look and brand**
- Does it look like something you'd pay for?
- Did the keepsakes feel special or gimmicky?

**Trust and privacy**
- Anything that worried you about who can see the photos?
- How did you feel about FiveFrames staff being able to open an event (support access)?

**Value**
- What part felt most valuable? What could we remove without anyone noticing?
- What's missing that a host would *expect*?

**Sort what comes up into three buckets** — don't turn everything into a feature request:

| A. Must fix before the first pilot | B. Nice to improve later | C. Ideas to validate before building |
|---|---|---|
| (bugs, confusing copy, anything that could lose photos or break trust) | (polish, small wording) | (new features — only after pilot hosts ask for them) |
| A1. Confirm dialog before **Keep photo** | B1. "Start shooting" sounds too strong | C1. Edit the message after keeping |
| A2. Make **open capture** the main post-setup button, not a switch | B2. Shorten / lighten the Look step | C2. Reorder kept photos |
| A3. Check why keepsakes looked unavailable after capture closed | | C3. Remove the message feature entirely |
| | | C4. Show a hidden photo faded on the guest's view, "Hidden by host" |
| | | C5. Capture link shows the gallery link once capture closes |
| | | C6. Free: unlimited small events (≈30/month cap), upgradable |
| | | C7. Paid extras on top of a plan: printing the signage for the host, a physical photobook album, a video slideshow / highlights |

Rule of thumb: if it could **lose a photo, leak a photo, or embarrass a host on the day**, it's A. Everything else waits for pilot evidence.

### What she said (meeting #1)

**During the demo**
- The "once kept, this photo is final" note gets read past. Since a kept photo can't be changed, it needs a real confirmation, not just a line of text.
- Wants to add or edit the message after the photo is kept. Wants to reorder photos.
- "Start shooting" sounds a little extreme.
- A guest who kept photos should see a link to the gallery from their capture link once capture is closed.
- Opening capture on the day shouldn't be a switch. It's the main thing the host does after setup, so it should be a big, obvious button.
- Hidden photos shouldn't disappear from the guest's own view. Show them faded, with a note that the host hid them.
- Guests should still be able to make, share and download keepsakes after capture closes.
- Free: instead of only the first event, make it unlimited for small events, so hosts come back and share it with their circle. A good lead-in to a mobile app (like iPhone Memories or Facebook Memories). Free events should be upgradable for more guests. Cap it, maybe 30 events a month.

**First impressions**
- "I can take photos on my own, hassle free, without lining up."
- An extra gimmick for an event, especially for trending things, and guests feel more included.

**Guest experience**
- Nothing was confusing.
- Five, and keeping is final, feels fair, not stressful. There are workarounds if you want them.

**Host experience**
- Setup is straightforward. The Look step felt longest, because you're setting up everything guests will see.
- "I'd need to try the Free one first" before trusting it at her own event.
- Understood the capture link vs the gallery link.

**Look and brand**
- Yes, she'd pay for it. Keepsakes feel special.

**Trust and privacy**
- As a guest, fine: you know the people at the event, and you already chose which photos to keep.
- Support access is fine: photographers and photo booths already see everything.

**Value**
- Most valuable: the gallery, because everything is in one place instead of scattered.
- Could remove: the message. It only shows when you open a photo, and it's optional.
- Missing for a host: a physical photobook album, or a video slideshow / highlights edit.

### My notes on each item (checked against the code and product.md after the meeting)

| # | Status today | What it would take |
|---|---|---|
| A1 | Preview shows a line of text only | Small UI change: a confirm step on Keep. Keep it calm, no scare copy. The idempotent reserve key already stops double-taps, so this is about intent, not safety |
| A2 | Capture is a switch on the Dashboard | UI change only. Product rule stays: the host opens it explicitly, never automatically |
| A3 | Code already shows keepsakes on the closed screen (D29), but only when **Sharing** is on and the event hasn't been deleted. On Free there's one style per family | Reproduce what she saw first. It may be the sharing setting or the Free limits, not a bug |
| B1 | Copy | Find a softer phrase |
| B2 | Look is optional; skipping it still looks finished | Make "you can skip this" clearer before making the step smaller |
| C1 | product.md §9.3–9.4: the message is part of the capture and final once kept; keepsakes use the committed message | Product change. Conflicts with C3: decide whether the message stays at all first |
| C2 | product.md §10.5 rules out reordering. Full Set is always in commit order (invariant 14) | Product change; would touch the Full Set rules |
| C3 | Optional field in preview | Pilot data: how many guests actually write one? |
| C4 | product.md §8.3: hiding removes the photo from the guest's view | Product change. Trade-off: a host may hide a photo *because* it's embarrassing, and a "hidden by host" label tells the guest. Ask pilot hosts |
| C5 | Deliberately separate (product.md §13): the capture link never leads to the gallery, partly because a host can set the gallery to "only me" | Possible if it respects the gallery's visibility and reveal. Product change |
| C6 | product.md §7.2 and §16: one Free event per account, ever; self-service upgrades are a non-goal | Business decision first (§8 Pricing): does unlimited Free undercut Standard ₱499? Then product.md, then code (the one-Free guard, D16) |
| C7 | **Printing signage:** agreed as a separate, quoted add-on (Key decisions, product.md §11.3, §15). Nothing in the app records it yet, so handle it outside the app and keep it out of the Console's plan payment (progress.md "Release follow-ups"). **Photobook, slideshow:** Replay is post-MVP; a photobook editor and print ordering are non-goals | Printing: a product decision, then a build slice once hosts actually ask for it. Photobook and slideshow: ask pilot hosts what they'd pay for |

---

## Break (5 min)

---

## Section 5 — Our business vision (10 min)

**[EXPLAIN]** Two ways to deliver the same product:

| | **Managed FiveFrames event** | **Self-service FiveFrames event** |
|---|---|---|
| Who does the work | Us, with the host | The host alone |
| What's involved | Inquiry, a call/chat, setting up the theme and signage with them, maybe printing, being reachable (or present) on the day, making sure the gallery gets delivered, follow-up | Sign up, create, activate, share QR, open capture, reveal, download |
| How it's paid today | Manual payment confirmed by us | **Free event only** today. Paid self-service needs online payment switched on |
| What the app already supports | Support access (we act remotely, logged), capacity override, manual payment ledger | The whole host flow |
| What it feels like | An event supplier, like a photobooth | A tool, like an online invitation site |

> "Both run on the same platform. The difference is how much of *us* comes with it."

**[EXPLAIN]** Something we already promise: the site's Premium plan (₱999) includes
"We set it up with you" and "Direct help on the day". So we've already blended managed service
into the self-service price. We should decide if that's what we want.

**[DISCUSS]**

- What kind of business do we want FiveFrames to be in two years? A supplier people book, a tool people buy, or both?
- Do we want to physically attend events? How often, how far, on which days?
- Or would we rather set up remotely and be on call by Messenger/Viber during the event?
- What level of service should a customer expect from us? Response time? Weekend availability?
- Should we focus on one event type first (weddings? kids' birthdays? debuts? corporate)?
- What would make FiveFrames feel like a *real* event supplier to a coordinator? (A rate card? A sample print? A Facebook page with real events? An on-site person?)
- Is "Help on the day" at ₱999 sustainable if it means a person on call for a whole evening?

**[DECIDE]** For now, not forever:

| Question | Option A | Option B | Option C | Our choice |
|---|---|---|---|---|
| Lead with | Managed events | Self-service | Both, managed first | |
| First event type | Weddings | Birthdays/debuts | Whatever pilots we can get | |
| On-site presence | Never | Pilots only | Offered as a paid add-on | |

⚠️ Any service package we sketch today is a hypothesis. Pilots tell us what to actually sell.

---

## Section 6 — Pilot testing strategy (15 min)

**[EXPLAIN]** The plan so far: recruit events in **October 2026** to try FiveFrames for free.
Nothing is booked yet. Today is about shaping the offer.

> Note: progress.md says production already holds one "live pilot event". **[DISCUSS]** What
> did we learn from it, and does it count as pilot #1?

### Why pilots

- Prove it works at a real venue, on real phones, on real Wi-Fi.
- Learn whether hosts and guests actually value it.
- Learn how much of *our* time one event takes.
- Get real photos and words we can (with permission) use to sell.

### What we need to learn

| Question | How we'll know |
|---|---|
| Do guests join? | Guests joined ÷ rough number of attendees |
| Do they understand five + final? | Watch, ask a few guests, count support questions |
| Do uploads work at the venue? | Any failed/retried uploads, any complaints |
| Do hosts value the gallery? | Did they download it? Did they share the gallery link? What did they say? |
| How much work is it for us? | Log our hours per stage (§7) |
| Would they pay? How much? | Ask directly after (§6 feedback plan) |
| Does the keepsake spread? | Did guests share keepsakes? Did anyone ask "what's this?" |

### ⚠️ Pilot blocker to decide: how do we activate a free pilot?

The product has no "free pilot" activation. What exists:

| Option | How | Trade-offs |
|---|---|---|
| **1. Host's own Free event + we raise capacity** | Host signs up, activates their one Free event. We use the Console's capacity override (allowed on any plan; a reason is required and logged) | Works today. But Free gives only **7 days** of hosted access (+30-day download grace), **no printable signage** (on-screen QR, link and phone-screen sign only), and **one keepsake style per family**. And it uses the host's one Free event |
| **2. Real token payment** | Host pays something small for a paid plan; we confirm it in the Console | Honest and works today. But it's not "free", and the ledger should only record money actually received |
| **3. Build a "complimentary activation"** | A new operator action | ⚠️ **Future option, not built.** It's a product change: needs a decision, a product.md update and tests. Only worth it if Options 1–2 truly don't work |

Not an option: recording a payment that didn't happen. The ledger is our bookkeeping, and the
amount must be above ₱0 anyway.

**[DECIDE]** Pilot activation approach: ______________________

### Proposed initial pilot offer (draft for discussion)

> **FiveFrames pilot (free)**
> We set up FiveFrames for your event at no cost. In return, we ask for 15 minutes of honest
> feedback afterwards.

| Included (proposal) | Not included (proposal) |
|---|---|
| Setting up the event with the host (theme photo, color, hashtag) | Professional photography |
| QR signage: files, or a few printed table cards (decide) | Unlimited printing, stands, frames |
| Instructions for the host on opening/closing capture | Our physical presence (unless we choose it for a specific pilot) |
| Being reachable by chat during the event | Guaranteed result if the venue has no signal at all |
| Help downloading the full gallery after | Editing or retouching photos |
| | Any obligation to give a testimonial or let us use photos |

### Which events to accept

**[DISCUSS]** Suggested criteria:

- Roughly 20–150 guests (big enough to learn, small enough to recover from mistakes)
- Within reach of us if something goes wrong (decide: Metro Manila only? our province?)
- A host who's reachable before and after, and willing to give feedback
- A venue where at least mobile data works (ask in advance)
- Mix of event types if possible
- Not someone's once-in-a-lifetime wedding as the *very first* pilot (maybe start with a birthday or a family gathering)

**[DECIDE]**

| | Our answer |
|---|---|
| How many pilots can we realistically support in Oct–Nov? | |
| Max per weekend | |
| Geographic limit | |
| Remote only / on-site for the first one or two / case by case | |
| Event types we'll accept | |
| Who's our first ask (names) | |

### How we prepare each pilot

1. Intake chat: date, venue, guest count, venue signal, who will open/close capture
2. Host signs up, creates the event on **their own account** (we can guide by video call)
3. Activate (per the decision above)
4. Set the theme together (their photo, color, hashtag) — remotely via support access if needed
5. Prepare signage: send files, or print. ⚠️ Free events can't download printable formats
6. Test it ourselves: scan the real QR, check it opens the right event (don't keep a photo on their event)
7. Brief the host: "Open capture when guests arrive. Close it at the end. Message us if anything's off."
8. Agree the reveal: after the event (default), immediately, or a set time

### How we support the host on the day

- One of us on call, phone charged, laptop nearby
- If we're on-site: watch for confused guests, help them scan, observe (don't push)
- Things we can fix remotely via support access: open/close capture, reveal, hide a photo, change settings, rotate a link. Raising capacity is done separately in the Operator Console
- Things we can't: delete photos (host only), change the plan

### Pilot readiness checklist

Must be true before the first real pilot:

**Product / technical**
- [ ] Real-device pass done on at least one iPhone (Safari) and one Android (Chrome): join, keep five, retry after a failed upload, download, keepsake share/save (release-validation.md sections C and E)
- [ ] ⚠️ Decide on Messenger/Facebook in-app browsers: test them ourselves, or tell guests "open in your browser". Currently **deferred** (INAPP-01…03)
- [ ] A test at a place with bad signal (a mall, a function hall) — real network, not a simulation
- [ ] A printed QR scanned from a table at normal distance
- [ ] Production operator access granted to whoever runs support (and ideally a second sign-in factor)
- [ ] ⚠️ Server location: app functions run in US East while the database is in Singapore (progress.md follow-up "before real traffic"). Check how fast it feels from here; fix if slow
- [ ] Production test data cleaned up (planned, needs approval; never touches the live pilot event)
- [ ] Check the two broken photos noted in progress.md aren't in the live pilot event
- [ ] Sign-up confirmation email delivers reliably

**Business / trust**
- [ ] Terms and Privacy reviewed at least once by us, ideally a lawyer (they're drafts)
- [ ] `support@` / `privacy@fiveframes.app` mailboxes exist and someone reads them
- [ ] A contact channel for hosts decided (Messenger? Viber? email?) and set as `SALES_CONTACT`
- [ ] A short host instruction sheet (open capture, close capture, reveal, download)
- [ ] A short guest instruction line for signs and the MC ("Scan. You get five photos. Keep the ones that matter.")
- [ ] Our photo-privacy rule written down (§7)
- [ ] Feedback questions ready (below)

### Post-event feedback plan

**Host** (15-minute call or chat, within a week):
- What did you expect, and what actually happened?
- Did you look at the gallery? Download it? Share it?
- Which photos surprised you?
- Was anything stressful on the day?
- What would you change?
- Would you use it again? Recommend it? What would you have paid?
- **Separately and optional:** "Can we quote you?" and "Can we use a few photos in our marketing?" — **explicit, separate yes/no for each, never a condition of the pilot**. Ideally confirm in writing.

**Guests** (optional, light — never pushy):
- 2–3 casual in-person questions if we're on-site, or a short optional form the host may share
- "Was it easy? Did five feel like enough? Did you share a keepsake?"

**Us** (write within 48 hours):
- What broke, what confused people, what we had to fix remotely
- Hours spent at each stage (§7)
- Guests joined vs. attendees; photos per guest; how many kept all five
- One thing to change before the next pilot

### What counts as a successful pilot

**[DECIDE]** Suggested bar:
- [ ] No photos lost; every kept photo reached the host's gallery
- [ ] The host downloaded their gallery
- [ ] No privacy incident
- [ ] Most guests who tried joined without help
- [ ] We know how many hours it cost us
- [ ] We got honest feedback, including "what would you pay"

---

## Section 7 — Operating FiveFrames as a service (7 min)

**[EXPLAIN]** The whole flow, lightweight. Manual is fine for pilots: a shared notes doc and a
chat thread per client are enough. No CRM or booking system until we actually feel the pain.

| Stage | What happens | Who (open) | Tools / materials | What could go wrong | Decide |
|---|---|---|---|---|---|
| **Inquiry** | Someone messages us | | Messenger / FB page / email | Slow reply, lost lead | Which channel is official? Response time? |
| **Qualification** | Date, size, venue, signal, budget, who runs it on the day | | A short question list | Venue with no signal; too big for us | Our "yes" criteria |
| **Confirmation** | Agree plan/price (or pilot terms); payment if any | | GCash/bank account; Console to confirm | Paying into a personal account; unclear terms | Business receiving account? Written terms? |
| **Event prep** | Host signs up and creates event; theme set together | | Video call; support access | Host never finishes setup | Do we do it live on a call? |
| **QR / signage** | Download, print, deliver or send files | | Printer/print shop; stands | Print too small/blurry; wrong event's QR | Who prints and pays? Lead time? |
| **Event day** | Host opens capture; we're on call or on-site | | Phone, laptop, support access | Host forgets to open capture; bad signal; confused guests | On call hours; on-site or not |
| **Gallery delivery** | Close capture, review, reveal, host downloads | | Photos tab; Download all | Host never downloads before expiry | Do we remind them? Do we download a backup (logged)? |
| **Feedback** | Call/chat with host | | Questions in §6 | Host ghosts us | When we ask, how |
| **Follow-up** | Thank-you, ask permission (separately) for testimonial/photos, ask for referrals | | Message template | Pushy feel | What we ask, and when |

**[DISCUSS]** Practical questions:

- **How do we talk to clients?** One shared business number/page, or personal accounts?
- **How much prep per event?** Guess now, measure in pilots: ______ hours.
- **Who controls the event on the night?** The host, by default. We step in via support access only when asked (or agreed in advance).
- **Do we need to be there?** For the first pilot or two, maybe yes, mostly to watch and learn.
- **Poor connectivity?** Uploads retry without losing frames, and guests can keep shooting with their normal camera and upload later while capture is open. Ask about venue signal beforehand. Suggest the host keeps capture open until the next morning so late uploads still work (safety net closes 72h after the event date).
- **How do guests get instructions?** Table cards and the poster say "No app. No account." Ask the MC/host to mention it once.
- **When something goes wrong?** Who calls whom, within how long? Write a one-paragraph "if it breaks" plan.
- **Photo privacy (our rule):** we don't look at a customer's photos unless they ask us to help. Support access logs every view, and the host sees it. We never post their photos without separate written permission.
- **After the event:** Free events expire after 7 days (paid: 6 or 12 months), then 30 days of download-only grace, then automatic permanent deletion. ⚠️ The expiry warning is only shown inside the app, not emailed. **We** should remind pilot hosts to download.

---

## Section 8 — Registration, finances, and pricing (10 min)

⚠️ **None of this is legal or tax advice.** Everything below is a list of things to verify with
official sources (DTI, SEC, BIR, our LGU, the National Privacy Commission) or a local
accountant/lawyer. Requirements, fees and timelines change.

### Business structure

**[DISCUSS]**

| Option | Roughly | Questions to research |
|---|---|---|
| **Sole proprietorship** | Registered under one person's name (business name via DTI) | Whose name? How do we split ownership between us? Liability? |
| **One Person Corporation (OPC)** | A corporation with one owner, via SEC | Cost and paperwork vs. sole prop? Still one owner — does that fit two founders? |
| **Start sole prop, incorporate later** | Common path | What's the trigger to switch (revenue, partners, risk)? |
| **Other (e.g. partnership, regular corporation)** | Two owners | Worth asking an accountant, since there are two of us |

### Registration checklist (verify each)

- [ ] Business name registration (DTI for sole prop / SEC for corporations)
- [ ] BIR registration, books of accounts, invoicing/receipt requirements (rules have changed recently — verify current)
- [ ] Barangay clearance and Mayor's/business permit from our LGU
- [ ] Data Privacy Act obligations: we store guests' photos and names. Whether NPC registration applies to us — verify
- [ ] What PayMongo (or another provider) needs for KYC before we can switch online payment on — likely a registered business (verify)

### Money basics

**[DISCUSS]**
- Separate business account (bank and/or GCash/Maya) — when?
- Where do customer payments go *today*? (progress.md lists "manual-payment receiving account(s)" as an open decision.)
- Who tracks income and expenses, and where? (A spreadsheet is enough. The Console's payments ledger has a monthly export for this.)
- Do we pay ourselves anything yet? (Probably not — but say it out loud.)
- How much personal money are we willing to put in before it pays for itself?

### Budget worksheet

Fill in actual monthly costs from the billing dashboards. I'll check these before the meeting:
Vercel (hosting), Supabase (database), Cloudflare R2 (photo storage), the `fiveframes.app` domain.

| Item | One-time (₱) | Monthly (₱) | Per event (₱) | Notes |
|---|---|---|---|---|
| Hosting (Vercel) | | | | Check current plan |
| Database (Supabase) | | | | Check current plan |
| Photo storage (Cloudflare R2) | | | | Grows with photos |
| Domain (fiveframes.app) | | | | Yearly renewal |
| Email (support@, privacy@, sign-up emails) | | | | |
| Printing and signage (cards, stands) | | | | |
| Transportation | | | | |
| Event-day support (our time, food) | | | | |
| Business registration and permits | | | | |
| Accountant / lawyer review | | | | |
| Payment processing fees | | | | Only once online payment is on |
| Marketing (ads, printed samples) | | | | |
| Contingency (~10–20%?) | | | | |
| **Total** | | | | |

**[DECIDE]** Starting budget for the next 3 months: ₱ __________

### Pricing

**[EXPLAIN]** What's in the product today (`lib/plans/registry.ts`, product.md §15.3):

| | Free | Standard | Premium |
|---|---|---|---|
| Price | ₱0, first event only | ₱499 | ₱999 |
| Guests (browsers) | 10 | 100 | 300 |
| Hosted access | 7 days | 6 months | 12 months |
| Printable signage | — | ✓ | ✓ |
| Keepsake styles | 1 per family | 5 per family | 5 per family |
| "Set up with you" + "Help on the day" | — | — | ✓ (on the site) |

⚠️ **Discrepancy to settle:** I've been thinking of self-service as "₱999 per event". The code
and product.md actually have two paid prices (₱499 Standard, ₱999 Premium), and ₱999 *includes*
human set-up and day-of help. product.md calls both prices hypotheses to validate.

**A. Self-service pricing** — **[DISCUSS]**
- Keep ₱499 / ₱999? Is ₱999 right if it includes our time?
- Should Premium's human help move into the managed service instead?
- When do we switch online payment on (needs PayMongo live account + KYC)?

**B. Managed-service pricing** — no prices yet. A way to decide:

| Input | How to estimate | Our number |
|---|---|---|
| Direct costs per event (printing, travel, platform) | From the budget sheet | ₱ |
| Our hours per event | Measured in pilots | hrs |
| What an hour of our time is worth | Our choice | ₱/hr |
| Service level (remote / on-site / printed kit) | Tiers we choose | |
| What similar suppliers charge | Ask coordinators; **don't guess** | |
| What pilot hosts say they'd pay | §6 feedback | |

Rough formula to start from: *costs + (hours × hourly rate) + margin*, then sanity-check
against what hosts said and what a photobooth package costs locally (real quotes, not guesses).

**[DECIDE]** Do we set managed prices now, or after the pilots? (Suggestion: after.)

---

## Section 9 — Marketing, sales, and partnerships (7 min)

### How to say it simply

**Elevator pitch:**
> "FiveFrames gives every guest at your event five photos. They scan a QR, no app, and shoot the
> moments that matter to them. You get one private gallery of your event, through your guests'
> eyes."

**Casual, to a friend who's planning an event:**
> "You know how after a wedding everyone's photos are stuck on their phones? With this, guests
> scan a code at their table and get five shots each. No app. After the party you get all of
> them in one album."

**To a supplier (coordinator, photographer, photobooth):**
> "It doesn't compete with you. The photographer covers the big moments, the booth is the fun
> station. We collect the guests' own candid shots, five each, into one gallery for your client.
> It's an easy add-on, and it makes the client's memory of the event bigger."

**What to avoid:** "app", "platform", "AI", "unlimited", "social". Lead with the five and the
gallery, not the tech.

### Channels

**[DISCUSS]** Where to start (rank 1–3):

| Channel | Why it might work | Effort | Rank |
|---|---|---|---|
| Friends and family with upcoming events | Warm, forgiving, good for pilots | Low | |
| Facebook groups (wedding, events, local) | Where hosts ask for suppliers | Medium | |
| Reddit (r/Philippines, wedding subs) | Feedback on the idea | Low | |
| Wedding/event coordinators | One coordinator = many events | High, slow | |
| Photographers | Natural complement | Medium | |
| Photobooth suppliers | Could bundle us | Medium | |
| Venues | Recurring events | High | |
| Referrals from pilots | Strongest proof | Low, later | |
| Shared keepsakes (built-in) | Every share carries our mark | Free, passive | |

### Common objections

| They say | We might say |
|---|---|
| "We already have a photographer." | "Great — we're not replacing them. We collect what the guests see, which the photographer can't be everywhere for." |
| "Guests can just send photos to a group chat." | "They can, but they rarely do, and it's scattered and compressed. This is one private gallery, full quality, that you control." |
| "Only five? Why not unlimited?" | "Because unlimited gets you 2,000 blurry photos nobody looks through. Five makes people choose, and keeps them enjoying the party." |
| "My guests are older / not techy." | "It's one QR scan and a first name. No app, no sign-up." *(Only claim this once pilots show it.)* |
| "What if the Wi-Fi is bad?" | "Uploads retry without losing a shot, and guests can upload later while capture is open." |
| "Is it private?" | "The gallery is hidden until you reveal it, and you can keep it to yourself only." |
| "How much?" | Current prices — or pilot offer |

### Questions to validate with real people (not assume)

- Who decides to book it: couple, parents, coordinator?
- Is it a "must have", "nice to have", or "cute but no"?
- Would they pay more for us to handle it (managed) or less to do it themselves?
- Is five the right number for them?
- Do suppliers see us as a complement or a competitor?

⚠️ We have no partnerships or confirmed customer interest yet. Everything above is to test.

---

## Section 10 — Our roles and responsibilities (5 min)

**[DISCUSS]** Nothing here is pre-assigned. I build the software, but that doesn't mean
everything technical is mine and everything else is hers.

- What do you enjoy? What do I enjoy?
- What does each of us *want to learn*?
- How many hours a week can each of us realistically give FiveFrames, alongside work and home?
- How do we make decisions? (Both agree? Owner decides, other can veto?)
- What always needs both of us? (Suggestion: spending over ₱____, taking a client, pricing, legal registration, anything public with our names on it.)
- How do we handle disagreements? (e.g. sleep on it, then decide; or the owner of that area has the final say)
- Do we keep FiveFrames talk to a set time each week, so it doesn't take over home life?

**[DECIDE]**

| Responsibility | Owner | Backup | Notes |
|---|---|---|---|
| Product development | | | |
| Technical operations (uptime, fixes, operator access) | | | |
| Client inquiries | | | |
| Event coordination (prep, day-of) | | | |
| Branding (look, social pages) | | | |
| Marketing and outreach | | | |
| Customer support (day-of chat) | | | |
| Supplier relationships (coordinators, printers) | | | |
| Financial tracking | | | |
| Pilot feedback (collecting and summarizing) | | | |
| Business administration (registration, permits) | | | |

Weekly time commitment — Me: ____ hrs. Her: ____ hrs.

---

## Section 11 — Risks and what could go wrong (3 min — read together)

### Technical risks

| Risk | Realistic scenario | Impact | Reduce it by | If it happens |
|---|---|---|---|---|
| **Event-day outage** | Site down or very slow during the reception | Guests can't join; host embarrassed | Real-device test pass; check hosting status before the event | Tell the host fast; guests keep shooting normally and upload later while capture is open |
| **Poor venue signal** | Function hall basement, 150 phones on one Wi-Fi | Uploads slow or fail | Ask about signal in advance; test on-site if possible | Retry keeps frames; keep capture open overnight |
| **Failed uploads** | Guest gives up after an error | Fewer photos, frustration | Clear Retry exists; brief host on it | Reassure: the shot isn't lost until it's kept |
| **Photo lost** | A kept photo is missing or broken | Biggest trust breaker | Real-device tests; check the 2 broken photos noted in progress.md | Investigate immediately; be honest with the host |
| **Gallery access mistake** | Gallery link shared publicly by accident | Privacy breach | Default is hidden until reveal; "only me" option | Rotate or revoke the gallery link immediately (Settings → Links) |
| **In-app browser issues** | Guests open the link in Messenger and it misbehaves | Can't join or save | Test INAPP cases ourselves before pilots | Tell guests "open in Chrome/Safari"; put it on signs if needed |
| **iPhone photo formats** | Raw HEIC upload fails at processing | Retry error, confused guest | Run IOS-03 on a real iPhone | Guest picks a different photo or uses the camera |
| **Accidental production change** | Testing a fix touches real customer data (there's no separate dev environment yet) | Data loss | Create a separate dev environment before more risky work (progress.md follow-up) | Stop; assess; tell affected host |
| **Missed expiry** | Free pilot host doesn't download within 7 days + 30 | Photos deleted permanently | Remind them ourselves; agree timing | Nothing to recover after deletion — prevent it |

### Business / operational risks

| Risk | Realistic scenario | Impact | Reduce it by | If it happens |
|---|---|---|---|---|
| **Low guest participation** | Only 10 of 100 guests join | Thin gallery, host disappointed | Visible signs, MC mention, table cards | Learn why; adjust signs/briefing |
| **Confusing QR instructions** | Guests think it's a menu or a survey | Low participation | Clear sign copy: "Scan. You have five frames." | Walk around and help (if on-site) |
| **Guests don't get "five, final"** | Guest upset they can't delete a photo | Complaint | Preview step explains it; host briefing | Host can hide/delete from gallery (frame isn't returned) |
| **Customer complaint** | Host unhappy with the result | Reputation, refund request | Set expectations in writing beforehand | Listen, fix what we can; refunds are manual (Console) |
| **Last-minute requests** | "Can you print 30 table cards by tomorrow?" | Stress, cost | Lead times in our terms | Say yes only if we can; charge if not a pilot |
| **Underestimating our time** | One "small" event eats a whole weekend | Burnout, wrong pricing | Log hours per stage | Adjust pricing / scope before next event |
| **Pilots don't teach us much** | Friendly hosts just say "it was nice!" | No real learning | Specific feedback questions; our own observations | Add a different type of pilot host |
| **Free event limits bite** | Pilot needs printable signs or more than 7 days | Poor pilot experience | Decide activation approach (§6) | Capacity override; print phone-screen sign ourselves (quality: verify) |
| **Legal/privacy gap** | A guest asks to have their photo removed or asks what we store | Trust, compliance | Legal review; written privacy rule | Host can delete; we explain honestly |

---

## Section 12 — Decisions we need to make

Fill in during the meeting. Three kinds:

- **TODAY** — we should decide in this meeting
- **DEFER** — fine to leave for later, but put a date on it
- **RESEARCH** — needs outside information first

### Product readiness

| Decision | Options | When | Our choice | Reasoning | Follow-up |
|---|---|---|---|---|---|
| What must be fixed before pilot #1 | §4 bucket A list | TODAY | | | |
| In-app browsers (Messenger, FB, IG) | Test ourselves / tell guests to use their browser / both | TODAY | | | |
| Finish the real-device test pass before pilots | Yes / partial | TODAY | | | |
| Separate dev environment before more changes | Now / after pilots | DEFER | | | |

### Pilot scope

| Decision | Options | When | Our choice | Reasoning | Follow-up |
|---|---|---|---|---|---|
| How we activate free pilots | Free + capacity override / token payment / build something | TODAY | | | |
| Number of pilots, Oct–Nov | 1 / 2–3 / 4+ | TODAY | | | |
| Event types and size | | TODAY | | | |
| Geographic limit | | TODAY | | | |
| On-site for first pilot? | Yes / no | TODAY | | | |
| What's included free | §6 table | TODAY | | | |
| Success criteria | §6 list | TODAY | | | |

### Business direction

| Decision | Options | When | Our choice | Reasoning | Follow-up |
|---|---|---|---|---|---|
| Lead with managed, self-service, or both | | TODAY (for now) | | | |
| First target event type | | DEFER to after pilots | | | |
| Does Premium keep "set up with you / help on the day"? | Keep / move to managed tier | DEFER | | | |

### Service operations

| Decision | Options | When | Our choice | Reasoning | Follow-up |
|---|---|---|---|---|---|
| Official client contact channel | Messenger / Viber / email / phone | TODAY | | | |
| Day-of support hours | | TODAY | | | |
| Our photo-privacy rule | §7 draft | TODAY | | | |
| Who gets operator access | Me / both / later | TODAY | | | |

### Budget

| Decision | Options | When | Our choice | Reasoning | Follow-up |
|---|---|---|---|---|---|
| 3-month budget | | TODAY | | | |
| Spending limit without asking each other | | TODAY | | | |

### Registration

| Decision | Options | When | Our choice | Reasoning | Follow-up |
|---|---|---|---|---|---|
| Sole prop / OPC / other | | RESEARCH | | | |
| Whose name | | RESEARCH | | | |
| Register before or after pilots | | RESEARCH | | | |
| Lawyer review of Terms/Privacy | Now / before paid sales | DEFER | | | |

### Marketing

| Decision | Options | When | Our choice | Reasoning | Follow-up |
|---|---|---|---|---|---|
| First 1–2 channels | §9 table | TODAY | | | |
| Facebook page now or after pilots | | DEFER | | | |
| Self-service prices (₱499/₱999) | Keep / change | DEFER to after pilots | Standard ₱499, **Premium ₱1,399** | Premium is the managed plan: we set it up with them and help on the day, so it's priced for our time | Updated in the app and product.md; goes live with the next deploy |
| Managed-service prices | | RESEARCH + pilots | | | |

### Responsibilities

| Decision | Options | When | Our choice | Reasoning | Follow-up |
|---|---|---|---|---|---|
| Owners per area | §10 table | TODAY | | | |
| What needs both of us | | TODAY | | | |
| Weekly check-in time | | TODAY | | | |

---

## Section 13 — Action plan

Only what's needed to run a good real-world pilot. No feature wish lists.

### Before our first pilot

| Task | Owner | Priority | Target date | Status |
|---|---|---|---|---|
| Real-device pass: iPhone + Android, join → keep five → retry → download → keepsake | | High | | |
| Test Messenger/FB in-app browser ourselves (or decide on "open in browser" copy) | | High | | |
| Bad-signal test somewhere real | | High | | |
| Print and scan a table card at a table | | High | | |
| Grant production operator access; add a second sign-in factor if possible | | High | | |
| Check app speed from the Philippines (US East vs Singapore follow-up) | | High | | |
| Check the 2 broken photos in progress.md aren't the live pilot event's | | High | | |
| Clean up production test data (read-only inventory first, never the live pilot) | | Medium | | |
| Set up support@ / privacy@ mailboxes | | High | | |
| Choose contact channel and set `SALES_CONTACT` | | Medium | | |
| Host instruction sheet (1 page) | | High | | |
| Signage/MC guest instruction line | | Medium | | |
| Feedback questions (host + internal) | | Medium | | |
| Decide pilot activation approach | | High | | |
| List of first pilot hosts to ask | | High | | |

### During pilot events

| Task | Owner | Priority | Target date | Status |
|---|---|---|---|---|
| Intake chat and venue signal check | | High | | |
| Set up event with host (their account) | | High | | |
| Signage prepared and checked | | High | | |
| On call during event | | High | | |
| Log issues and hours | | High | | |

### After pilot events

| Task | Owner | Priority | Target date | Status |
|---|---|---|---|---|
| Remind host to download (esp. Free: 7 days) | | High | | |
| Host feedback call | | High | | |
| Internal notes within 48h | | High | | |
| Separately ask for testimonial / photo permission (optional, in writing) | | Low | | |
| Sort learnings into fix / later / validate | | Medium | | |

### Business setup

| Task | Owner | Priority | Target date | Status |
|---|---|---|---|---|
| Research sole prop vs OPC vs other (official sources / accountant) | | Medium | | |
| Research BIR, permits, Data Privacy Act obligations | | Medium | | |
| Pull real monthly platform costs into the budget sheet | | Medium | | |
| Decide receiving account for payments | | Medium | | |
| Lawyer review of Terms/Privacy (before paid sales) | | Medium | | |

### Marketing and outreach

| Task | Owner | Priority | Target date | Status |
|---|---|---|---|---|
| Message 5–10 people with upcoming events | | High | | |
| Talk to 2–3 suppliers (coordinator, photographer, booth) to test the pitch | | Medium | | |
| Practice the elevator pitch on 3 friends; note reactions | | Low | | |

---

## Section 14 — Meeting notes and outcomes

**Key decisions**
- Premium goes from ₱999 to ₱1,399, because it's the managed, hands-on plan. Standard stays ₱499
- Signage is sold as **print-ready files**, not printed items. If a host asks us to print, it's a separate add-on we quote first and they agree to before we print or charge anything. Never a hidden charge. The site, the host screens and the Terms now say so
-
-

**Open questions**
-
-

**Product feedback** (see §4 buckets)
- Must fix before the first pilot: confirm on Keep (A1), make "open capture" the main button (A2), check keepsakes after capture closes (A3)
- She'd pay for it, keepsakes feel special, the gallery is the most valuable part, nothing on the guest side confused her
-

**Business ideas (parked, not tasks)**
- Unlimited small Free events (≈30/month), upgradable for more guests. Leads into a "memories" mobile app (C6, discuss under §8 Pricing)
- Paid add-ons on top of a plan: printing the signage (agreed, handled outside the app for now), a physical photobook album, a video slideshow / highlights (C7)

**Agreed responsibilities**
-
-

**Budget decisions**
-

**Pilot commitments**
- Number of pilots:
- First pilot target date:
- First people we'll ask:

**Next meeting date:** ______________________

---

## Section 15 — Closing

**[EXPLAIN]** Something like:

> "We don't have to build everything, or decide everything, right now. The product is mostly
> there. Our next milestone is simple: run FiveFrames at one real event, have it work, and learn
> from it. Then we decide how to grow — managed, self-service, or both — based on what actually
> happened, not what we imagine."

### Did this meeting work?

- [ ] We can both explain FiveFrames in one sentence
- [ ] She has used the product end to end, as host and as guest
- [ ] We know what blocks a real pilot, and who's handling each blocker
- [ ] We have a first direction (not a final one)
- [ ] We have a pilot plan: how many, what kind, what's free, what success means
- [ ] We know what to research about registration and money
- [ ] Each of us owns something specific
- [ ] Action items have owners and dates
- [ ] Meeting #2 is on the calendar

---

## Appendix — Where things live (for me)

| Topic | Source |
|---|---|
| What the product is meant to do | `docs/product.md` (authoritative) |
| Current status, blockers, follow-ups | `docs/progress.md` ("Next step", "Release follow-ups") |
| What's tested and what isn't | `docs/release-validation.md` |
| Plans and prices | `lib/plans/registry.ts` |
| Payment mode and contact link | `lib/payments/mode.ts` |
| Safety-net close, grace period, expiry warning | `lib/events/policy.ts` |
| Site copy (incl. Premium service promises) | `lib/marketing/content.ts` |
| Terms / Privacy drafts | `lib/marketing/legal.ts` |

### Discrepancies noticed while preparing this

| What | Says | Actually |
|---|---|---|
| Self-service price | My working assumption: ₱999/event | Code and product.md: Free (first event), Standard ₱499, Premium ₱999; ₱999 includes human set-up and day-of help |
| "Self-service" | Hosts can buy and run events alone | Online payment is off. Self-service today = the one Free event. Paid events need us, and there's no contact link yet |
| Free pilots | "Free for pilots" | No ₱0 paid activation exists. Free plan has 10 guests (raisable), 7 days, no printable signage |
| Guest capacity | `CLAUDE.md` and an older progress.md note mention 250 per event | Code and product.md: 10 / 100 / 300 by plan |
| Price target | An older progress.md note mentions moving from ₱999 toward ₱1,490 | product.md now treats ₱499 / ₱999 as the hypotheses |
| Host event deletion | product.md lists "or host deletes" in the lifecycle | Not built (progress.md "Other open items") |
| "After payment · Share" | New-event timeline (`/events/new`) and Settings → Links say links come "after payment" | Free events activate without payment; setup page says "After activation". Minor copy inconsistency |
