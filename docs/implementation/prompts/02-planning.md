# Chat 02: Shared planning

**Master tasks:** 6–7. **Start:** After 01. **Parallel work:** 03 and 04.

**Output:** Shared lists, tasks, important dates, and saved date ideas.

## Materials

- [Execution and ownership guide](../CHAT_GUIDE.md).
- Read the future core report at `docs/handoffs/01-core.md`.
- [Master Tasks 6–7](../../superpowers/plans/2026-10-04-deseo-implementation.md#task-6-shared-lists-and-tasks).
- [Screens](../../product/SCREENS.md), sections 6–8.
- [Data contract](../../architecture/DATA.md), records, temporal fields, access, and content commands.
- [Calendar reference](../../design/mobile-calendar.jpg) and [style](../../../STYLE.md).
- [Development](../../engineering/DEVELOPMENT.md) and [testing](../../engineering/TESTING.md).

Needed materials: the core commit, its real exports, an isolated database, and synthetic pair accounts.

## Ownership and checks

Own the calendar and tasks modules, their routes, migrations, and tests.
Use the core's event commands, permissions, theme, and input controls.

Create General lists when pairs become active. Initialize lists for existing local pairs.
Protect General from rename and deletion.

Prove task conflicts, assignment rules, list deletion, leap dates, and atomic idea-to-event creation.
Verify both accounts receive confirmed changes after restart.

Export due-task and important-date queries for Today.
Chat 05 adds the Tasks tab, Today sections, and reminder controls.
Do not change shared layouts or Today in this branch.

**Handoff:** `docs/handoffs/02-planning.md`.

## Prompt

```text
Implement Chat 02, Shared planning, for Deseo.
Project: C:\Users\Corashina\Documents\Projects\deseo

Read AGENTS.md and docs/implementation/prompts/02-planning.md.
Read CHAT_GUIDE.md, its common materials, and docs/handoffs/01-core.md.
Use the saved design and master Tasks 6–7 as this chat's accepted scope.
Use superpowers:executing-plans inline. Do not create other chats or agents.

Verify the core baseline and recorded checks before coding.
Create or reuse an isolated Git worktree from that exact baseline.
Use branch codex/deseo-02-planning unless an existing assigned branch already serves this work.
Perform all product edits in that worktree.
Use a separate local Supabase project and available ports, following CHAT_GUIDE.md.
Inspect existing exports and dependencies. Apply the Supabase skill to backend work.

Implement shared lists, tasks, assignment, due dates, completion, Undo, and safe list deletion.
Add General-list creation when pairs become active. Initialize existing local pairs once.
Implement yearly important dates, the leap-date rule, saved ideas, and atomic Plan date behavior.
Reuse the calendar's event and temporal contracts.

Own only calendar/tasks modules, feature routes, migrations, tests, and your handoff.
Use the documented dependency and generated-type exceptions only when required.
Do not edit shared layouts, Today, core contracts, shared UI, or other feature modules.
Export tested screens and queries for Chat 05.
Test feature routes through native deep links without temporary navigation or fake data.
Document tab, Today, and reminder integration as deferred work for Chat 05.

Rate tests before writing them. Implement only tests rated at least 90.
Run relevant database, concurrency, temporal, native, and type checks.
Record actual results and unavailable device checks separately.
Do not edit shared status documents or master task checkboxes in this parallel branch.

Commit tested code, then write docs/handoffs/02-planning.md using the handoff template.
Include exact exports, migrations, local ports, dependency changes, and integration instructions.
Commit the report separately. Report the final branch tip.
Leave this branch for Chat 05 to integrate. Do not merge other feature branches.
Do not provision remote services, deploy, submit builds, or contact real users.
```
