---
target: Tasks
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/deseo/apps/web/src/features/tasks"
timestamp: 2026-11-16T17-27-54Z
slug: apps-web-src-features-tasks
---
Method: dual-agent (A: A-tasks · B: B-tasks)

# Critique: Tasks (baseline, 2026-11-16)

Evidence: design-capture run 43916736848 (master 0eb7250 plus dark captures), 390/768/1024/1440 light, 390/1440 dark. Accessibility is out of scope by owner decision.

## Synthesis

**Score: 27/40 (Acceptable).** P0: 0 · P1: 2 · P2: 4 · P3: 6.

Both assessments agree that the task list works and holds up with long text, but it does not look like it belongs to a pair. The detector found 0 issues in source and on both rendered screens. Assessment B's token checks found the shared control drift (field height, button weight, literal radii) that Assessment A saw only as a 2px label offset.

| Sev | Finding | Where | Command | Source |
|---|---|---|---|---|
| P1 | Task rows show no owner color and never show who completed a task | TaskRow.tsx `.task-metadata`, planning.css | colorize | A |
| P1 | Quick add outweighs the list; 4 controls above the first task at 390; button wraps alone at 768/1024 | TasksPage.tsx QuickAdd, planning.css `.quick-add` | layout | A+B |
| P2 | Overdue and due-today look like any metadata; open tasks sort by creation | TaskRow.tsx `dueLabel`, TasksPage.tsx sort | clarify | A |
| P2 | Detail: single-line title clips; Save and Delete have equal filled weight; card centered under a left header | TaskDetailPage.tsx, base.css `.form-page` | layout | A+B |
| P2 | List tabs mix "New list" with lists; a long list name wraps to 4 lines at 390; List settings always open | TasksPage.tsx `.view-tabs`, controls.css | adapt | A+B |
| P2 | Fields render 50–52px against the 48px input token, so labels stagger | controls.css `.field input` | polish | B |
| P3 | Native checkbox is neutral gray in dark mode; two checkbox accents | planning.css, controls.css `.field-check` | polish | A+B |
| P3 | Primary button weight 700 against token 600 | controls.css `.button.primary` | typeset | B |
| P3 | Danger text color differs from DESIGN.md in dark mode | controls.css `.button.danger` | polish | B |
| P3 | Literal radii and off-scale gaps (10px) in tabs, status, dialog | controls.css | polish | B |
| P3 | Copy: "Add a task"/"Add task" repeat; empty list gives no next step; error text and Retry button ask twice | TasksPage.tsx, TaskRow.tsx | clarify | A |
| P3 | Edit link sits about 1000px from its title at 1440 | TaskRow.tsx | layout | A |

**Bolder moves (owner decides):** owner badges on task rows (colorize); a short "done together" state before a completed row moves (delight); a note-peach Completed group (colorize).

**Capture effects, not defects:** faded buttons in the 390 dark shots (transition caught mid-switch).

## Assessment A: design review


## Design specificity verdict
**Interchangeable with any task app.** The tokens are right: Manrope, plum primary, the lilac selected tab, warm canvas. But nothing on these screens comes from "The Shared Notebook". Calendar and messages use the rose and teal partner colours (`calendar.css` `.owner-a/.owner-b`, `messages.css` `.partner-a/b`, `controls.css` `.slot-a/b`). Tasks never do. The assignee shows as plain muted text (`TaskRow.tsx` `.task-metadata`). `completedBy` is in the domain type (`packages/domain/src/tasks/types.ts`) but nothing shows it. With the logo covered, this is a generic to-do card. The one thing that makes Tasks belong to a pair, who does what and who did it, is invisible.

## Heuristic scores
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Pending states are good ("Saving…", disabled checkbox). But a completed row drops into the collapsed `Completed (n)` details and gives no confirmation. The partner cannot see who completed it. |
| 2 | Match with real world | 3 | Plain labels. "Edit" opens the only detail view. A plain "Due · Mar 3" label on a completed past task reads oddly. |
| 3 | User control and freedom | 3 | Cancel, confirm dialogs, and uncheck in Completed all work. An accidental completion hides the row, and there is no undo near the row. |
| 4 | Consistency and standards | 2 | Owner colours appear in Calendar and Today but not on task rows. "New list", an action, sits inside the list tab group. The detail form is centred while its header is left-aligned (1440). |
| 5 | Error prevention | 3 | Command IDs, versions with CONFLICT, unsaved-change warnings, and delete confirmation all work. The whole `<label class="task-check">`, title included, toggles completion. |
| 6 | Recognition over recall | 3 | Options are visible. Due dates are hidden unless set, and open tasks sort by creation, so overdue tasks are not surfaced. |
| 7 | Flexibility and efficiency | 2 | Quick add submits on Enter. There is no due-date sort, no "clear completed", and no batch action. |
| 8 | Aesthetic and minimalist | 3 | Clean and flat. The quick-add form outweighs the tasks themselves (see P1). |
| 9 | Error recovery | 3 | "This task changed. Your draft is kept." plus Reload is a strong pattern. "Completion failed. Try again." is generic. |
| 10 | Help and documentation | 2 | "Keep shared tasks in named lists." is a tagline, not guidance. The empty state "No tasks in this list." gives no next step. |
| **Total** | | **27/40** | **Acceptable** |

## Cognitive load
- **Visual hierarchy fails.** On the list screen the quick-add form (three bordered fields plus a primary button) is the heaviest block. The task rows, which are the content, are lighter.
- **Progressive disclosure fails.** `ListSettings` (a rename form, a heading, and a danger button) is always shown under a custom list's tasks. It should be revealed only when needed.
- **Minimal choices: borderline.** The list tab group grows without limit: every list plus "New list". The quick-add row has 4 controls, which is at the limit.
- Two failures in total, so the load is **moderate**.

## Emotional journey
- **Peak (missed):** ticking off a shared task is the best moment in this area. Today it gives a strikethrough for one request, and then the row disappears into a closed `<details>`. There is no "Marek completed this" and no lingering done state.
- **Valley:** the 390px list screen. Four stacked form controls come before the first task. The long list name becomes a four-line tab ("Apartment / move and / paperwork / before May").
- **Reassurance:** strong at the high-stakes moments. Delete says "Both partners will lose this task." Remove list explains that tasks move to General. Conflicts keep the draft.

## What's working
1. Conflict and retry design in `TaskDetailPage.tsx`: the draft is kept, "Reload task and discard draft" is offered, and the button label changes to "Retry save". This is exactly PRODUCT principle 4.
2. Quick add sits on the list page and keeps one command ID per input, so a retry never creates a duplicate. "Add task" turns into "Retry task".
3. Long names and titles wrap cleanly in rows (`overflow-wrap:anywhere`, `min-width:0`) at every width. The 48px targets hold for the checkbox label, Edit, and tabs.

## Priority issues
1. **[P1] Task rows drop owner colour and never show who completed a task.**
   - **Where:** `TaskRow.tsx` `.task-metadata`, and `planning.css` `.task-metadata`. This shows on all widths, on Tasks and on Today's Due tasks.
   - **Why:** DESIGN.md's task row needs an owner, and the Name Beside Color Rule plus the "Coordinate daily work" row expect a partner badge. Without it, a partner cannot scan for "mine". `completedBy` is fetched and discarded.
   - **Fix:** render the assignee as a badge with `.slot-a`/`.slot-b` (rose or teal soft fill, name inside), mapped from stable member order. Completed rows add "Completed by {name}" in muted text.
   - **Command:** colorize
2. **[P1] Quick add outweighs the list.**
   - **Where:** `TasksPage.tsx` `QuickAdd`, `planning.css` `.quick-add`. At 1440 the title field gets one third of the row. At 768/1024 "Add task" wraps alone onto a second row. At 390 four controls stack above the first task.
   - **Why:** the main job (scan and complete) is pushed down, and the title field, the only required input, looks like the others.
   - **Fix:** give the title field `flex: 3 1 280px` with the button inline beside it. Put Assigned to and Due date in a compact second line under the title, or show them after the title gets focus. Keep the button on the title row at all widths.
   - **Command:** layout
3. **[P2] Overdue and due-soon are invisible.**
   - **Where:** `TaskRow.tsx` `dueLabel`, and the sort in `TasksPage.tsx` (`open` keeps `created_at` order).
   - **Why:** "Overdue · Nov 2" renders in the same muted 14px as "Unassigned". DESIGN asks for overdue labels kept separate from partner colours, but they get no status treatment at all.
   - **Fix:** put "Overdue" in a `warning`/`warning-soft` badge with an icon, put "Due today" in ink weight 600, and sort open tasks by due date, then creation.
   - **Command:** clarify
4. **[P2] The detail page is a cramped form for a long title, with two equal-weight filled buttons.**
   - **Where:** `TaskDetailPage.tsx`, at all widths. The single-line `<input>` cuts "…the final apartm" at 1440 and at "the" at 390. Save (primary fill) and Delete (danger fill) compete. At 1440 the form is centred under a left-aligned header (`base.css .form-page margin:auto`).
   - **Fix:** make Title an auto-growing textarea. Make "Delete task" a danger text or secondary button inside the separated `.task-delete` zone. Left-align `.form-page` with the header on portal pages. Add the completion state and a Complete/Reopen toggle, because the page title promises the task's details.
   - **Command:** layout
5. **[P2] The list tab group mixes navigation with an action and does not scale.**
   - **Where:** `TasksPage.tsx` `.view-tabs`, and `controls.css`. At 390 the tabs take `flex:1`, so a 40-character list name wraps to four lines, and five lists become a wall of tabs.
   - **Fix:** move "New list" out of the group as a text button ("Add list") beside it. Below 768 use a horizontally scrolling tab row with `white-space:nowrap` and max-width ellipsis, or a select. Move List settings behind a "List settings" `<details>`.
   - **Command:** adapt

## Persona red flags
- **Alex (power user):** cannot sort by due date or clear completed tasks in one action. Editing a title means leaving the list for a full page. Completing several tasks is one row at a time, and each one jumps away.
- **Riley (stress tester):** the tab breaks into four lines with a long list name at 390. A 200-character title is cut off in the edit input. A completed task with a past due date shows a bare "Due · date". Removing a list with tasks takes two RPCs, and the code comments that a failed delete leaves an empty list, so "Retry removal" is required.
- **Casey (mobile):** at 390 the first task is about 700px down, below four form controls. Tapping anywhere on a wrapped title completes the task, and it then vanishes into a closed group. That is an easy mistake on a thumb tap, and recovery means opening "Completed".
- **Partner (PRODUCT.md user, coordinating with the other partner):** cannot tell at a glance which tasks are theirs (no owner colour) or whether the partner already finished something (no completed-by). This is the core "know each other's work" need.

## Minor observations
- `planning.css`: the date input in quick add is about 2px taller, so the "Due date (optional)" label sits higher than its siblings at 1024/1440.
- `planning.css` `.task-row input[type=checkbox]`: the native unchecked box renders flat grey in dark mode, off the Midnight palette. Consider `color-scheme` or a custom box using `--control-dark`.
- `TaskRow.tsx`: "Edit" sits about 1000px from the title at 1440. Consider capping row width or putting the link closer.
- `TasksPage.tsx`: the label "Add a task" plus the button "Add task" repeat each other. A "Title" label is clearer.
- `TasksPage.tsx`: "No tasks in this list." needs a next step, for example "Add the first task above."
- `TaskDetailPage.tsx`: the header says "Edit task" with no task name. The description is a list of fields, not the task.
- `TaskRow.tsx`: the error copy "Completion failed. Try again." is followed by a separate "Retry completion" button, which asks for the same action twice.

## Bolder move proposals
1. **Owner badges on task rows** (colorize; Tasks list and Today Due tasks). Use the existing rose and teal soft fills with the name inside. This is the strongest pastel-world signal the area lacks, and it follows DESIGN.md's partner badge.
2. **A "done together" moment** (delight; Tasks list). On completion, keep the row in place for about 1.5s with a `success-soft` fill and "Completed by {name}", then slide it into Completed with a 200ms transform. This rewards the shared act without scoring or streaks.
3. **Note-peach Completed group** (colorize; Tasks list). Give the open `Completed (n)` group the `note`/`note-line` warm fill, so finished work reads as the shared notebook's record, not a hidden drawer.

## Questions to consider
- If both partners see the same list, why does no task row say whose it is?
- Is quick add the main thing on this screen, or are the tasks? The 390 layout says quick add.
- Should completing a task on Today and on Tasks feel like something happened between two people, rather than something disappearing?
## Assessment B: detector and rendered evidence


### Detector counts
- **Source scan.** I ran `impeccable detect --json apps/web/src/features/tasks` from `/home/user/deseo`. It returned `[]` with exit 0. There were 0 findings across 6 files, including TasksPage.tsx, TaskDetailPage.tsx and TaskRow.tsx.
- **Rendered scan.** `capture/tasks/tasks.detect.json` and `capture/tasks/tasks-taskId.detect.json` both contain `[]`, so 0 findings on either screen.
- `.impeccable/config.json` turns off low-contrast, gray-on-color and skipped-heading on purpose.

### Verified findings
The detector found nothing. All findings below come from reading the CSS against the DESIGN.md frontmatter.

1. **P2: Fields are taller than the 48px input token.** File: `apps/web/src/styles/controls.css:19`. The rule sets `min-height:48px` plus `padding:12px 16px`. Text and select inputs render at 50px. The date input renders at 52px (Chromium adds inner height). The Add task button is 48px. In the quick-add row the bottoms line up at y=403, but the tops are 352 (date), 354 (text and select) and 356 (button). So the "Due date (optional)" label sits 2px above the other two labels. DESIGN `components.input.height` is 48px. Suggested fix: give inputs a fixed `height` / `block-size` and `line-height`. Command: **polish**.
2. **P3: Primary button weight drifts from the token.** File: `controls.css:2`. `.button.primary` sets `font-weight:700`, but `typography.button` is 600. Command: **typeset**.
3. **P3: Danger button text color drifts in dark mode.** File: `controls.css:5`. `.button.danger` uses `color: var(--on-primary)`, but DESIGN `button-danger.textColor` is `{colors.surface}`. Light mode is the same (#FFF). Dark mode differs: #1A1526 against #221D2D. Command: **polish**.
4. **P3: Off-scale and hard-coded values in the list tabs.** File: `controls.css:36`. `.view-tabs button` uses `padding:10px 16px`, and 10px is not on the spacing scale. It also hard-codes `border-radius:12px` instead of `var(--radius-control)`. The tabs sit inside a 12px-radius container with 4px padding, so the corners are not concentric. `rounded.badge` (8px) would fit. Command: **polish**.
5. **P3: More literals in controls.css.**
   - `.button { gap:10px }` (line 1) is off scale.
   - `.status { border-radius:12px }` (line 25) should be `var(--radius-control)`.
   - `dialog { border-radius:20px }` (line 32) should be `var(--radius-card)`.

   Command: **polish**.
6. **P3: Checkbox styles do not use the tokens.** Files: `planning.css:9` and `controls.css:22`. Unchecked task checkboxes use the Chromium default box, not the `control` #8B8293 boundary from DESIGN.md:264. In dark mode the box is a neutral gray #3B3B3B, which falls outside the purple palette (1440-dark, x≈328 y≈477). The two checkbox rules also use different accents: the task checkbox uses `accent-color: var(--shared)`, and `.field-check` uses `var(--link)`. These match in light mode but differ in dark (#BBA4F7 against #C9B5F7). Command: **polish**.
7. **P3: Edit form does not line up with the page header on wide screens.** File: `apps/web/src/styles/base.css:22`. `.form-page { max-width: var(--form-width); margin: 24px auto }` centers the 720px card. At 1440px the card starts at x=488, but the "Edit task" title and description start at x=288. Command: **layout**.

The task-* rules in `planning.css` (lines 3–28, 37) use only on-scale values (4/8/12/16/20/24) and token colors. I found no drift there.

### False positives
None. The detector reported nothing.

### Visible defects from screenshots
- **tasks, 390 light and dark: list tabs.** The tabs use `flex:1` (controls.css:38, mobile rule). They split the width equally, so "Apartment move and paperwork before May" wraps to 4 lines. The "General" pill then grows to about 112px tall. Cause: equal flex on every tab plus a long list name. Command: **adapt**. Options are horizontal scroll or `flex:1 1 auto` with an ellipsis.
- **tasks, 390 light and dark: uneven quick-add wrap.** "Add a task" and "Assigned to" each take a full row. "Due date" and "Add task" then share the last row. Cause: `.quick-add .field { flex:1 1 180px }` plus an auto-width button (planning.css:20–21). Command: **layout**.
- **tasks, 768 and 1024 light: button wraps alone.** The three fields fill one row and "Add task" wraps to its own row on the left. This is acceptable, but at 1440 the button sits inline. The same flex rule causes it. P3.
- **tasks, 1440 light and dark: staggered labels.** The labels and field tops in the quick-add row are off by 2–4px. Cause: finding 1.
- **tasks-taskId, 1440 light and dark: misaligned card.** The form card is centered and not aligned with the page header. Cause: finding 7.
- **tasks and tasks-taskId, 390 dark: buttons look faded.** Add task, Save changes and Delete task look washed out. This is a **capture effect, not a defect**. The pixels match a 75% point between the light and dark tokens. For example, the background is (164,143,216), which is 75% of the way from #60527C to #BBA4F7, and the text is (83,80,92), 75% of the way from #FFF to #1A1526. The shot was taken during the 140ms `background-color`/`color` transition on `.button` (controls.css:1) while the theme switched. At 1440-dark the colors are correct (#BBA4F7 with #1A1526 text). For real users this is only a short fade when the device appearance changes.
- No horizontal scroll, clipped text or overlap in the task areas at any width. The title input in the edit form cuts long text off at the field edge, which is normal for single-line inputs.
- **Touch targets:**
  - The task checkbox is 24px, but its label hit area is at least 48px (`.task-check`).
  - The "Edit" link is at least 48×48px (`.task-details`).
  - The tabs, buttons and inputs are all at least 48px.
  - No target is under 48px.
- **Dark mode:** surfaces, text and the card are correct. The only issue is the gray checkbox in finding 6. There are no light-only assets.
- The long partner names wrap in the top bar at 768 and 390. That bar belongs to the shell, so I did not judge it here.

### Skipped steps
- **Browser overlay (step 4):** skipped. There is no local backend and no live page in this container, and the overrides forbid starting servers.
- **Completed-tasks `<details>`, List settings, New list form, error states and the dialog:** not checked visually. The captures show only the General list with one open task and the edit form. The "Apartment move…" list (which would show List settings) and the "New list" tab are not captured.
- I edited no files. All screenshots are in `/tmp/claude-0/-home-user/a1136e82-3529-5ad9-805a-aba66d8eeeb4/scratchpad/baseline/capture/tasks/`.
