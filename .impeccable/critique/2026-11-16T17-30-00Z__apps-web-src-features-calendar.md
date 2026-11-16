---
target: Calendar
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/deseo/apps/web/src/features/calendar"
timestamp: 2026-11-16T17-30-00Z
slug: apps-web-src-features-calendar
---
Method: dual-agent (A: A-calendar · B: B-calendar)

# Critique: Calendar (baseline, 2026-11-16)

Evidence: design-capture run 43916736848 (master 0eb7250 plus dark captures), 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 25/40 (Acceptable).** P0: 0 · P1: 3 · P2: 6 · P3: 7.

The desktop month grid with owner filters is the most Deseo-like screen in the portal. Event detail, the event form, and date ideas are generic, and the owner color is missing exactly where ownership is shown or chosen. The detector found 0 issues in source and 1 rendered `nested-cards` on the Month/Agenda control, which is a false positive (a segmented control, not a card). Assessment B confirmed the mobile toolbar overload and found broken mid-word titles in the month grid at 768 and 1024.

| Sev | Finding | Where | Command | Source |
|---|---|---|---|---|
| P1 | Selection uses the shared (Together) color, so a Together event on the selected day disappears; no today marker | calendar.css `.month-day.selected`, MonthGrid.tsx | polish | A |
| P1 | Event detail hierarchy is upside down: filled red Delete is the strongest element; owner is muted text; uneven card padding | EventDetailPage.tsx, calendar.css `.event-detail` | layout | A+B |
| P1 | Return links and Cancel drop the month, view, and filter; Cancel on edit goes to the calendar, not the event | EventDetailPage.tsx, EventFormPage.tsx, IdeasPage.tsx | harden | A |
| P2 | Opening an idea goes straight into edit, with two primary buttons and Plan date below Save | IdeaFormPage.tsx, IdeasPage.tsx | distill | A |
| P2 | Mobile toolbar: 11 controls above the grid, "Today" wraps alone, owner filters wrap unevenly | CalendarPage.tsx, calendar.css | adapt | A+B |
| P2 | Month-grid titles break mid-word at 768 and 1024 ("Weeken d") and one event grows a week row to about 380px | calendar.css `.event-row` `overflow-wrap:anywhere` | adapt | A+B |
| P2 | "Together" filter has no style; pressed "Everyone" uses the Together color | calendar.css `.owner-filters` | polish | A+B |
| P2 | The 390 month grid says "1 event" with no owner or title | MonthGrid.tsx, calendar.css `.day-count` | colorize | A |
| P2 | Form cards are centered under a left-aligned page title at 1440 | base.css `.form-page` | layout | A+B |
| P3 | Event-form checkbox: 22px, 4px offset, native gray in dark mode | calendar.css `.event-fields input[type=checkbox]` | harden | B |
| P3 | Token drift: 24px month title, 11px day count, weight 500, 14/10/6/2px spacing, literal radii | calendar.css | typeset | B |
| P3 | Filters and view tabs use body type, not button type | calendar.css, controls.css | typeset | B |
| P3 | Weekday labels centered, day numbers left; outside-month days near-black in dark mode | calendar.css | polish | B |
| P3 | Empty day says "No events in this range." with a 72px gap; selected-day heading repeats | CalendarPage.tsx | clarify | A+B |
| P3 | Time formats differ ("07:00 PM" vs "7:00 – 9:00 PM") | lib/format.ts | clarify | A |
| P3 | Copy: filler header descriptions; "HTTPS link"; idea errors listed after all fields | CalendarPage.tsx, EventFormPage.tsx, IdeaFormPage.tsx | clarify | A |

**Bolder moves (owner decides):** "Who" as an owner-colored segmented control on the event form (colorize); owner dots on the 390 month grid in place of "1 event" (colorize); an owner-tinted header on event detail (bolder).

**Capture effects, not defects:** faded buttons in the 390 dark shots; autofocus ring on the idea title.

## Assessment A: design review


## Design specificity verdict
**Partly authored, mostly category-standard.** The Deseo-specific parts are real:
- Owner filters that use the partners' names and colors.
- Owner-tinted event chips.
- A "Share this event?" check when a private event becomes shared.
- Important dates, and Plan date from an idea.

The structure around them is a generic calendar and generic forms. The product's one signature, owner color beside a name, is missing in three places: on event detail (owner is muted grey text), in the event form ("Who" is a native select), and on the 390 month grid ("1 event" with no owner). Date ideas reads as a plain link list. With the name covered, only the desktop month grid reads as Deseo.

## Heuristic scores
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 2 | There is no today marker. Today shows only while it is also the selected day. Save, delete and archive give no confirmation, only a navigation. |
| 2 | Match real world | 3 | Calendar conventions are good. Some copy is jargon: "HTTPS link", "No events in this range" for one day, "Start occurrence (UTC+01:00)". |
| 3 | User control | 3 | Cancel, confirm dialogs, the unsaved-changes warning and Reload/discard all exist. But every "Return to calendar" or "Cancel" drops the month, view and filter. |
| 4 | Consistency | 2 | Events open a detail page first, ideas open straight into edit. The idea page has two primary buttons. "Everyone" uses the Together color. Time shows as "07:00 PM" in chips but "7:00 – 9:00 PM" on detail. |
| 5 | Error prevention | 3 | Strong: confirmations, important date forces all-day, the daylight-saving occurrence picker, maxLength limits. |
| 6 | Recognition over recall | 3 | Names appear beside colors. The mobile grid count hides whose event it is and what it is. |
| 7 | Flexibility | 2 | View, date and filter live in the URL, and Add event carries the selected date. There is no click-empty-day-to-add, no month shortcuts, and no Plan date on idea cards. |
| 8 | Aesthetic / minimalist | 2 | Desktop is clean. On mobile, 11 controls sit above the grid. The selected-day date heading repeats, and the "Saved" label repeats inside the Saved tab. |
| 9 | Error recovery | 3 | Conflict copy is excellent ("This event changed. Your draft is kept."). Idea form errors pile up below all fields instead of beside each field. |
| 10 | Help | 2 | Useful hints exist (important date, timezone search). The header descriptions are filler. |
| **Total** | | **25/40** | **Acceptable** |

## Cognitive load
**4 failures, so the load is high**, mostly on two screens.
- **Chunking: fail.** On Calendar at 390, 11 controls come before the grid: Date ideas, Add event, prev, next, Today, Month, Agenda, Everyone, A, B, Together. That takes about 460px.
- **Visual hierarchy: fail.** On event detail, the red **Delete event** fill is the loudest element.
- **Minimal choices: fail.**
  - Calendar toolbar: 9 options at one decision point.
  - Idea detail: up to 6 actions (Save changes, Cancel, Plan date, View planned event, Open idea link, Archive idea).
- **Working memory: fail.**
  - Coming back from detail resets you to the current month with the filter set to Everyone.
  - On mobile, you must tap a day and scroll to learn what "1 event" is.
- Passing: single focus, grouping, one thing at a time, progressive disclosure (More details).

## Emotional journey
- **Peaks:**
  - Plan date pre-fills the event from the idea.
  - The delete dialog says "Both partners will lose access to this event." That is good reassurance at a high-stakes moment.
  - "Your draft is kept" on a conflict.
- **Valleys:**
  - Event detail feels like an admin record: grey owner text, a large empty card, and the danger button as the visual climax.
  - Date ideas, the most hopeful part of the product, is an underlined link list.
- **Missing reassurance:**
  - After Delete, you land on the calendar with no message.
  - After Archive, the idea vanishes silently.

## What's working
1. **Owner filters double as the legend.** The full partner names sit on rose and teal fills, and the event chips match them (calendar.css `.owner-filters`, `.event-row.owner-*`).
2. **The mobile month grid follows the rules.**
   - Day buttons are 48px tall and cells are 72px, with no squeezed chips (`.day-events { display:none }`).
   - All-day dates are parsed as dates (`DateTime.fromISO(startDate)`, `inclusiveEndDate`).
3. **The protection flows are careful.**
   - Confirmation when private changes to shared.
   - On a conflict, you can reload and discard, and the input is kept.
   - A retry reuses its command ID.

## Priority issues

**[P1] Selection uses the "shared" color and there is no today marker**
- **Where:** calendar.css `.month-day.selected { background: var(--shared-soft) }`; MonthGrid.tsx has no today flag. Seen at 1440 and 1024 (Nov 16).
- **Why:**
  - A Together event in the selected cell is lilac on lilac and disappears.
  - Selection borrows an ownership meaning, which breaks the One Meaning Rule; DESIGN gives selected dates `action`.
  - Once you select another day or month, nothing shows which day is today.
- **Fix:**
  - Drop the cell fill. Mark selection only on the day number (`--action`, `--action-border`).
  - Add `.today` (a `--primary` ring or bold number) computed in `account.timezone`.
- **Command:** polish

**[P1] Event detail hierarchy is upside down**
- **Where:** EventDetailPage.tsx, all widths.
- **Why:**
  - The danger button is the strongest element, and it sits beside "Return to calendar".
  - The owner shows as muted "Together" text with no color.
  - DESIGN says "Keep destructive actions apart from normal edits."
  - The 3-row `dl` stretches across a 1120px card.
- **Fix:**
  - Put a partner badge (owner soft fill plus name) and the When line directly under the title.
  - Make **Edit event** the primary action.
  - Move Delete to a secondary danger button below a border-top divider.
  - Cap the card at `--form-width`.
- **Command:** layout

**[P1] Return paths drop calendar context**
- **Where:**
  - EventDetailPage.tsx `<Link to="/calendar">`
  - EventFormPage.tsx Cancel goes to `/calendar`, even when editing.
  - IdeasPage.tsx has the same pattern.
- **Why:** On Calendar, someone in December filtered to Marek's events opens an event and comes back to November, Everyone. On the edit form, Cancel should return to that event's detail page.
- **Fix:**
  - Link to `/calendar?date=<event start date>`, and carry view and owner through router state.
  - Edit Cancel should go to `/events/:id`.
- **Command:** harden

**[P2] Opening an idea puts you straight into edit**
- **Where:** IdeaFormPage.tsx, all widths.
- **Why:**
  - The focused title input cuts off the long title.
  - Two primary buttons appear: Save changes and Plan date.
  - Plan date, the reason to open an idea, sits below Save/Cancel.
  - This breaks the "Open details before editing" rule that events follow.
- **Fix:** Make a read view: title, note, link, and state. Plan date is the one primary action; Edit idea and Archive idea are secondary. Also add Plan date to each Saved card in IdeasPage.
- **Command:** distill

**[P2] Mobile calendar toolbar overload**
- **Where:** CalendarPage.tsx and calendar.css at 390 and 390-dark. 768 shows it too: two filter rows.
- **Why:**
  - **Today** wraps onto its own line.
  - The four filters stack into four rows because the names are long.
  - The grid starts about 800px down.
- **Fix:**
  - At <768, put prev, month and next in one row with the month `flex:1`, and Today at the end of that row.
  - Make owner filters a single non-wrapping, scrollable chip row. Reuse the `.day-chips` pattern from Today, so names still show in full.
- **Command:** adapt

## Persona red flags
- **Alex (power user):**
  - Planning an idea takes three screens (list, then edit form, then event form).
  - You cannot click an empty day cell to add; only the 48px number is a button.
  - There are no keyboard shortcuts for prev/next month.
  - You must re-apply the filter after every detail visit.
- **Riley (stress tester):**
  - At 768 and 1024, chip titles break mid-word ("Weeken d", "restaura nt") because of `overflow-wrap:anywhere`, and the weeks grow to about 380px.
  - A Together event on the selected day goes invisible.
  - The selected-day panel says "No events in this range." for a single day. When the day does have events, its date heading repeats (h2, then the Agenda h3).
- **Casey (one-handed mobile):**
  - "1 event" shows neither owner nor title.
  - The selected day's events sit below the whole grid.
  - Add event is only at the top of the screen, far from the thumb.
- **The planning partner (from PRODUCT.md users), checking "what does my partner have this week":**
  - The mobile grid shows no owner.
  - Event detail and the "Who" select lose partner colors.
  - Idea cards show nothing about the idea beyond title and state.

## Minor observations
- **calendar.css:**
  - `.owner-filters button.owner-together` has no fill, so unpressed Together looks like plain text.
  - Pressed "Everyone" uses the shared (Together) color.
- **lib/format.ts:** `time: { hour: '2-digit' }` gives "07:00 PM". Use `'numeric'` to match the range format.
- **calendar.css:** `.day-count` is 11px, which is below the 12px badge size on the type scale.
- **calendar.css:** In month cells, use `overflow-wrap: break-word` and clamp titles to 3 lines. Keep full titles in detail and agenda.
- **CalendarPage.tsx:** For the empty selected day, follow the DESIGN states table: "Nothing planned for Monday, November 16." plus an Add event link with the date.
- **EventFields.tsx:** In More details, Timezone (rarely changed) comes before Location (common). Reverse the order.
- **base.css `.form-page { margin: auto }`:** At 1440 the form is centered 200px right of the left-aligned page title, so the edges do not line up.
- **IdeasPage.tsx:**
  - The "Saved" state label repeats the active tab.
  - Only the underlined title is clickable, not the whole card.
  - At 1440, "Return to calendar" floats on its own at the far right.
- **IdeaFormPage.tsx:**
  - Errors render as a list after all fields; show each beside its field.
  - "Keep a note and an optional HTTPS link." is jargon; try "Add a note or a web link."
- **Header descriptions are filler:** "Shared and private events." and "Keep the details up to date." (CalendarPage.tsx, EventFormPage.tsx).
- **390-dark faded buttons:** Add idea, Save idea, Edit event and Delete event look faded only in the 390-dark shots. The 1440-dark shots are correct, and `.button` has a 140ms background-color transition. This is most likely the capture catching the light-to-dark transition, not a real defect.

## Bolder move proposals
1. **Colorize: "Who" as an owner-colored segmented control** (Add/Edit event). Four options: Together (shared-soft), the viewer (their soft fill), the partner (theirs), and Private.
   - **Reason:** this is the moment ownership is decided, and it is the only owner screen with no owner color. It reuses existing tokens and stays at 4 or fewer options.
2. **Colorize: owner dots on the mobile month grid** (Calendar at 390), in place of "1 event". Reuse `.week-strip-dots` and the accent tokens from Today.
   - **Reason:** it shows whose plans fall on which day, and matches the vocabulary partners already learned on Today.
3. **Bolder: owner-tinted header on event detail.** Show title, When and owner name on the owner's soft fill, like Today's next-plan card but with no glow, which the Flat Card Rule reserves.
   - **Reason:** event detail currently strips the event of its identity.

## Questions to consider
- On desktop, the selected-day panel sits about 1400px below the grid and repeats what the cells already show. Should it go beside the grid, or be removed above 768px?
- Is a date idea something the pair reads and acts on, or something they edit? If it is mostly planned from, why does opening one put a cursor in its title?
- Does "Everyone" need to be a filter? Tapping a partner's name in the legend to hide them would remove one option and the color collision.
## Assessment B: detector and rendered evidence


### Detector counts
- **Source scan** (`impeccable detect --json apps/web/src/features/calendar`): 0 findings, exit 0.
- **Rendered scan** (7 `.detect.json` files, 1440px light):
  - `calendar.detect.json`: 1 finding. `nested-cards` (warning) at selector `div.view-tabs`.
  - `events-new`, `events-eventId`, `events-eventId-edit`, `ideas`, `ideas-new`, `ideas-ideaId`: 0 findings each.

### Verified findings
The detector found nothing real. The findings below come from reading the code and comparing it with the tokens.

1. **Month grid event titles break inside words at 768 and 1024** (P2). `.event-row` sets `overflow-wrap:anywhere`, and `.day-events .event-row` has no line clamp. Narrow cells show "Weeken d", "restaura nt" and "mountai ns", and one event makes its week row about 380px tall. File: `apps/web/src/styles/calendar.css:28,37`. Command: **adapt**. Clamp titles to 2–3 lines and drop `anywhere` inside `.day-events`.
2. **The "Together" owner filter has no style** (P2). `owner-together` has no CSS rule, so the button has no fill or border and looks like plain text next to the other filters. File: `calendar.css:9-15`. Command: **polish**. It could use `shared-soft`/`shared`.
3. **Owner filters and view tabs use body type, not button type** (P3). `.owner-filters button` and `.view-tabs button` inherit 16px/400. The `button` token is 15px/600. "Everyone" and "Agenda" look lighter than "Today" beside them. Files: `calendar.css:9`, `controls.css:35`. Command: **typeset**.
4. **Event form checkboxes do not match the shared spec** (P3). The rule is `.event-fields input[type=checkbox] { width:22px; height:22px; }`. It has no `margin:0` and no `accent-color`. `.field-check` and `.task-row` use 24px, `margin:0` and a token accent. Visible effects:
   - Light mode: the box sits 4px right of the field edge.
   - Dark mode: it shows as a native grey filled square with no palette colour.

   File: `calendar.css:46`. Command: **harden**. Reuse the `.field-check` input rule.
5. **Token drift in `calendar.css`** (P3, **polish**):
   - Radius: `12px` is written as a literal 3 times (lines 9, 28, 42) instead of `var(--radius-control)`. The same literal is in `controls.css:35`. `6px` (line 37) is not a token. The `8px` on mobile is the badge value, written as a literal.
   - Spacing off the scale: `14px` (event-row padding), `6px` (line 37), `10px` (owner-filters padding 10/16 and 8/10 on mobile), `2px` (event-row-time).
   - Type off the scale: `24px` (month h2; the scale has 19/30/36/40), `11px` (`.day-count`, below the smallest token of 12), weight `500` (`.event-row-time`; the scale has 400/550/600/700/800), letter-spacing `-.02em`.
   - Colours: all use `var()`. No hex drift.
6. **Uneven card padding on event detail and forms** (P3, **layout**):
   - Event detail: the `<dl>` keeps its browser-default 16px margin, and `.actions` adds `margin-bottom:24px` inside the card. The result is about 40px top and 48px bottom against 24px sides. File: `EventDetailPage.tsx:66-78`. `.memory-detail .actions` already resets this; `.event-detail` does not.
   - Event and idea forms: the same `.actions` margin leaves 48px under Save, against 24px on the sides (`EventFormPage.tsx:143`, `IdeaFormPage.tsx:101`).

`quick-add` (planning.css) is not used by any calendar screen, so there was nothing to compare. `idea-grid` values are all on the token scale.

### False positives
- **`nested-cards` on `div.view-tabs`**: this is a segmented control (Month/Agenda) with a canvas fill, a 1px border and a 12px radius. It is not a card. The detector matched it on the bordered, rounded surface inside `.calendar-card`. There is no content nesting.

### Visible defects from screenshots
| Screen | Width / mode | Defect | Cause |
|---|---|---|---|
| calendar | 768, 1024 light | Event titles break inside words; the week row grows very tall | `.event-row` `overflow-wrap:anywhere`, no clamp (finding 1) |
| calendar | 390 light/dark | "Today" wraps onto its own line under the month title | `.calendar-date-controls` `flex-wrap` with h2 and 3 buttons |
| calendar | 390 light/dark | Owner filters wrap unevenly: "Everyone" is narrow, the long names fill the row and wrap to 2 centred lines, "Together" has no chip | `.owner-filters` `flex-wrap`, long-name stress data, no `owner-together` style |
| calendar | all widths | "Together" filter looks like plain text | finding 2 |
| calendar | 768–1440 light/dark | Weekday labels are centred, but day numbers sit at the left of the cell, so the columns do not line up | `.month-weekdays span{text-align:center}` against a left-placed `.day-number` with `padding:8px` |
| calendar | all widths | About 72px gap between "Monday, November 16" and "No events in this range." | default h2 bottom margin plus `.empty-state{padding:32px 0}` |
| calendar | 390, 1440 dark | Days outside the month show as near-black blocks, much heavier than the light version | `.month-day.outside{background:var(--canvas)}`; canvas-dark #14111B on surface-dark #221D2D |
| events-eventId | all widths | More space at the card's top and bottom than at its sides | finding 6 |
| events-new, events-eventId-edit | all widths light | Checkbox sits 4px right of the field edge | finding 4 |
| events-new, events-eventId-edit | 390, 1440 dark | Checkbox is a native grey filled square | finding 4, no `accent-color` |
| events-new, edit, ideas-new, ideas-ideaId | 1440 light/dark | The form card is centred while the page title stays left, so their left edges do not line up | `.form-page{max-width:var(--form-width); margin:24px auto}` (base.css:22), shared across the app |
| events-new, edit, ideas-new | all widths | 48px under the Save row, against 24px on the sides | finding 6 |

Capture effects, not defects:
- Faded primary, secondary and danger buttons in the 390 dark shots come from the 140ms colour transition.
- The focus ring on the idea title is autofocus.
- Single-line inputs cutting off the long title and location is normal input behaviour.

No horizontal scroll, overlapping text or controls under 48px were found:
- Day numbers, event rows, filters, the summary toggle and the checkbox labels are all at least 48px.
- Links in `.actions` and `.section-heading` get `min-height: var(--nav-target)`.

### Skipped steps
- **Browser overlay (step 4)**: skipped. There is no local backend and no live page in this container, and the overrides forbid starting servers.
- I checked no accessibility rules (contrast, focus, labels), per the overrides and `.impeccable/config.json`.
- I edited no files.
