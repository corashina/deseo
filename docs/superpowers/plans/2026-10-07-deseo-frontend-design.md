# Deseo Frontend Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Track work with the checkboxes below.

**Goal:** Apply the approved pastel design across the existing browser and native product.

**Architecture:** Keep platform UI separate. Update shared controls before feature screens. Keep existing feature interfaces and data access.

**Tech Stack:** React DOM, Vite, React Router, Expo, React Native, TypeScript, Playwright, Jest, existing brand tokens.

**Spec:** [Approved frontend design](../specs/2026-10-07-deseo-frontend-design.md).

Status: Awaiting owner review and execution choice.

## Global Constraints

- Keep Deseo's pastel colors and Two voices icon.
- Keep the current product flows, route addresses, feature interfaces, data contracts, and access rules.
- Preserve unrelated working changes and local user data.
- Use the implemented settings controls. Pending backend work does not authorize new account controls in this design.
- The planned public site remains a separate delivery.
- Remove obsolete styles when replacing them. Do not keep compatibility selectors or introduce new product dependencies for this update.
- Do not add UI contracts to `packages/domain`.
- Keep browser drafts in memory. Preserve native draft storage and existing query ownership.
- Use system fonts. Keep 16px form text, 20px browser section titles, and 48px/dp shared control targets.
- Keep 20px card corners and 12px control corners. Use existing spacing tokens.
- Keep 1440px browser content, 720px form, and 960px message caps.
- Keep 16px phone page padding, 20px phone card padding, and 24px desktop card padding.
- Keep instructions within 20 words. Apply stop-slop to changed UI text and documentation.
- Follow AGENTS.md's motion rule; do not add reduced-motion variants.
- Rate tests before writing them. Implement tests only at importance 90 or higher.
- Use Node 24.18.0, npm 11.16.0, and the root lockfile. Inspect current scripts before running environment commands.

## Review Focus

- Narrow headers with long text: keep the action readable and reachable. Task 1 extends the existing layout test; importance 92.
- Phone Today: keep content and keyboard order aligned. Task 3 adds a behavior check; importance 90.
- Direct route loads: render note and memory styles without visiting another feature. Task 6 extends browser checks; importance 92.
- Viewer changes: keep sender colors bound to partner slots. Task 6 checks both viewers; importance 95.
- Native keyboard and large text: keep Send and the final field reachable. Task 6 records device checks; importance 95.

## Execution rules

Read README.md, docs/README.md, STYLE.md, ARCHITECTURE.md, DATA.md, and the spec before product work.

Use Anthropic's frontend-design skill for each layer. Review its composition against Deseo's purpose before editing.

Use the worktree skill at execution start. Capture working changes and determine whether the checkout is already isolated.

Preserve the selected source state. Use the existing worktree or create an isolated checkout without moving unrelated edits.

Review each listed screen and its states. Record screens that meet the spec without further changes.

Run behavior tests before changing behavior. Reuse existing tests for visual changes that preserve behavior.

Do not add tests for decorative values. Review rendered screenshots for visual quality.

Commit each usable layer with explicit file paths. Keep unrelated edits out of commits.

## File boundaries

| Owner | Responsibility |
|---|---|
| `brand/tokens.json` | Existing palette, spacing, corner sizes, and target size |
| `apps/web/src/styles` | Browser foundation, shell, controls, and feature styling |
| `apps/mobile/src/theme/index.ts` | Native token mapping and type scale |
| Platform `components/ui` directories | Platform controls and layout components |
| Platform feature pages, screens, and components | Feature composition and local copy |
| `apps/web/tests` | Existing real-browser behavior, layout, and capture checks |
| Existing native feature tests | Native behavior and failure recovery |
| `docs/design/frontend-2026-10-07` | New visual evidence for this update |
| `docs/handoffs/frontend-design.md` | Results, source revision, coverage, and remaining device checks |

### Task 1: Foundation, controls, and navigation

**Files:**

- Modify: `apps/web/src/styles/tokens.css`, `base.css`, `controls.css`, and `shell.css`.
- Modify: `apps/web/src/app/AppShell.tsx` and `apps/mobile/src/app/(tabs)/_layout.tsx`.
- Review: `brand/tokens.json` and `apps/web/src/main.tsx`; retain their existing palette and startup token mapping.
- Modify: `apps/mobile/src/theme/index.ts`.
- Review controls in `apps/web/src/components/ui`: `Button.tsx`, `PageHeader.tsx`, `Field.tsx`, `Dialog.tsx`, `Avatar.tsx`, `Status.tsx`.
- Review controls in `apps/mobile/src/components/ui`: `Button.tsx`, `Field.tsx`, `Screen.tsx`, `Section.tsx`, `RowGroup.tsx`.
- Review remaining native controls: `Avatar.tsx`, `Badge.tsx`, `Chips.tsx`, `Countdown.tsx`, `DetailRow.tsx`, `IconButton.tsx`, `Status.tsx`.
- Test: `apps/web/tests/screenshot-layout.spec.ts`, `shell.spec.ts`, and `accessibility.spec.ts`.
- Test: `apps/mobile/src/components/ui/Field.test.tsx`.

Bare filenames in a file list share the directory of its first full path.

**Interfaces:**

- Consume `brand/tokens.json` through the existing startup mapping and native theme.
- Preserve `PageHeader({ title, description?, action? })`; `title` is a string and `action` is a ReactNode.
- Preserve browser `Button` with HTML button attributes and `variant: 'primary' | 'secondary' | 'danger'`.
- Preserve native `Button(props: ButtonProps)` and `Field(props: FieldProps)` with their existing exports.
- Preserve `Screen` title, subtitle, action, toolbar, refreshing, onRefresh, and children props.
- Produce shared control styling for later tasks. Do not add a cross-platform control interface.

- [ ] **Step 1:** Extend the importance-92 layout test with heading/action bounds at 320px and doubled text sizes.

Assert `document.documentElement.scrollWidth <= innerWidth`. Assert the header action has a visible label and nonzero bounds.

Assert the action does not overlap the heading. Use element bounds rather than an expected CSS class.

- [ ] **Step 2:** Run the targeted test before changing header layout. Record whether the new assertion exposes existing drift.

Run: `npm run test:web -- screenshot-layout.spec.ts --project=narrow`.

- [ ] **Step 3:** Align foundation styles with the spec.

Remove Inter from the font preference. Set browser section headings to 20px. Use the approved target and spacing values.

Give header actions their own row when space is insufficient. Keep the sidebar, rail, drawer, and native tabs.

Keep button labels visible during loading. Preserve disabled, busy, error, focus, and dialog cancellation behavior.

Keep static styles outside repeated native renders. Scope browser feature selectors to their feature.

- [ ] **Step 4:** Verify the controls and shell.

Run: `npm run test:web -- screenshot-layout.spec.ts shell.spec.ts accessibility.spec.ts`.

Run: `npm run test:mobile -- --runTestsByPath src/components/ui/Field.test.tsx`.

Expected: passing assertions, preserved focus return, readable controls, and no overflow at the five widths.

- [ ] **Step 5:** Render Today, Welcome, a form, and a dialog on both platforms. Review type, spacing, and ownership labels.
- [ ] **Step 6:** Commit the reviewed foundation files as `style: align frontend foundation and controls`.

### Task 2: Authentication, pairing, and settings

**Files:**

- Browser auth pages in `apps/web/src/features/auth/pages`: `WelcomePage.tsx`, `EmailPage.tsx`, `VerifyPage.tsx`, `ProfilePage.tsx`.
- Browser pair pages in `apps/web/src/features/pair/pages`: `StartPage.tsx`, `InvitePage.tsx`, `JoinPage.tsx`, `WaitingPage.tsx`, `WelcomePage.tsx`, `EndedPage.tsx`.
- Browser settings pages in `apps/web/src/features/settings/pages`: `SettingsPage.tsx`, `ProfileSettingsPage.tsx`, `PairSettingsPage.tsx`, `AccountSettingsPage.tsx`.
- Modify: `apps/web/src/styles/settings.css`; use Task 1's entry and form styles.
- Native auth screens in `apps/mobile/src/features/auth/screens`: `WelcomeScreen.tsx`, `EmailScreen.tsx`, `VerifyScreen.tsx`, `ProfileScreen.tsx`.
- Native pair screens in `apps/mobile/src/features/pair/screens`: `EntryScreen.tsx`, `StartScreen.tsx`, `InviteScreen.tsx`, `JoinScreen.tsx`, `WaitingScreen.tsx`, `WelcomeScreen.tsx`, `EndedScreen.tsx`, `SettingsScreen.tsx`.
- Review: `apps/web/src/app/NotFoundPage.tsx` and `RouteErrorPage.tsx`.
- Test: `apps/web/tests/entry.spec.ts`, `invite.spec.ts`, `settings.spec.ts`, `navigation.spec.ts`, and `accessibility.spec.ts`.
- Test: `apps/mobile/src/features/auth/auth.test.ts` and `apps/mobile/src/features/pair/pair.test.ts`.

**Interfaces:**

- Consume Task 1's platform controls without changing their props.
- Preserve exported route pages and screens. Keep existing session and pair queries and commands.
- Produce consistent entry, form, detail, and destructive-action composition for the remaining screens.

- [ ] **Step 1:** Run the existing entry, invitation, settings, and draft navigation tests before editing.

Run: `npm run test:web -- entry.spec.ts invite.spec.ts settings.spec.ts navigation.spec.ts`.

- [ ] **Step 2:** Apply the selected icon, focused forms, and concise copy to auth and pair screens.

Keep invitation context through sign-in. Keep code entry, expiry, waiting, unavailable, and failed-delivery states clear.

- [ ] **Step 3:** Group settings by profile, pair, preferences, and account. Keep destructive actions separate.

Keep existing verification controls and their input. Preserve settings access for unpaired accounts and ended pairs.

Do not add export, deletion, or avatar controls from pending backend work.

- [ ] **Step 4:** Verify normal, invalid-code, offline, waiting, ended, conflict, and cancellation states.

Run the Step 1 command and `npm run test:web -- accessibility.spec.ts`.

Run: `npm run test:mobile -- --runTestsByPath src/features/auth/auth.test.ts src/features/pair/pair.test.ts`.

Expected: existing journeys and input retention pass. Render native screens to verify composition beyond command tests.

- [ ] **Step 5:** Commit reviewed auth, pair, and settings files as `style: refine entry and settings screens`.

### Task 3: Today, Calendar, events, and date ideas

**Files:**

- Modify: `apps/web/src/features/today/pages/TodayPage.tsx` and `apps/mobile/src/features/today/screens/TodayScreen.tsx`.
- Browser calendar components in `apps/web/src/features/calendar/components`: `EventRow.tsx`, `EventFields.tsx`, `MonthGrid.tsx`, `Agenda.tsx`, `PartnerDayView.tsx`.
- Browser calendar pages in `apps/web/src/features/calendar/pages`: `CalendarPage.tsx`, `EventFormPage.tsx`, `EventDetailPage.tsx`.
- Browser idea pages in `apps/web/src/features/calendar/ideas/pages`: `IdeasPage.tsx`, `IdeaFormPage.tsx`, `IdeaDetailPage.tsx`.
- Modify: `apps/web/src/styles/calendar.css` and the Today/idea selectors in `apps/web/src/styles/planning.css`.
- Native calendar screens in `apps/mobile/src/features/calendar/screens`: `CalendarScreen.tsx`, `EventFormScreen.tsx`, `EventDetailScreen.tsx`, `IdeaListScreen.tsx`, `IdeaFormScreen.tsx`, `IdeaDetailScreen.tsx`.
- Review: `apps/mobile/src/features/calendar/components/EventRow.tsx`.
- Test: `apps/web/tests/today.spec.ts`, `calendar.spec.ts`, `ideas.spec.ts`, and `route-controls.spec.ts`.
- Test: `apps/mobile/src/features/today/screens/TodayScreen.test.tsx` and `apps/mobile/src/features/calendar/screens/EventFormScreen.test.tsx`.

**Interfaces:**

- Preserve browser `EventRow({ event, names, timezone, showDate? })` with `names: OwnerNames` and `event: Event`.
- Preserve native EventRow props and the existing Today feature query results.
- Preserve event and idea forms, command IDs, time validation, and visibility confirmation.
- Produce Today source order: events, memory, note, tasks, important date.

- [ ] **Step 1:** Add an importance-90 Today order check using the existing pair fixture and data-testid section markers.

Add `data-testid="today-important-date"` to the existing important-date section. Keep the other section markers.

Assert these markers occur in this document order:

```text
today-events, today-memory, today-note, today-tasks, today-important-date
```

At 390px, assert their top coordinates increase in the same order. Assert section links follow that order during keyboard navigation.

Extend the importance-95 native Today test to check displayed section order and the important date's absolute date.

- [ ] **Step 2:** Run the new browser assertion before restructuring Today.

Run: `npm run test:web -- today.spec.ts --project=narrow`.

Expected: the current tasks-before-memory order fails the order assertion.

- [ ] **Step 3:** Put Today sections in the approved source order and position desktop sections with CSS grid.

Use explicit grid areas for desktop planning and personal content. Keep the one-column source order below the two-column threshold.

Keep three-plan and three-task limits. Show the important date's absolute date using the existing event value and pair timezone.

- [ ] **Step 4:** Refine calendar and idea layouts with clear date controls, owner labels, and grouped form fields.

Keep phone agenda access and the month count/list pattern. Preserve shared-event placement and date rules.

- [ ] **Step 5:** Verify composition, event edits, visibility, and date planning.

Run: `npm run test:web -- today.spec.ts calendar.spec.ts ideas.spec.ts route-controls.spec.ts`.

Run: `npm run test:mobile -- --runTestsByPath src/features/today/screens/TodayScreen.test.tsx src/features/calendar/screens/EventFormScreen.test.tsx`.

Expected: order checks pass; existing event, timezone, conflict, and planning behavior passes.

- [ ] **Step 6:** Commit reviewed planning files as `style: refine Today and calendar composition`.

### Task 4: Tasks, lists, notifications, and preferences

**Files:**

- Browser task pages in `apps/web/src/features/tasks/pages`: `TasksPage.tsx`, `TaskFormPage.tsx`, `TaskDetailPage.tsx`, `ListManagerPage.tsx`, `ListDetailPage.tsx`.
- Review: `apps/web/src/features/tasks/components/TaskRow.tsx` and task/list selectors in `apps/web/src/styles/planning.css`.
- Browser notification pages in `apps/web/src/features/notifications/pages`: `NotificationsPage.tsx`, `PreferencesPage.tsx`.
- Modify: `apps/web/src/styles/notifications.css` and `reminders.css`.
- Review: `apps/web/src/features/notifications/components/ReminderControl.tsx`.
- Native task screens in `apps/mobile/src/features/tasks/screens`: `TasksScreen.tsx`, `TaskFormScreen.tsx`, `TaskDetailScreen.tsx`, `ListDetailScreen.tsx`.
- Native task components in `apps/mobile/src/features/tasks/components`: `TaskRow.tsx`, `ListManager.tsx`.
- Native notification screens in `apps/mobile/src/features/notifications/screens`: `NotificationListScreen.tsx`, `NotificationPreferencesScreen.tsx`.
- Native notification components in `apps/mobile/src/features/notifications/components`: `ReminderControl.tsx`, `DevicePermission.tsx`.
- Test: `apps/web/tests/tasks.spec.ts`, `notifications.spec.ts`, and `failures.spec.ts`.
- Test: `apps/mobile/src/features/tasks/components/TaskRow.test.tsx`, `ListManager.test.tsx`, and `apps/mobile/src/features/notifications/components/ReminderControl.test.tsx`.

**Interfaces:**

- Preserve browser `TaskRow({ task, accountId, assignee })` with `task: Task` and string account/name values.
- Preserve native TaskRow callbacks, completion state, and Undo behavior.
- Preserve reminder values, quiet-hours inputs, notification paging, and native permission controls.
- Produce readable task/list rows and notification states using existing platform controls.

- [ ] **Step 1:** Run the existing completion, retry, list, and notification checks.

Run: `npm run test:web -- tasks.spec.ts notifications.spec.ts failures.spec.ts`.

- [ ] **Step 2:** Refine task rows and list actions. Keep full-row targets and readable completed text.

Keep assignment names and due dates visible. Preserve unconfirmed completion actions and retry input.

- [ ] **Step 3:** Refine notification and preference screens. Show status and recovery beside the affected setting or source.

Keep browser notification reads separate from native device permissions. Preserve unavailable-source behavior.

- [ ] **Step 4:** Rerun Step 1 and the native component tests.

Run: `npm run test:mobile -- --runTestsByPath src/features/tasks/components/TaskRow.test.tsx src/features/tasks/components/ListManager.test.tsx src/features/notifications/components/ReminderControl.test.tsx`.

Expected: completion, Undo, failure recovery, list operations, and reminder values pass.

- [ ] **Step 5:** Commit reviewed task and notification files as `style: refine tasks and notification screens`.

### Task 5: Memories and photo forms

**Files:**

- Browser memory pages in `apps/web/src/features/memories/pages`: `MemoriesPage.tsx`, `MemoryFormPage.tsx`, `MemoryDetailPage.tsx`.
- Browser memory components in `apps/web/src/features/memories/components`: `MemoryCard.tsx`, `MemoryImage.tsx`, `PhotoSelection.tsx`.
- Modify: `apps/web/src/styles/memories.css`.
- Native memory screens in `apps/mobile/src/features/memories/screens`: `MemoryLayout.tsx`, `MemoriesScreen.tsx`, `MemoryFormScreen.tsx`, `MemoryDetailScreen.tsx`.
- Native memory components in `apps/mobile/src/features/memories/components`: `MemoryCard.tsx`, `MemoryImage.tsx`.
- Test: `apps/web/tests/memories.spec.ts` and `navigation.spec.ts`.
- Test: `apps/mobile/src/features/memories/screens/MemoryFormScreen.test.tsx` and `apps/mobile/src/features/memories/components/MemoryImage.test.tsx`.

**Interfaces:**

- Preserve browser `MemoryCard({ memory, author })` and native `MemoryCard({ memory, authorName, onOpen })`.
- Preserve browser `MemoryImage({ photoId, variant?, alt })` with `variant: 'full' | 'thumb'`.
- Preserve native image access, dimensions, and private-media lifecycle.
- Produce reserved 3:2 feed crops with captions outside images and full images in details.

- [ ] **Step 1:** Run the existing memory upload, author, media failure, and draft checks.

Run: `npm run test:web -- memories.spec.ts navigation.spec.ts`.

- [ ] **Step 2:** Refine month groups, image cards, caption spacing, and detail actions on both platforms.

Keep the photo as the main visual focus. Use one phone column and readable wider grids.

- [ ] **Step 3:** Refine selection and upload states. Preserve captions and photo-specific Retry controls.

Keep prepared full images unchanged. Reserve image space during loading and failure.

- [ ] **Step 4:** Rerun Step 1 and the native memory tests.

Run: `npm run test:mobile -- --runTestsByPath src/features/memories/screens/MemoryFormScreen.test.tsx src/features/memories/components/MemoryImage.test.tsx`.

Expected: upload retries, author controls, draft retention, and private-media access pass.

- [ ] **Step 5:** Commit reviewed memory files as `style: refine memory layouts and photo forms`.

### Task 6: Messages, notes, and direct-route consistency

**Files:**

- Modify: `apps/web/src/features/messages/pages/MessagesPage.tsx` and `apps/web/src/styles/messages.css`.
- Browser message components in `apps/web/src/features/messages/components`: `MessageRow.tsx`, `NoteCard.tsx`, `Composer.tsx`.
- Modify: `apps/mobile/src/features/messages/screens/MessagesScreen.tsx`.
- Native message components in `apps/mobile/src/features/messages/components`: `MessageRow.tsx`, `NoteCard.tsx`, `Composer.tsx`.
- Review: `apps/web/src/features/today/pages/TodayPage.tsx` feature stylesheet imports.
- Test: `apps/web/tests/messages.spec.ts`, `navigation.spec.ts`, and `screenshot-layout.spec.ts`.
- Test: `apps/mobile/src/features/messages/screens/MessagesScreen.test.tsx`.
- Create device-check records in `docs/handoffs/frontend-design.md` during Task 7.

**Interfaces:**

- Preserve browser `MessageRow({ message, name, slot, own, disabled, onPin, onDelete })` and native member/own props.
- Preserve browser `Composer({ body, disabled, onChange, onSend })` and native Composer's forwarded TextInput ref.
- Preserve NoteCard pin/unpin and Reply callbacks. Keep notes within the message feature.
- Produce compact conversation grouping, stable sender colors, peach notes, and a reachable composer.

- [ ] **Step 1:** Add importance-92 direct-route assertions for Today and the Messages notes view in fresh browser contexts.

Load each URL without visiting Calendar or Memories. Assert note backgrounds match the computed `--note` token.

Assert visible memory images keep reserved bounds while loading. Retain the current private media fixture.

- [ ] **Step 2:** Add an importance-95 sender identity check to the existing browser conversation test.

Sign in as each fixture partner. Assert the same message keeps its author name and background while alignment changes.

Compare computed backgrounds for that message across both viewers. Check that the viewer's own message aligns to the trailing edge.

- [ ] **Step 3:** Run the extended browser checks before editing message composition.

Run: `npm run test:web -- messages.spec.ts today.spec.ts navigation.spec.ts`.

- [ ] **Step 4:** Refine message density, timestamp spacing, note surfaces, and composer placement.

Keep message width at most 80%. Keep drafts, failed sends, retry IDs, and existing text behavior.

Keep route styles available on direct loads. Keep captions and notes readable with long multiline text.

- [ ] **Step 5:** Rerun Step 3 and the native MessagesScreen test.

Run: `npm run test:mobile -- --runTestsByPath src/features/messages/screens/MessagesScreen.test.tsx`.

Expected: sender checks, direct-route presentation, draft retention, and delivery states pass.

- [ ] **Step 6:** Perform importance-95 Android/iOS keyboard and large-text checks on available development builds.

Enter multiline text, set system text to 200%, and open the keyboard. Reach Message, Send, and the final form field.

Check native Back, safe areas, and screen reader labels. Mark unavailable device checks as unverified with their reason.

- [ ] **Step 7:** Commit reviewed messaging files as `style: refine conversation and pinned notes`.

### Task 7: Final evidence and documentation

**Files:**

- Modify: `apps/web/tests/screenshot-coverage.spec.ts` and `screenshot-cleanup.spec.ts`.
- Modify: `STYLE.md` and `docs/README.md` with verified implementation and evidence links.
- Create: `docs/design/frontend-2026-10-07/web/index.html`, `README.md`, `coverage.json`, and generated `images/*.jpg`.
- Create: `docs/design/frontend-2026-10-07/native/README.md` and available device captures.
- Create: `docs/handoffs/frontend-design.md`.
- Review all modified product files and the existing route manifest; retain its 39 routes and 119 views.

**Interfaces:**

- Consume the existing route manifest, screenshot scenarios, fixture journals, and capture record type.
- Produce a new gallery with 238 viewport records and actual JPEG bytes for each referenced image.
- Produce a handoff with source revision, command results, screen coverage, and explicit device-check status.

- [ ] **Step 1:** Update capture destinations to `docs/design/frontend-2026-10-07/web` and `.superpowers/frontend-design/capture`.

Update the cleanup suite to use that same scratch directory. Keep the existing recorded fixture display date of 5 October.

Record actual capture time and tested source revision in gallery metadata. Keep the earlier `docs/design/web-portal` gallery unchanged.

- [ ] **Step 2:** Prepare the existing local stack using the current development guide. Preserve its populated data.

Use `npm run start:backend` only if needed. Select Test mode for one owned Edge process before browser checks.

Keep browser test and race harness execution separate. Do not reset data or start competing origin modes.

- [ ] **Step 3:** Generate the fresh full gallery on final source.

```powershell
$env:DESEO_CAPTURE = '1'
npm run test:web -- screenshot-coverage.spec.ts screenshot-cleanup.spec.ts
Remove-Item Env:DESEO_CAPTURE
```

Run without capture filters or resume for the first full capture. Expect 238 records covering both viewport sizes.

- [ ] **Step 4:** Inspect all gallery views and the five browser widths. Check long text, 200% text, keyboard, and dialogs.

Use the existing importance-92 layout suite. Record each route/view review, including unchanged screens.

Record native screen coverage, keyboard tests, VoiceOver/TalkBack checks, and device screenshots where available.

- [ ] **Step 5:** Run the required final source and browser checks.

```powershell
npm run verify:mobile
npm run test:domain
npm run verify:web
npm exec --workspace @deseo/mobile -- expo export --platform android --platform ios --output-dir dist
```

Expected: commands exit zero, no failed assertions, a complete decoded gallery, and successful Android/iOS JavaScript exports.

Preserve failure logs. Resolve frontend regressions and rerun the affected checks before the final full verification.

- [ ] **Step 6:** Update documentation and the handoff from measured results.

Record commit, environment, command, result, browser widths, and coverage. Separate native exports from physical-device acceptance.

Keep historical evidence links. Make the new gallery the current design reference. Review changed copy with stop-slop.

- [ ] **Step 7:** Check the final diff and commit reviewed evidence as `docs: record frontend design verification`.

Run `git diff --check`. Review changed files against the approved spec and this plan.

## Plan self-review

The seven tasks cover the spec's six delivery layers and final evidence. Task 5 and Task 6 split the personal-content layer.

Each task preserves platform feature interfaces. The plan adds no product dependencies or shared UI abstraction.

The five review-focus conditions have named behavior checks or device checks. Decorative snapshots remain outside automated test work.

Implementation starts after owner review and execution choice. Recommended choice: Native, because the tasks share controls and feature styles.
