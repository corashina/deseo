---
target: Today
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/user/deseo/apps/web/src/features/today"
timestamp: 2026-11-17T10-58-41Z
slug: apps-web-src-features-today
---
Method: dual-agent (A: A-today · B: B-today)

# Critique: Today (rescore, 2026-11-17)

Evidence: design-capture run on master a9c61d0, 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 27/40, 68%.** Baseline: 26/40. P0: 0 · P1: 1 · P2: 3 · P3: 1 (Assessment A).

P1 findings, all fixed in PR #35:

- The conversation is the smallest region on a chat-first screen

P2 and P3 findings stay open for a later pass. Assessment B lists the detector results and visible defects. Questions are in Assessment A.

## Assessment A: design review


## Design specificity verdict

**Mostly authored, inside a category-standard frame.** A chat column with an info rail is the messaging default. Deseo's own moves sit inside it: the peach pinned note, sender-shaped rose and teal bubbles, the owner-tinted next plan card with its owner glow, and the owner-dot week strip. The next plan card is the one real signature move. Below 1200px it is gone: the neutral `sidebar` chip has no owner color, so the phone screen looks like any pastel chat app.

**Coherence.** At 1440px the columns read as one screen: note and next plan share a top edge (about 206px), the pastel vocabulary matches, and both columns end near the same line. The weight is wrong. The conversation, the primary job, is the smallest and quietest region: a roughly 240px slot between the note and a roughly 290px composer. The next plan card is the loudest object.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Sent on latest own message, Sending…, Not sent + Retry, and loading text are all good. The read-cursor failure is the only status that is easy to miss. |
| 2 | Match system / real world | 3 | "Tomorrow" sits above "11/17/2026, 11:00 PM – 11/18/2026, 1:00 AM". That is machine format under a human label. |
| 3 | User control and freedom | 3 | Delete has a dialog with Cancel. Unpin is one tap. Escape closes the actions menu. The unsaved-text warning works. |
| 4 | Consistency and standards | 3 | Date formats differ in one panel: numeric in the next plan, "Nov 18 – 19" in the event row. The button says "Confirm deletion" where the rule is action labels. |
| 5 | Error prevention | 3 | Empty and over-limit sends are blocked. The counter appears after 3,600 characters. A retry reuses the client ID. |
| 6 | Recognition rather than recall | 3 | Week strip days look tappable but are not links. Below 1200px the week, the plans list, and the memory leave Today. |
| 7 | Flexibility and efficiency | 2 | No keyboard send (Ctrl/Cmd+Enter) in a chat composer. Week strip days are not shortcuts to the calendar day. |
| 8 | Aesthetic and minimalist design | 2 | The chat-first screen gives chat the least space. At 390px the message viewport is about 165px, less than one message. |
| 9 | Error recovery | 3 | Failures sit on the message and keep the body. Below 1200px the Today load error falls under the composer. |
| 10 | Help and documentation | 2 | Empty states teach ("Keep a moment together"). Upcoming plans has no creation action. There is no other contextual help. |
| **Total** | | **27/40** | **Acceptable** |

## Cognitive load

Failures: **2 of 8 (moderate)**.

- **Single focus: fail.** From 1200px the 30px/800 next plan title (4 lines here) pulls the eye from the conversation and Send message.
- **Visual hierarchy: fail.** "Today", the next plan title, the composer card, and the primary button compete. The conversation has the least weight.
- Over 4 options: the composer card has 5 (field, Send message, Add event, Add task, Add memory), acceptably grouped. The panel has about 10 links at 1440px, grouped per card.

## Emotional journey

- **Peak:** the next plan card. The owner tint, the glow, and "Tomorrow" make the shared plan feel anticipated. The peach note feels personal.
- **Valley:** on a phone, the screen opens on a chip, a note, one clipped bubble, and a large form. The bubble cut by the hard `line` border reads as a fault, not a scroll region.
- **Reassurance:** strong at send. "Sending…" becomes "Sent"; a failure keeps the text with Retry. The delete dialog names the effect on pinned notes.

## What's working

1. **Next plan card** (`planning.css` `.next-plan`): one focal object that says when and for whom, in the owner's color.
2. **Pinned notes** (`messages.css` `.note-card`): a warm register, a 2-line clamp, a lone note fills the row, long names wrap.
3. **Conversation rhythm** (`messages.css` lines 8–15): 24px between speakers, 8px within a run, sender-shaped corners. The composer stays in view.

## Priority issues

1. **[P1] The conversation is the smallest region on a chat-first screen**
   - **Where:** `messages.css` `.message-composer` and `textarea`, and `Composer.tsx`, at all widths; worst at 390px (about 165px viewport) and 1440px (about 240px).
   - **Why:** The main job of the screen is reading and replying. At 390px a person sees less than one message at a time.
   - **Fix:** Start the textarea at 1 row (48px), growing to about 5 lines. Put Send message at the end of the field row from 768px. Put the Add links on the counter row. Cut card padding to 12/16px. This saves about 120px.
   - **Command:** layout

2. **[P2] The next plan card outshouts the conversation and pushes the rest of Our day below the fold**
   - **Where:** `planning.css` `.next-plan strong` (30px/800) and the `NextPlanCard.tsx` meta line, at 1440px.
   - **Why:** A 4-line title and a 4-line meta run-on take about 300px. Due tasks, the important date, and the memory hide in the panel scroll with no cue.
   - **Fix:** Clamp the title to 2 lines. Split the meta into a time line (tabular numbers), a place line clamped to 1 line, and an owner badge.
   - **Command:** distill

3. **[P2] Overnight times show numeric full dates under a day label**
   - **Where:** `NextPlanCard.tsx` `formatRange(..., 'time')`, at 1440px.
   - **Why:** "Tomorrow" above "11/17/2026, 11:00 PM – 11/18/2026, 1:00 AM" repeats the day in machine format and conflicts with "Nov 18 – 19" in the row below.
   - **Fix:** When the label names the day, show "11:00 PM – 1:00 AM", plus "next day" for an overnight end.
   - **Command:** clarify

4. **[P2] Below 1200px the Today load and error states land under the composer**
   - **Where:** `TodayPage.tsx` lines 37–41 and the `planning.css` media query.
   - **Why:** Status and Retry become a second grid row below the conversation. On error the empty `day-chips-pending` row stays as a blank 48px band.
   - **Fix:** Below 1200px, show loading and error in the chip row ("We could not load your day." + Retry). Show the panel status only from 1200px.
   - **Command:** harden

5. **[P3] No keyboard send in the composer**
   - **Where:** `Composer.tsx`.
   - **Why:** The most frequent portal action needs a pointer trip.
   - **Fix:** Ctrl/Cmd+Enter submits. Enter keeps adding a line.
   - **Command:** polish

## Persona red flags

- **Casey (mobile):** at 390px, header, title, chip, and note take about 380px; the composer about 290px. One bubble shows, its sender name scrolled off the top.
- **Riley (stress tester):** a cross-midnight event shows a raw numeric range. 80-character titles grow the next plan card to about 300px. A Today error below 1200px lands under the composer, with a blank chip row above.
- **Alex (power user):** no Ctrl/Cmd+Enter. Week strip days are not links. Pin and delete take two clicks through "…".
- **The planning partner (PRODUCT.md, on a phone):** with no due tasks or important date, Our day is one chip. No "nothing due" reassurance, no week, no memory.

## Minor observations

- `Conversation.tsx`: "Confirm deletion" should be "Delete message" (PRODUCT.md button rule). "Not sent" differs from DESIGN.md "Message not sent. Retry".
- `OurDayPanel.tsx`: empty Upcoming plans has no Add event link (DESIGN.md No events state).
- `WeekStrip.tsx`: the next plan's day (Tue 17) is not marked.
- `planning.css` `.day-chips a`: in dark mode `sidebar-dark` on `canvas-dark` nearly disappears.
- `messages.css` line 5: the list `border-top` cuts the top bubble hard; more top padding or a short fade would read as scroll.
- `Conversation.tsx`: a just-pinned note repeats the newest message about 100px below it.

## Bolder move proposals

1. **Owner-colored next plan chip below 1200px** (colorize): owner soft fill and dot in place of `sidebar`. It brings the signature move to phones and fixes dark-mode visibility.
2. **Tie the next plan card to the week strip** (bolder): ring its day in the owner accent and make each day a calendar link, so card and strip read as one object.

## Questions to consider

- If the conversation is the primary job, why is the composer the largest object on the screen?
- Does Today need a "Today" headline, when the nav and the date eyebrow already say it?
- Should a 1024px desktop lose the whole week because the panel needs 360px? What would a 300px panel cost?


## Assessment B: detector and rendered evidence


## Detector counts

**Source scan** (`impeccable detect --json apps/web/src/features/today apps/web/src/features/messages`, 14 files): **0 findings**, exit 0.

**Rendered scan** (`capture/today/today.detect.json`, 1440px light): **1 finding**

| Rule | Severity | Selector | Snippet |
|---|---|---|---|
| kicker-above-heading | warning | `header.page-header > div > span.eyebrow` | "Monday, November 16" above h1 "Today" |

## Verified findings

| # | Sev | Finding | File | Command |
|---|---|---|---|---|
| 1 | P1 | The conversation column falls to its 160px floor. At 390x844 it shows less than one message, and the only bubble has its sender line scrolled out of view. At 768–1440 (900px window) it shows about 180–240px, so 1–2 bubbles. The composer takes about 290px: label, 3-row textarea (88px min), a full row for Send message, and a row of links. With chips and a pinned note above, the conversation gets what is left. DESIGN.md calls Today chat-first. | `apps/web/src/styles/messages.css:5` (`min-height:160px`), `:33–39`; `features/messages/components/Composer.tsx:20–22` | layout, adapt |
| 2 | P2 | The next plan time range prints full numeric dates when it crosses midnight: "11/17/2026, 11:00 PM – 11/18/2026, 1:00 AM". The label already says "Tomorrow", and the event row below uses "Nov 18 – 19". `formatRange(..., 'time')` goes through `Interval.toLocaleString`, and Intl adds the dates because the days are different. | `features/today/components/NextPlanCard.tsx:18`, `lib/format.ts:25` | clarify |
| 3 | P3 | The rule at the top of the conversation runs 8px past both card edges. The cause is the negative inline margin (`margin:0 calc(-1*var(--space-2))`) that keeps room for focus rings. You can see it at x=280 against the card at x=288 (1440), and in the same place at 1024 and 768. | `styles/messages.css:5` | polish |
| 4 | P3 | Composer card padding is 20px on desktop and 16px on mobile. The card token and DESIGN.md say 24px and 20px. | `styles/messages.css:33,53` | polish |
| 5 | P3 | The pinned note uses a 12px radius and 12px/16px padding. The frontmatter `note-card` component says 20px radius and 24px padding. The prose ("compact rows") agrees with the CSS, so the frontmatter and tokens.json need a compact note entry, or the CSS must follow the token. | `styles/messages.css:42`, `DESIGN.md` frontmatter `components.note-card` | extract |
| 6 | P3 | Type and spacing are literal px values, not variables. Most are on the scale: `.section-heading` gap 16px and margin 24px (planning.css:1, :60), `.next-plan strong` 30px/800/-.035em (:73), countdown 19px and 40px (:58–59), and week strip 12px and 16px (:66, :68). Day chips and composer links use 14px/600, which matches no type token (button is 15/600, body-small is 14/400). | `styles/planning.css:89`, `styles/messages.css:39` | extract, typeset |

## False positives

- **kicker-above-heading** (rendered): DESIGN.md, Today: "Show the date in the eyebrow above the title". The page-header eyebrow is the documented pattern. `.impeccable/config.json` now ignores this rule for `apps/web/src/**`. That entry was added 2026-11-17 10:49, after the capture at 2026-11-16 21:16. Note: the entry matches by file glob, and the rendered result reports `file: http://127.0.0.1:4174/today`. The next `--cdp` run will likely report it again unless the ignore also covers rendered URLs.

## Visible defects from screenshots

| Screen | Width | Mode | Defect | Cause |
|---|---|---|---|---|
| today | 390 | light, dark | Conversation is a ~160px slot. One bubble is visible, and its sender name is above the visible area, so only "10:16 PM" shows. | Finding 1: `.conversation` min-height plus composer height |
| today | 768, 1024 | light | Conversation shows about one bubble. The top line of the first bubble is cut at the rule. That is normal scroll clipping, but the slot is too short to read a thread. | Finding 1 |
| today | 1440 | light, dark | The 4-line next plan date/time string shows numeric dates. | Finding 2 |
| today | 768, 1024, 1440 | light, dark | The conversation top rule is wider than the note card and composer above and below it. | Finding 3 |
| today | 390 | light, dark | The pinned note sender eyebrow wraps to two lines ("FROM ANNA MARIA KOWALSKA- / WIŚNIEWSKA Z GDAŃSKA"), so the compact row is 4 lines high. Acceptable, but it takes more space from the conversation. | `.note-card .eyebrow` has no one-line clamp (messages.css:44) |
| today | 1440 | light, dark | The Upcoming plans card is cut at the window bottom. This is **not a defect**: `.our-day` scrolls on its own (planning.css:82), as DESIGN.md says. | — |

Checked with no defect found: horizontal scroll (none at any width), day chip one-line ellipsis (1024, 768, 390), switch to one column below 1200px, dark surfaces (note-dark, rose-soft-dark, sidebar-dark composer, primary-dark Send button: all readable, no light-only asset), and targets (Send message 48px, composer links and chips `min-height: var(--nav-target)`, message actions 48px).

## Skipped steps

- **Browser overlay**: skipped. The local backend cannot run in this container, so no live page exists, and the overrides forbid starting servers.
- **States not in the capture**: two or more pinned notes, due-task and countdown chips, empty conversation, loading and error states, and a failed send. The single capture has none of them, so I could not verify their layout. Risk: with two pinned notes at 390 (grid falls to one column), the conversation would stay at 160px and the composer would leave the window.
- **Dark mode at 768 and 1024**: not captured.
