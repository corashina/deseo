---
target: Tasks
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/user/deseo/apps/web/src/features/tasks"
timestamp: 2026-11-17T10-58-41Z
slug: apps-web-src-features-tasks
---
Method: dual-agent (A: A-tasks · B: B-tasks)

# Critique: Tasks (rescore, 2026-11-17)

Evidence: design-capture run on master a9c61d0, 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 28/40, 70%.** Baseline: 27/40. P0: 0 · P1: 1 · P2: 4 · P3: 0 (Assessment A).

P1 findings, all fixed in PR #35:

- Quick add is crushed from 1024 to about 1200px

P2 and P3 findings stay open for a later pass. Assessment B lists the detector results and visible defects. Questions are in Assessment A.

## Assessment A: design review


Mode: Operate. Evidence: `capture/tasks/tasks-*` and `tasks-taskId-*` (four light widths, two dark), `features/tasks/**`, `styles/planning.css`.

## Design specificity verdict

**Mostly category-interchangeable.** The structure is a standard to-do screen: segmented list tabs, an inline add form, checkbox rows, a collapsed Completed group, and an edit form. That is right for Operate mode. But Deseo shows only through the palette, Manrope, and `PartnerBadge`, and the only task captured is unassigned, so no partner color shows. Calendar has the owner strip and Today has the next plan glow; Tasks has no signature move. Its one authored detail, "Done by {name}" (TaskRow.tsx:46), is muted text inside a collapsed `<details>`.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Optimistic checkbox and "Saving…" work. A new undated task goes to the end of the open tasks, so on a long list the only sign of success is a cleared field. |
| 2 | Match with real world | 3 | Plain labels. "Completion failed." is terse. Only the date says "(optional)", but the assignee is optional too. |
| 3 | User control and freedom | 3 | Unchecking reopens a task. Cancel and the dialogs work. The detail page has no return link at the top. |
| 4 | Consistency and standards | 3 | Tabs cut names at 24ch, but the List select shows them in full. Small drift between controls. |
| 5 | Error prevention | 3 | Required and maxLength, version conflicts, an unsaved-changes warning, and remove dialogs that say what changes for both partners. |
| 6 | Recognition rather than recall | 3 | List names are cut even at 1440. The detail page hides completion state and who completed the task. |
| 7 | Flexibility and efficiency | 2 | Enter submits. No "Mine" filter, no way to clear completed tasks, no shortcut to New task. |
| 8 | Aesthetic and minimalist design | 3 | Calm and clean. The quick-add row is crushed at 1024, and the card is mostly empty at 1440. |
| 9 | Error recognition and recovery | 3 | Conflict copy is strong ("Your draft is kept.", Reload and discard). Row errors are vaguer. |
| 10 | Help and documentation | 2 | One-line intros and "Add one above." List removal moving tasks to General shows only in the dialog. |
| | **Total** | **28/40** | **Good (70%)** |

## Cognitive load

**2 of 8 fail (moderate, low end).**
- **Minimal choices**: the top of the card has 7 controls: two list tabs, New list, title, Assigned to, Due date, and Add task. Each new list adds a tab.
- **Progressive disclosure**: who and when are always open, but most adds are a title only. DESIGN.md asks for this layout, so this is a spec question.

The other six pass, including single focus, grouping, one plum primary, and one-screen editing.

## Emotional journey

- **Peak**: checking a box. The row strikes through at once and names who did it.
- **Valley**: a quiet list. At 1440 a 1120px card holds one grey "Unassigned" row. It reads as admin, not a shared notebook.
- **Reassurance**: good. "Both partners will lose this task." and "Its tasks move to General." name the result for both people. Conflict copy says the draft is kept.

## What's working

1. **Row anatomy** (TaskRow.tsx, planning.css:3-20): a separate 48px checkbox target, the rest as one link, wrapping titles, tabular due dates, and Overdue or Due today in danger or warning text, never a partner color.
2. **Honest durable writes**: command IDs, version conflicts, and "Retry task" or "Retry completion" keep input. The product principles show in the UI here.
3. **Narrow reflow** (planning.css:43-48): at 768 and 390, title and Add task share a row with who and when below. Dark mode keeps the hierarchy.

## Priority issues

1. **[P1] Quick add is crushed from 1024 to about 1200px**
   - Where: planning.css:25-29 and the `max-width: 1023px` block; tasks-1024.
   - Why: the breakpoint reads the viewport, but the 256px sidebar takes that space. Four controls share about 650px. The select shows "Unassigne", the date shows "mm/dd/y", and "Due date (optional)" wraps to two lines, so the labels do not line up. A long partner name in the select cannot be read.
   - Fix: give the card `container-type: inline-size` and use a container query. Keep who and when below the title until the card is about 760px wide. DESIGN.md: "Set breakpoints by available space."
   - Command: `adapt`
2. **[P2] The edit-task title clips on phones**
   - Where: TaskDetailPage.tsx:72 (`rows={2}`); tasks-taskId-390 and 390-dark.
   - Why: "final apartment check" is cut through the middle of the line. The person edits a title they cannot see in full.
   - Fix: add `field-sizing: content` and a min-height to `.task-form textarea`.
   - Command: `harden`
3. **[P2] The task screen hides completion**
   - Where: TaskDetailPage.tsx:67-88; tasks-taskId-*.
   - Why: a completed task opens like an open one. It does not say who completed it, and you cannot reopen it there. "Edit task / Choose a list, a person, and a due date." does not name the task.
   - Fix: add a state line under the header ("Completed by Sam · 12 Nov" or "Open") with a Complete or Reopen text button. Put the list name in the eyebrow.
   - Command: `clarify`
4. **[P2] A new task can land out of view**
   - Where: TasksPage.tsx:30 (sort) and QuickAdd `onSuccess`.
   - Why: an undated task goes after all dated tasks. On a long list, nothing visible changes, and partners will add it twice.
   - Fix: on success, scroll the new row into view and tint it once. Or show "Added to General." under the form.
   - Command: `harden`
5. **[P2] List tabs cut names that have room**
   - Where: planning.css:37 (`max-width: 24ch`); tasks-768 to 1440.
   - Why: names allow 40 characters. At 1440, "Apartment move and paperwork" is cut with 600px free, and the `title` tooltip does not work on touch.
   - Fix: remove the fixed cap. Let tabs shrink only when the row is full (`flex: 0 1 auto; min-width: 8ch`).
   - Command: `layout`

## Persona red flags

- **Alex (power user)**: there is no "Assigned to me" view across lists and no bulk clear of completed tasks. To reassign five tasks, Alex opens five edit pages.
- **Riley (stress tester)**: a 40-character list name is cut at every width. A long partner name is unreadable in the 1024 select. A 90-character title clips at 390. A completed task's detail page looks open.
- **Casey (mobile)**: Add task is at the top of the card, out of thumb reach, and the title input shrinks to about 200px. The 48px checkbox target is good.
- **"The partner who hands off a task"** (PRODUCT.md: assignment): wants to see what each person owns. There is no grouping or filter by person, and the "Done by" credit is hidden in the collapsed group.

## Minor observations

- Only the date says "(optional)", but Assigned to is optional too (TasksPage.tsx:82, TaskDetailPage.tsx:79).
- "Completion failed." gives no next step. Suggested copy: "We could not save this change." (TaskRow.tsx:30).
- At 390, New list sits 16px in from the tab edge because of the text-button padding (planning.css:34).
- In dark mode the unchecked checkbox is a flat grey native box, outside the palette (planning.css:11).
- At 1440 a title line runs about 760px. Cap `.task-title` near 70ch (planning.css:15).
- "Keep shared tasks in named lists." only repeats the nav label (TasksPage.tsx:34).

## Bolder move proposals

1. **colorize: owner strip on task rows.** Give assigned rows the Event row's 4px strip in `rose-accent` or `teal-accent`, and keep the name badge. Unassigned rows get no strip. Reason: Tasks is the only planning screen with no owner color, and the strip makes ownership readable at a glance. Screen: Tasks list and Today Due tasks (shared TaskRow).
2. **delight: make "Done by" visible.** Show the completer as a `PartnerBadge` and fill the checkbox over 140ms. Add no praise and no counts. Reason: completion is this area's only peak, and the "Feel like a pair" need has no answer here. Screen: Tasks list, Completed group.

## Questions to consider

1. Events open their details first, but a task opens straight into edit. Is a task with a completer really too short for a read view?
2. For two people with a few tasks, is General plus tabs right? Or should the default show all open tasks, grouped by person?
3. Should quick add show only the title until it has text? One change would fix the 1024 crush and the 7-control decision point.


## Assessment B: detector and rendered evidence


## Detector counts

**Source scan** (`impeccable detect --json apps/web/src/features/tasks`): 0 findings, exit 0. Files: `TasksPage.tsx`, `TaskDetailPage.tsx`, `TaskRow.tsx`, plus non-markup `commands.ts`, `queries.ts`, `realtime.ts`, `index.ts`. Config ignores low-contrast, gray-on-color, skipped-heading, and kicker-above-heading for `apps/web/src/**`.

**Rendered scan** (CDP, 1440px light):

| Screen | Rule | Selector | Count |
|---|---|---|---|
| `/tasks` | nested-cards (warning, slop) | `div.view-tabs` | 1 |
| `/tasks/:taskId` | none | none | 0 |

Total: 1 rendered finding, 0 source findings.

## Verified findings

The detector found nothing real. The findings below come from the screenshots and the CSS check.

| # | Sev | Finding | File | Command |
|---|---|---|---|---|
| 1 | P2 | At 1024px the quick-add row is too narrow for four controls. The select shows "Unassigne", the date input shows "mm/dd/y", and "Due date (optional)" wraps to two lines. The stacked layout starts only at `max-width: 1023px`. At 1024px the sidebar takes 256px, so the card content is about 654px wide. DESIGN.md says "Set breakpoints by available space". | `apps/web/src/styles/planning.css:25-28, 43-48` | layout (use a container query on the card, or a higher breakpoint) |
| 2 | P2 | On the edit task page at 390px (light and dark), the Title textarea clips its third line. "final apartment check" is cut in half and needs an inner scroll. The cause is `rows={2}` with a fixed height. | `apps/web/src/features/tasks/pages/TaskDetailPage.tsx:72`, `controls.css:21` | adapt / harden (`field-sizing: content` with a min height, or `rows={3}` on narrow screens) |
| 3 | P3 | On the edit task page, Cancel is an underlined link. DESIGN.md "Buttons" says to use the secondary button for Cancel. The 48px target is correct (`base.css:32`). | `TaskDetailPage.tsx:85` | polish, or clarify DESIGN.md if the link is intended |
| 4 | P3 | At 390px "New list" sits on its own row. The text button has 16px inner padding, so its label starts 16px to the right of the tabs and the field labels. | `planning.css:34`, `controls.css:6` | polish (for example `margin-left: calc(-1 * var(--space-4))` when it wraps, or full width) |
| 5 | P3 | `--shadow-selected` (pressed list tab) and `--shadow-popover` are defined only in `apps/web/src/styles/tokens.css:1`. They are not in `brand/tokens.json` or the DESIGN.md frontmatter. `--duration-feedback` and `--ease` are also missing there. This drift affects the whole app, not only Tasks. | `apps/web/src/styles/tokens.css:1`, used at `controls.css:54` | extract (add the values to both token files) |

## False positives

- **nested-cards on `div.view-tabs`**: false positive. `.view-tabs` (`controls.css:50`) is the segmented control that DESIGN.md defines ("View tabs and owner filters are segmented controls", line 423; "List tabs hold lists only, one line each", line 490). It is a 4px-padded track with a canvas fill, and it is not a content card. The detector flags it because it has a border, a radius, and a fill inside `.card`.

## Visible defects from screenshots

| Screen | Width | Mode | Defect | Cause |
|---|---|---|---|---|
| tasks | 1024 | light | Select and date input text clipped. "Due date (optional)" label wraps. The label rows are uneven, but the inputs stay aligned because of `align-items: flex-end`. | `.quick-add` flex row with no wrap rule between 1024px and about 1200px (`planning.css:25-28, 43`) |
| tasks-taskId | 390 | light + dark | Title textarea cuts the third line | `rows={2}` (`TaskDetailPage.tsx:72`) |
| tasks | 390 | light + dark | "New list" label is indented 16px from the left content edge | `.button.text` padding inside the wrapped `.task-lists` row |
| tasks | 390 | light + dark | List tabs split 50/50 (`flex:1`). "General" has a lot of empty space, and the long list name truncates to "Apartment move ...". This is minor and matches the equal-segment intent. | `controls.css:55` |
| tasks | 390 | light | Date input text "mm/dd/yyyy" touches the calendar icon (native control, 16px padding). Cramped, but readable. | native `input[type=date]` at about 150px width |

No horizontal scroll at any width. No overlap. In the long title the task row wraps cleanly (`overflow-wrap: anywhere`), and the checkbox target is 48px (`.task-check`). Every control I checked is 48px or taller: buttons, tabs, summaries, the task check, the row link, and Cancel. Dark mode uses the correct surfaces on both screens. The pressed tab, primary button (`primary-dark`), checkbox, and inputs are all readable. No light-only asset appears. Other task-rule values match the tokens: 14px is body-small, 15px is the button size, and all spacing uses `--space-*` and the radii tokens.

## Skipped steps

- **Browser overlay**: skipped. The local backend cannot run in this container, so no live page exists. The overrides also forbid starting servers.
- **States outside the captures**: not seen. These are overdue and due-today colors, completed tasks, list settings, the New list form, the error and retry rows, and the delete dialog. The captures show only one open, unassigned task without a due date.
