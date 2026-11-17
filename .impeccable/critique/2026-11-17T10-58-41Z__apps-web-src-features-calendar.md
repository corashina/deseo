---
target: Calendar
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/deseo/apps/web/src/features/calendar"
timestamp: 2026-11-17T10-58-41Z
slug: apps-web-src-features-calendar
---
Method: dual-agent (A: A-calendar · B: B-calendar)

# Critique: Calendar (rescore, 2026-11-17)

Evidence: design-capture run on master a9c61d0, 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 28/40, 70%.** Baseline: 25/40. P0: 0 · P1: 2 · P2: 3 · P3: 0 (Assessment A).

P1 findings, all fixed in PR #35:

- Overnight events repeat their start time on the next day
- Selecting a day gives no visible result

P2 and P3 findings stay open for a later pass. Assessment B lists the detector results and visible defects. Questions are in Assessment A.

## Assessment A: design review


Scope: month grid and agenda, event detail, event form, date ideas list, idea form, idea detail. Evidence: 48 screenshots in `capture/calendar/`, source in `features/calendar/**`, `styles/calendar.css`, `styles/planning.css`.

## Design specificity verdict

**Partly authored.** The Deseo layer is real but thin. The tokens are Deseo's own: plum selected day, lilac Together chips, names beside each owner dot, and the Midnight dark palette. But with the sample data (all Together), the month grid reads as "any pastel calendar". The owner strip that DESIGN.md names in the Event row anatomy is not in `calendar.css`, so a chip carries owner only as a tint and a 12px name. The date idea screens are generic CRUD: a title link, a state word, and a form with three fields. Nothing on them says "for two of you".

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Forms show Saving…, Retry save, and conflict state. But the selected-day agenda sits below the fold at every width, so a day tap shows no visible result on a phone. |
| 2 | Match with the real world | 3 | An overnight event shows its start time again on the next day ("11:00 PM Dinner" on Nov 18, but it ended at 1 AM). |
| 3 | User control and freedom | 3 | Cancel, return links, unsaved-change warning, and delete dialog all work. Archived ideas have no way back: no Restore, no Edit. |
| 4 | Consistency and standards | 3 | Owner filters wrap long names, but task list tabs ellipsize them. Idea state is plain muted text, but event owner is a badge. The idea form autofocuses Title. The event form does not. |
| 5 | Error prevention | 3 | Good: share confirmation, delete dialog, an important date forces all-day, and the DST occurrence picker. Nothing on screen guards an end time before the start time until submit. |
| 6 | Recognition rather than recall | 3 | The owner legend is visible and every event names its owner. Phone month cells show only dots, so you must tap each day to learn what is on it. |
| 7 | Flexibility and efficiency | 2 | The Today jump, URL state, a prefilled date from the selected day, and Plan date from an idea all help. There is no quick add in a cell and no way to duplicate an event. |
| 8 | Aesthetic and minimalist design | 3 | Clean cards and a calm palette. But six 142px rows are mostly empty, the phone owner filter is a wall of text, and the idea detail can be an empty card. |
| 9 | Error recognition and recovery | 3 | "This event changed. Your draft is kept." plus Reload and Retry is strong. Other failures pass the server message through unchanged. |
| 10 | Help and documentation | 2 | Good inline hints ("The end date is included.", "Show a countdown on Today…"). There is no help at decision points such as Who → Private. |
| **Total** | | **28/40** | **Good** |

## Cognitive load

Failures: 3 of 8 (moderate).
- **Minimal choices:** about 11 controls come before the first day cell: Date ideas, Add event, previous, next, Today, Month, Agenda, and four owner filters.
- **Visual hierarchy (390px):** the 2×2 owner filter is about 215px tall, with 3-line centered names. It outweighs "November 2026" and the grid.
- **Working memory (390px month):** dots stand in for events. The result of a day tap is about 300px below the grid, so the user must remember which dot they tapped.

Decision points over 4 options: the calendar toolbar (7 controls in one band at desktop). No single control set goes over 4.

## Emotional journey

- **Peak:** the event detail. A large title, a Together badge, and a plain "Shared with your partner" feel personal and calm.
- **Valley:** the month at 1440px. Five lilac chips all say "11:00 PM", and two of them are on the wrong night. Trust drops at the exact moment of "what are we doing this week?"
- **Valley:** idea detail with no note. The page holds only a giant title, the word "Saved", and a card with just Return and Archive. A wish to do something together lands in an empty room.
- **Reassurance at high-stakes moments:** good. Delete says "Both partners will lose access". Making an event shared asks "Share this event?". A conflict keeps the draft.

## What's working

1. **Who select** (`EventFields.tsx`). One control sets owner and visibility, and "Private (just me)" appears only for the author. It removes a whole class of wrong combinations.
2. **Conflict handling** in `EventFormPage.tsx` and `IdeaFormPage.tsx`. The draft is kept, the save is blocked, and there is an explicit "Reload event and discard draft". This is rare quality for a two-writer app.
3. **The phone month grid** keeps 48px day buttons in 72px cells with owner dots. It honors the project rule without shrinking the desktop cells.

## Priority issues

**[P1] Overnight events repeat their start time on the next day**
- Where: `MonthGrid.tsx` and `Agenda.tsx` via `EventRow.tsx`. Calendar, all widths: the Nov 18 cell shows "11:00 PM Dinner…" and "11:00 PM Weekend trip…".
- Why: `agendaDates` places the event on both days, and `EventRow` always prints the start time. A partner reads a second dinner on Wednesday night. In a shared plan, a wrong time is a wrong plan.
- Fix: pass the cell date to `EventRow`. On a continuation day, show "Until 1:00 AM", or "Continues" for multi-day events, in place of the start time. Use the same rule in the selected-day agenda.
- Command: **harden**

**[P1] Selecting a day gives no visible result**
- Where: `CalendarPage.tsx` and `calendar.css` (`.month-day { min-height: 142px }`, `.selected-agenda`). The day heading sits at y≈1430 at 1440px and y≈1140 at 390px.
- Why: on a phone the agenda below the grid is the only place events appear. The tap changes a number fill and nothing else on screen.
- Fix: at 1200px and up, place the selected-day agenda in a column beside the grid. Lower the cell minimum to fit content, about 96px. Below 768px, cap the owner filter height (see the next issue) so the agenda starts within one screen of the grid. Or scroll it into view on select.
- Command: **layout**

**[P2] Owner filter becomes a wall of text with long names**
- Where: `.owner-filters` in `calendar.css` at 390px (2×2 grid, 3-line centered names) and at 768–1024px (wraps to 2 uneven rows).
- Why: the filter is the tallest thing above the grid, and it does not follow the tasks screen, which ellipsizes list names.
- Fix: keep each segment on one line with `text-overflow: ellipsis` and `max-width: 24ch`, as `.task-lists .view-tabs` does. Left-align the dot and the name.
- Command: **adapt**

**[P2] Month chips break words in the middle at tablet widths**
- Where: `.event-row` `overflow-wrap: break-word` inside `.day-events`, at 768px and 1024px ("Weeken / d trip t…").
- Why: broken words read as a rendering bug and make the chip hard to scan.
- Fix: in `.day-events`, set `overflow-wrap: normal; hyphens: auto` and let the 2-line clamp truncate. Between 768 and 1023px, drop the time line and keep the title and owner.
- Command: **typeset**

**[P2] Date idea screens are a dead end**
- Where: `IdeasPage.tsx` and `IdeaDetailPage.tsx`, all widths.
- Why: the list card repeats "Saved" on the Saved tab and has no Plan date. The detail page with no note renders a card that holds only actions. Archived ideas cannot be restored, although the dialog says "You can find this idea in Archived."
- Fix: drop the state word on its own tab. Put Plan date on each saved card. On detail, show the note, the link host, or one muted line ("No note yet."), and move Return and Archive out of an otherwise empty card. Add Restore idea on archived ideas.
- Command: **distill**

## Persona red flags

- **Casey (distracted mobile):** taps "17" and sees only the filled number. The events are below the fold under a 215px owner filter. The primary Add event is at the top, out of thumb reach.
- **Riley (stress tester):** a 23:00–01:00 event appears twice as "11:00 PM". Long titles break as "Weeken d". An archived idea can never come back.
- **Alex (power user):** no keyboard shortcut for Today or next month, no quick add in a cell, and no duplicate event. Planning an idea always takes three screens.
- **The planning partner (PRODUCT.md user):** checks "what are we doing Wednesday?" and finds two 11 PM plans that are really Tuesday's. Trust in the shared calendar breaks.

## Minor observations

- `EventDetailPage.tsx`: the When range repeats the year ("Nov 17, 2026, 11:00 PM – Nov 18, 2026, 1:00 AM"). At 390px, "AM" wraps alone onto a new line.
- `EventDetailPage.tsx`: the link always says "Return to calendar", even when `back` points to Today.
- `calendar.css` `.form-grid`: below 768px, the event form stacks Start date, End date, Start time, End time. Pairing each date with its time matches how people think.
- `IdeaFormPage.tsx` autofocuses Title, but `EventFields.tsx` does not. Pick one behavior.
- `IdeasPage.tsx`: "Return to calendar" floats far right at 1440px, and at 390px it sits between the tabs and the cards.
- `base.css` h1 with `text-wrap: balance`: long record titles become a 5-line, 40px block at 768–1024px beside the actions.
- Dark mode: Together chips (`shared-soft-dark` on `surface-dark`) separate only faintly from the cell.

## Bolder move proposals

1. **colorize: owner strip on event rows.** Add a 3px leading strip in `rose-accent`, `teal-accent`, or `shared-accent`, as the DESIGN.md Event row anatomy already says. Reason: "whose evening is this" becomes readable at a glance in a full month, and the name stays beside it. Touches the month grid, the agenda, and Today.
2. **colorize: date ideas on Note Peach.** Give saved idea cards the `note` and `note-line` fill. Reason: ideas are personal wishes, not records, and DESIGN.md gives personal content warm fills and more space. Touches the Date ideas list and idea detail.

## Questions to consider

- Does a 142px empty week earn its height for a pair that plans five events a month?
- On a phone, should Month exist at all, when each day needs a tap to reveal its dots?
- What does an archived idea exist for, if nobody can act on it again?


## Assessment B: detector and rendered evidence


## Detector counts

**Source scan** (`impeccable detect --json apps/web/src/features/calendar`): exit 0, **0 findings**.

**Rendered scan** (CDP, 1440px light): **3 findings in 2 rules**.

| Rule | Count | Screen and selector |
|---|---|---|
| nested-cards | 1 | calendar: `div.calendar-toolbar > div.view-tabs` |
| kicker-above-heading | 2 | events-eventId: `span.eyebrow` ("Event"); ideas-ideaId: `span.eyebrow` ("Date idea") |

events-new, events-eventId-edit, ideas, ideas-new, and ideas-ideaId-edit: 0 findings each.

## False positives

- **nested-cards (calendar)**: `.view-tabs` (controls.css:50) is the Month/Agenda segmented control: a 4px-padded strip with a canvas fill and a 12px radius. It is not a card. DESIGN.md (Filters and badges) says "View tabs and owner filters are segmented controls." The detector reads the border and radius as a card.
- **kicker-above-heading (event and idea detail)**: DESIGN.md (Screens, Calendar) requires "an eyebrow, the title, and the owner badge or state" on these screens. `.impeccable/config.json` has ignored this rule for `apps/web/src/**` since 2026-11-17 10:49. The captures are from 2026-11-16 21:16, before that change.

**No detector finding is real.**

## Verified findings (from the screenshots and the code)

1. **P2: Month-cell event titles break inside words at 768-1023px.** "Weeken / d trip t…" and "Dinner / at the…". Cause: `.event-row { overflow-wrap: break-word }` (calendar.css:21) in cells about 85px wide, with `.day-events .event-row` padding (calendar.css:31) and `.month-day` padding (calendar.css:69). This conflicts with DESIGN.md: "Do not shrink desktop calendar cells into unreadable mobile columns." Fix: in month cells, set `overflow-wrap: normal` on the title and keep the two-line clamp, or start the owner-dot layout below 1024px. **Command: adapt.**
2. **P2: Owner filters break apart at 390px and wrap unevenly at 768-1024px.** At 390px the grid has two columns (calendar.css:79). Each long name wraps to 3-4 centered lines, the Everyone segment grows to about 100px high, and the owner dot sits apart from its centered text (controls.css:52 and 55 set `justify-content:center; flex:1`). At 768 and 1024px the strip fills the width in two uneven rows, with empty space on the right. Fix: use one column, left-aligned, on phones, and keep `fit-content` rows at the other widths. **Command: adapt.**
3. **P2: The page header crowds the title at 768-1023px.** On idea detail, the 40px h1 wraps to 5 lines in a column about 370px wide, beside Edit idea and Plan date. On event detail at 768px it wraps to 4 lines. `.page-header` (base.css:33-40) moves the actions below the title only below 767px, and h1 drops to 30px only there. DESIGN.md: "move the header action below the heading before either gets crowded." Code: `components/ui/PageHeader.tsx` and base.css. **Command: layout.**
4. **P3: Form cards have 48px of space below the buttons and 24px above the first label.** The `.actions` inside `<form>` keeps `margin-bottom: 24px` (base.css:41). The reset `.card > .actions:last-child` (base.css:42) does not match, because the actions are not a direct child of the card. This affects Add event, Edit event, Add idea, and Edit idea (EventFormPage.tsx:142, IdeaFormPage.tsx:93). **Command: polish.**
5. **P3: The "Who" select text starts about 4px to the right of the input text.** calendar.css:44 sets the select padding to `12px 16px`, and the native select adds its own inner indent. controls.css:21 uses `11px 16px`. Seen at all widths. **Command: polish.**
6. **P3: Dark-mode checkboxes ("All day", "Important date") show the browser's gray fill.** They do not use `surface-dark` with a `control-dark` border. calendar.css:47 sets only `accent-color`. **Command: polish.**
7. **P3: An event-detail time breaks between the hour and AM at 390px** ("1:00 / AM"). The When value in EventDetailPage.tsx has an ordinary space before the meridiem. Fix: join the hour and AM/PM with a non-breaking space, or keep each time on one line. **Command: typeset.**
8. **P3: An idea with no note or link shows a card that holds only "Return to ideas" and "Archive idea"** (IdeaDetailPage.tsx:46-55, all widths). The card has no content, only actions. **Command: distill.**
9. **P3: Token style drift.** planning.css:50, 51, and 60 use literal `24px` and `16px` gaps for `.idea-grid`. The values match the spacing tokens, but the rules do not use `var(--space-6)` and `var(--space-4)`. No color, radius, or font-size drift found in calendar.css or the idea-grid and quick-add rules: font sizes are 12, 14, and 16px, and all colors are `var()`. **Command: polish.**

## Visible defects from screenshots

| Screen | Width | Mode | Defect | Cause |
|---|---|---|---|---|
| calendar | 1024, 768 | light | Event titles split inside words | #1 |
| calendar | 390 | light and dark | Tall, unbalanced owner-filter grid, with dots apart from their names | #2 |
| calendar | 1024, 768 | light | Owner-filter strip wraps 2+2 with empty space on the right | #2 |
| ideas-ideaId | 1024, 768 | light | 5-line h1 squeezed beside 2 buttons | #3 |
| events-eventId | 768 | light | 4-line h1 beside Edit event | #3 |
| events-new, events-eventId-edit, ideas-new, ideas-ideaId-edit | all | both | Extra space at the bottom of the card | #4 |
| events-new, events-eventId-edit | all | both | Select text out of line with the inputs | #5 |
| events-new, events-eventId-edit | 390, 1440 | dark | Gray native checkbox fill | #6 |
| events-eventId | 390 | both | "1:00 / AM" wrap | #7 |
| ideas-ideaId | all | both | Card with actions only | #8 |

Not counted: the native time inputs show "06:00 PM" and "01:00 AM", with a leading zero. DESIGN.md asks for "7:00 PM", but the browser formats these controls itself.

No horizontal scroll, clipped text, or controls under 48px were found. The day buttons are 48px high at 390px, and every button and segment measures 48px. Dark mode uses the right surfaces, and no light-only asset shows. The sidebar ends at 900px in the full-page shots. This is the known capture effect, not a defect.

## Skipped steps

- **Browser overlay:** skipped. There is no local backend or live page in this container, and the overrides forbid starting servers.
- **Agenda view, the archive dialog, and event or idea detail with a description, link, or note:** these states have no captures, so they were not judged. All calendar captures show the month view, including the one at 390px.
- **Accessibility rules** (low-contrast, gray-on-color, skipped-heading): off in the config and out of scope under the overrides.
