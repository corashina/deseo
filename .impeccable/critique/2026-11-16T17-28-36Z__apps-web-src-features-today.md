---
target: Today
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/deseo/apps/web/src/features/today"
timestamp: 2026-11-16T17-28-36Z
slug: apps-web-src-features-today
---
Method: dual-agent (A: A-today · B: B-today)

# Critique: Today (baseline, 2026-11-16)

Evidence: design-capture run 43916736848 (master 0eb7250 plus dark captures), 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 26/40 (Acceptable).** P0: 0 · P1: 2 · P2: 5 · P3: 6.

Today does not yet read as one screen. From 1200px it is the old Messages page beside a dashboard; below 1200px it is the Messages page with one chip on top. The parts are Deseo's own (owner bubbles, next-plan card, week dots, peach notes); the layout is a generic chat plus widgets. The detector found 0 issues in source and 1 on the rendered page (`kicker-above-heading`), which is a false positive: DESIGN.md asks for the date eyebrow above the title.

**Evidence gap:** the capture sets the viewport to the full page height, which also grows `100dvh`. So the composer was pushed out of every shot, and the conversation height could not be judged visually. Both assessments agree from the CSS that the fixed 520px offset is wrong. The recapture uses a real window height to confirm.

| Sev | Finding | Where | Command | Source |
|---|---|---|---|---|
| P1 | The composer is not in the first viewport; the list height uses a fixed `100dvh - 520px` that ignores notes and chips, giving two scroll layers | messages.css `.conversation-page > .conversation`, TodayPage.tsx | layout | A+B |
| P1 | The day chip gives no day ("07:00 PM · Dinner…" for tomorrow) and cuts the title mid-word at 390 and 768 | DayChips.tsx, planning.css `.day-chips a` | clarify | A+B |
| P2 | The pinned-note strip is heavy (about 250px for one note) and leaves half of the 2-column grid empty | messages.css `.notes-strip`, NoteCard.tsx | distill | A+B |
| P2 | Every bubble repeats the full date with year and an "Actions" disclosure | MessageRow.tsx, messages.css | quieter | A |
| P2 | Seams from the merge: two time formats, next plan shown 3 times, two Add event buttons, pending bubble changes color on send, dead "Reply" link to the removed /messages route | NextPlanCard, EventRow, DayChips, Composer, NoteCard | polish | A |
| P2 | The scroll box has no visible edge, so the top bubble looks cut under the note | messages.css `.conversation` | clarify | A+B |
| P2 | Five ways to add in two places (header Add event plus four composer links) | TodayPage.tsx, Composer.tsx | distill | A |
| P3 | Token drift: next-plan padding 28px, week-strip gaps 2px/3px, literal 12px radii, note-card padding 16px against the 24px component | planning.css, messages.css | polish | B |
| P3 | Conversation is 4px inset from the column; "Actions" label is 12px right of the message text | messages.css | polish | B |
| P3 | Chips render after the Today query, so notes and list jump 64px | TodayPage.tsx | harden | A |
| P3 | Pin and delete errors show above the list, not beside the message | Conversation.tsx | harden | A |
| P3 | Important date card uses the same note peach as pinned notes | planning.css `.important-card` | colorize | A |
| P3 | DESIGN.md says shadows only on popovers, dialogs, and navigation, but also allows the next-plan glow | DESIGN.md | clarify | B |

**Bolder moves (owner decides):** owner-tinted day chips below 1200px (colorize); notebook day separators in the conversation, in eyebrow type, so chat and panel share one date language (delight).

**Capture effects, not defects:** gray buttons in the 390 dark shots; the missing composer (see evidence gap).

## Assessment A: design review


**On the merge:** Today does not yet read as one screen. From 1200px it is the old Messages page beside a dashboard: two columns with different rhythms and no shared top edge. Below 1200px it is the Messages page with one chip on top.

## Design specificity verdict
The parts are written for Deseo; the layout is not. These parts belong to this product: rose and teal bubbles with names, the next plan card with a glow in the owner color, the week strip with one dot per owner, and peach pinned notes. The page structure is a generic chat column plus a widget sidebar. The conversation column has no Deseo idea of its own: no day rhythm, no link to the "Our day" date language. Cover the name and the left column could be any support chat.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Sent, Sending… and Not sent work well. Below 1200px the day chip shows "07:00 PM · Dinner…" for an event that is **tomorrow**. |
| 2 | Match with real world | 3 | Plain words. "Actions" is vague, and the full "Nov 16, 2026, 06:19 PM" on every bubble does not match how people read a chat. |
| 3 | User control and freedom | 3 | Delete has a confirm and Cancel; unpin can be reversed; drafts warn before leave. |
| 4 | Consistency and standards | 2 | Time formats differ ("7:00 – 9:00 PM", "07:00 PM"). Add event shows in 2 styles. A pending bubble is lilac, then turns rose. "Latest memory" has no link, unlike the other sections. |
| 5 | Error prevention | 3 | Client-ID retry, length check, delete dialog. |
| 6 | Recognition rather than recall | 3 | Pin is hidden behind "Actions". Other actions are visible. |
| 7 | Flexibility and efficiency | 2 | No keyboard shortcut to send. Pin and delete take 2 clicks per message. |
| 8 | Aesthetic and minimalist | 2 | "Actions" and the full timestamp repeat on every bubble. One note fills half a 2-column grid. The next plan shows 3 times. |
| 9 | Error recovery | 3 | Not sent + Retry appear beside the message. The pin/delete error shows at the top of the list, away from the message. |
| 10 | Help and documentation | 2 | The empty states teach. Nothing explains what a pinned note is or that each person gets one. |
| **Total** | | **26/40** | **Acceptable (65%)** |

## Cognitive load
- **Fail: Single focus.** The page is meant to be chat-first, but the next plan title (30px, weight 800) is almost as loud as the "Today" title. The composer is below the fold.
- **Fail: Visual hierarchy.** The prime top-left spot goes to a 250px pinned note, not to the conversation.
- **Fail: Minimal choices.** The add decision has 5 visible ways in two places: header Add event, then Add event, Add task, Add memory and Send message by the composer.
- Passes: chunking, one thing at a time, working memory, progressive disclosure.
- Result: 3 failures, moderate load.

## Emotional journey
- **Peaks:** the next plan card in the owner glow, and the memory photo at the end of the panel.
- **Valleys:** the first bubble under the note is cut off by the scroll edge with no frame or fade, so it looks broken (all widths). Below the note comes a wall of identical "Nov 16, 2026, 06:19 PM" stamps and "Actions" chevrons.
- **Reassurance:** "Sent" on the viewer's latest message, the delete dialog, and Retry that keeps the text. These are good at the moments that matter.

## What's working
1. **Owner color always paired with a name.** The bubbles, next plan card, event rows and week dots all follow the Name Beside Color Rule. Dark mode (Midnight) keeps rose and teal readable and warm.
2. **Next plan card.** The label (Tomorrow), heavy title, time, place and owner make a strong anchor. The very long title wraps cleanly.
3. **Send trust model.** Pending bubble, Not sent + Retry with the same client ID, and Sent only on the latest message match PRODUCT.md's "Sent confirms server storage" exactly.

## Priority issues
1. **[P1] The composer is not in the first viewport.**
   - Where: `styles/messages.css` `.conversation-page > .conversation { max-height:max(320px, calc(100dvh - 520px)) }`. All widths.
   - Why: The 520px number assumes a short header stack. Pinned notes (about 250px) and chips (64px) push the list down. On a real 1440×900 window the composer starts near y≈880; on a 390×844 phone it is about 2 screens down. Send message is the main action, so a chat-first home that hides it fails its job. The page also gets two scroll layers: the list and the page.
   - Check: this is a real defect, not a capture effect. The capture only made the list taller; nothing is sticky.
   - Fix: give `.today-conversation` a flex column sized to the viewport under the header. Let the list be `flex:1; overflow:auto` and pin the composer to the bottom of the column. Make `.our-day` sticky with its own scroll. Remove the magic number.
   - Command: **layout**
2. **[P1] The day chip gives the wrong day and is cut off.**
   - Where: `features/today/components/DayChips.tsx` and `.day-chips a { white-space:nowrap }` in `styles/planning.css`. 390px, 768px and 1024px.
   - Why: The chip shows "07:00 PM · Dinner…" with no "Tomorrow", so a partner reads it as tonight. At 390px and 768px the text is clipped mid-word ("…restaurant ne") with no hint that it scrolls.
   - Fix: reuse the `dayLabel` from `NextPlanCard` ("Tomorrow · 7:00 PM"). Shorten the title with an ellipsis inside a max-width, and color the chip by owner.
   - Command: **clarify**
3. **[P2] The pinned note strip is heavy and half empty.**
   - Where: `.notes-strip` grid with 2 columns, and `NoteCard.tsx`. All widths.
   - Why: One note takes half the row and about 250px of height, plus a full 48px "Unpin note" button. The empty half lines up with nothing. The scroll edge then cuts the next bubble directly under it.
   - Fix: make notes a compact row. Clamp the body to 2 lines, show the sender and time on one line, and turn Unpin into a text link. Give the list a visible top edge (a border or a fade) so it reads as a scroll area.
   - Command: **distill**
4. **[P2] Every bubble repeats the same chrome.**
   - Where: `MessageRow.tsx` and `messages.css`. All widths.
   - Why: The full date, year and time on every message, plus an "Actions" disclosure on every own message. In the 1440 capture that is 7 identical "Actions" rows. The messages lose their voice under the metadata.
   - Fix: add day separators ("Today", "Yesterday", or the weekday) as eyebrows, and show only the time inside a day. Move Actions to a small control in the meta row.
   - Command: **quieter**
5. **[P2] Seams between Messages and Today.**
   - Where: `NextPlanCard.tsx`, `EventRow`, `DayChips.tsx`, `Composer.tsx`, `.pending-send`, `NoteCard.tsx`.
   - Why: Time formats differ between components ("7:00 – 9:00 PM", "07:00 PM"). The next plan appears as the card, as the first Upcoming row and (at narrow widths) as the chip. Add event is in the header and again by the composer. A pending bubble is `shared-soft`, then turns rose when sent. `NoteCard` still links to the removed `/messages` route ("Reply"); that is dead code, and AGENTS.md says to remove obsolete paths.
   - Fix: use one time format. Leave the next plan out of the Upcoming rows. Keep one Add event. Give pending bubbles the own-message color. Delete the Reply link.
   - Command: **polish**

## Persona red flags
- **Casey (phone, one hand, 390px):** The first viewport is the header, the page title, Add event, a clipped chip and a peach note. The composer is far below, outside the thumb zone. The week, tasks and memory are hidden at this width.
- **Alex (power user):** There is no shortcut to send (Enter adds a new line, and there is no Ctrl/Cmd+Enter). Pinning takes Actions, then Pin note, per message. Getting back to the composer needs scrolling in two places.
- **Riley (stress tester):** The long title truncates mid-word in the chip. One note leaves half the grid empty. Due tasks shows a full bordered card for one sentence. Below 1200px the panel's loading and error states (`TodayPage.tsx`) render in a second grid row under the composer, away from the chips they belong to.
- **Coordinating partner (PRODUCT.md user, checking tonight's plan on a phone):** The chip says "07:00 PM" with no day, so they think dinner is tonight. "Add task" opens the task list, not a task form.

## Minor observations
- The important date card uses the same peach `note` fill as pinned notes: one color with two meanings (`styles/planning.css` `.important-card`). The capture has no important date, so this was not checked visually.
- Chips render only after the Today query resolves, so the notes and list jump down 64px (`TodayPage.tsx`).
- The pin/delete error with "Retry change" appears above the list, not beside the message (`Conversation.tsx`).
- Week strip days are not links. Tapping Thu 19 does nothing (`WeekStrip.tsx`).
- "Latest memory" sits outside a card, with no "View memories" link, unlike the other sections (`OurDayPanel.tsx`).
- In the 390 dark shot, Add event and Unpin note have a grey wash that 1440 dark does not. Check whether this is emulated touch or hover state or a real `.button.secondary` dark issue (`styles/controls.css`).

## Bolder move proposals
1. **colorize: an owner-tinted chip row.** Below 1200px, give each chip its owner fill (rose, teal or lilac) and a small dot, like the week strip. The narrow screen then keeps the "Our day" signature instead of one grey pill. Touches Today at 390, 768 and 1024px.
2. **delight: notebook day separators in the conversation.** Use eyebrow-style date headings ("MONDAY · NOV 16") inside the conversation, with the same type as the page eyebrow. The chat and the panel then share one date language, which joins the two halves of the merge. Touches the conversation at all widths.

## Questions to consider
1. Should a phone lose the week, tasks and memory entirely? Or should the panel stack under the composer below 1200px, so that "Today" on a phone means more than "Messages"?
2. If Today is chat-first, why is the loudest type on the page a plan title in the side panel? Should the next plan shrink, or should the conversation move to the right?
3. Should pinned notes live above the conversation at all? They could sit at the top of the Our day panel, where the other things to remember already are.
## Assessment B: detector and rendered evidence


### Detector counts
- **Source scan** (`impeccable detect --json apps/web/src/features/today apps/web/src/features/messages`): **0 findings**, exit 0.
- **Rendered scan** (`today.detect.json`, 1440 light): **1 finding**
  - `kicker-above-heading` (warning, slop): `div > span.eyebrow`. The label "Monday, November 16" sits above h1 "Today". It comes from `apps/web/src/components/ui/PageHeader.tsx` (eyebrow prop), set at `apps/web/src/features/today/pages/TodayPage.tsx:38`.

### Verified findings
1. **The day chip cuts off long titles with no ellipsis.** P2. File: `apps/web/src/styles/planning.css:119-120`. `.day-chips a` has `white-space:nowrap` and `flex-shrink:0`, and the row has `overflow-x:auto`. One long next-plan chip is wider than the column, so the title stops mid-word: "…whole famil" at 768 and "…restaurant ne" at 390. The rest is only reachable by side-scrolling inside the row. There is no page-level horizontal scroll. Command: **adapt** (or harden). Fix: give the chip `max-width:100%; overflow:hidden; text-overflow:ellipsis`, or let it wrap.
2. **The conversation height uses a fixed offset.** P2, from the CSS (the capture cannot show it). File: `messages.css:4`. The rule is `max-height:max(320px, calc(100dvh - 520px))`. The 520px does not count the notes strip (about 250px per note, one column below 768px), the day chips, or the composer. On a real 844px phone with one pinned note, the stack is about 1,200px. So the page scrolls, and inside it sits a nested scroller of only about 324px. Command: **layout**.
3. **Token drift**, all P3, command **polish**:
   - `planning.css:105`: `.next-plan` uses `padding:24px 28px`. 28px is not on the spacing scale (4/8/12/16/20/24/32/40).
   - `planning.css:96`: `.week-strip li` uses a literal `border-radius:12px` instead of `var(--radius-control)`, and `gap:2px`. `planning.css:101` uses `gap:3px`. Neither gap is on the scale.
   - `messages.css:24`: the `.message-actions > summary` radius is a literal `12px`, not the variable.
   - `messages.css:38`: `.notes-strip .note-card` uses `padding:16px`. The DESIGN.md `note-card` component says 24px.
   - DESIGN.md contradicts itself. Line 222 says "shadows only on popovers, dialogs, and selected navigation". Lines 363 and 366 also allow the next-plan glow (`planning.css:105-107`). Fix line 222 (**clarify**).
4. **The conversation is shifted 4px from the rest of the column.** P3. File: `messages.css:4`, where `.conversation-page > .conversation` has `padding:4px`. Partner bubbles start 4px inside the left edge of the header and the note card (x=292 vs 288 at 1440; 20 vs 16 at 390). Own bubbles end 4px short of the right edge. Command: **polish**.
5. **"Actions" does not line up with the message text.** P3. File: `messages.css:24`. The summary has `padding:8px 12px`, so its label starts 12px right of the message body text (x=470 vs 458 at 1440). A negative inline margin would fix it. Command: **polish**.

### False positives
- **`kicker-above-heading` (rendered)**: DESIGN.md:431 requires this: "Show the date in the eyebrow above the title." The label carries real data (the date), not a generated kicker. The next-plan label is also required (DESIGN.md:434) and was not flagged. Assessment A can still question the pattern, but by the project spec this is not a defect.

### Visible defects from screenshots
- **Day chip cut-off**: 768 and 390, light and dark. Cause: `.day-chips a` (finding 1). It fits at 1024.
- **Bubble cut at the top of the conversation**: all widths, light and dark. The top bubble ("Message 13" at 1440; partly hidden at 1024, 768 and 390) ends in a hard edge 16px below the pinned note card. It looks like it sits under the note. This is **not an overlap**: there is no sticky or fixed positioning in `messages.css`. `.conversation` is an `overflow-y:auto` box that `Conversation.tsx:76` scrolls to the latest message. The box has no visible edge, so the clipping reads as a layering bug. P3, **clarify**.
- **Gray buttons at 390 dark** ("Add event", "Unpin note", fill #595662): this is a **capture effect**, not a dark-mode defect. `.button` transitions `background-color` and `color` over 140ms (`controls.css:1`). The colors sit between light `--surface` #FFF and dark `--surface-dark` #221D2D. The text is a mid-transition gray too. So the shot was taken while the color scheme was still switching. At 1440 dark the same buttons show the right surface (#252030 with antialiasing). Fix in the capture: wait at least 200ms after switching the scheme.
- **Composer missing**: 390, 768 and 1024. At 1440 only its top edge shows at y≈1905. This is a **capture effect**. The viewport is set to the full page height, which grows `100dvh`, which grows the conversation `max-height`, which pushes the composer below the measured height. So the composer and its text links (DESIGN.md:432) are **not verified** in any shot.
- **1440 light and dark**: the single pinned note fills only one of the two `.notes-strip` columns (`messages.css:37`), which leaves an empty half-row. P3, **layout**. This is cosmetic, not broken.
- **Controls under 48px**: none found in this area. The day chips, the Actions summary, the composer links, and the section-heading links all reach 48px (`--nav-target` or base.css:25). The week-strip cells are not interactive.
- **Dark mode**: no wrong surfaces or unreadable elements other than the capture effect above. The bubbles, note card, next-plan glow and week strip all use dark tokens. The latest memory image is a photo, not a light-only asset.
- **Page horizontal scroll**: none at any width.

### Skipped steps
- **Browser overlay (`detect --cdp` live)**: skipped. The local backend cannot run in this container and there is no live page. The brief and overrides say not to start servers.
- **Composer and composer links**: not checked visually, because the capture effect above pushed them out of every shot.
- **Real 900px-high viewport check of the conversation height (finding 2)**: inferred from the CSS only. It needs a live viewport to confirm.

Files read: `apps/web/src/styles/messages.css`, `planning.css`, `controls.css`, `base.css`, `apps/web/src/features/today/**`, `apps/web/src/features/messages/components/**`, `DESIGN.md`, and `brand/tokens.json`. Screenshots are in `/tmp/claude-0/-home-user/a1136e82-3529-5ad9-805a-aba66d8eeeb4/scratchpad/baseline/capture/today/`. No repo files were edited.
