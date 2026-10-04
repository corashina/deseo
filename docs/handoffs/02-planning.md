# Chat 02: Shared planning

## Identity

- Scope: shared lists, tasks, important dates, and saved date ideas; master Tasks 6–7.
- Branch: `codex/deseo-02-planning`.
- Worktree: `C:\Users\Corashina\Documents\Projects\deseo\.worktrees\deseo-02-planning`.
- Base: `7564cd0e13bfa9df492603f5e1f6a0919aeddfcf`.
- Core code: `118fdf553ed3c37ffe2ff01a9cf2b68e2de08485`.
- Tested code commit, source checks only: `97684cd04f6d215c77b0b19bb2bf9cc178b85342`.
- Integration branch: `codex/deseo-integration`; this branch remains separate.

The base adds core handoff documents without product changes. Git created the worktree after the app tool failed.
The primary checkout advanced separately to `master` at `d66b9d2bed0f92f6f7c2165d3b980276a1327463` during this work.
This branch retains its recorded base. Chat 05 must confirm the integration target before merging.

## Status

- Code status: **In progress**. Required database checks remain unrun.
- Device status: **Pending**, Android and iOS.
- Release status: **Blocked** by backend and device acceptance.

The owner requested source implementation without Docker on 2026-10-04.
This permits coding before the core security gate clears. It does not approve database behavior or integration.
The verification gaps in [01-core.md](01-core.md) remain open.

## Implemented behavior

Tasks support lists, quick add, assignment, optional due dates, details, edits, deletion, completion, and Undo.
Completed tasks form a collapsed group. Failed changes restore confirmed state and provide Retry.
Conflict review keeps both local and saved values encrypted, including after remount.
Lists support create, versioned rename, explicit move to General, and empty-list deletion.
Rename conflicts preserve the entered name and opened version across restart, including uncertain retries.
The migration creates General for active pairs and protects its identity.
Missing-list screens can retry an uncertain delete without fabricated rows.

Calendar supports one-off important dates and yearly, one-day all-day dates.
The server expands yearly occurrences within a requested range of at most 366 days.
February 29 becomes February 28 in non-leap years. Edits change the stored series.
The Calendar shows a next-date countdown using the pair timezone.
Saved ideas support title, note, HTTPS link, edits, archive, and Plan date.
Plan date prefills a shared event. One transaction creates the event and marks the idea Planned.
Deleting its future event returns the idea to Saved. Archived ideas remain Archived.
Planning drafts preserve the source idea and version, including when a response is lost before restart.

Feature screens use the public pair gate. Queries keep fetched records in memory.
Drafts and uncertain actions use encrypted private storage. Retries retain IDs, expected versions, and submitted values.
Chat 05 owns the Tasks tab, Today sections, shared navigation, and reminders.

## Changed files

- `apps/mobile/src/features/tasks/**` and `apps/mobile/src/app/tasks/**`.
- `apps/mobile/src/features/calendar/**`, event routes, and idea routes.
- `supabase/migrations/20261004161300_tasks.sql`.
- `supabase/migrations/20261004161305_dates-and-ideas.sql`.
- `supabase/tests/tasks.test.sql`, `date-ideas.test.sql`, and `planning-races.test.ts`.
- `package.json`: the existing race command includes the planning harness.
- `apps/mobile/src/features/today/cache.test.ts`: three new screen boundary mocks; its cache assertion is unchanged.
- This handoff.

No dependency version or native configuration changed. The lockfile is unchanged.
Generated database types remain pending a real schema.
Root/tab layouts, Today product code, auth, pair, shared controls, and shared status documents are unchanged.

## Public interfaces

Import task APIs from `apps/mobile/src/features/tasks`.

| Export | Return or behavior |
|---|---|
| `listTaskLists(pairId)` | `Promise<TaskList[]>`; 50-row requests through the last page |
| `listTasks(pairId,listId)` | `Promise<Task[]>`; 50-row requests through the last page |
| `getTask(pairId,id)` | `Promise<Task\|null>` |
| `listDueTasks(pairId,date)` | `Promise<Task[]>`; up to three unfinished tasks due on or before the pair-local date |
| `createTask(input,commandId)` | `Promise<Result<Task>>` |
| `updateTask(id,input,expectedVersion,commandId)` | `Promise<Result<Task>>` |
| `setTaskCompleted(id,completed,expectedVersion,commandId)` | `Promise<Result<Task>>`; desired state, with version checks |
| `deleteTask(id,expectedVersion,commandId)` | `Promise<Result<{id:string}>>` |
| `createList(pairId,name,commandId)` | `Promise<Result<TaskList>>`; list ID equals command ID |
| `renameList(id,name,expectedVersion,commandId)` | `Promise<Result<TaskList>>`; stale names require conflict review |
| `moveListTasksToGeneral(id,commandId)` | `Promise<Result<{id:string;generalListId:string;moved:number}>>` |
| `deleteEmptyList(id,commandId)` | `Promise<Result<{id:string}>>` |

`TaskInput`: `id,pairId,listId,title,assigneeId:string|null,dueDate:string|null`.
`Task` adds `authorId,completedAt:string|null,completedBy:string|null,version`.
`TaskList`: `id,pairId,name,isGeneral,authorId:string|null,version`.

Screens: `TasksScreen()`, `TaskFormScreen({taskId?,listId?,quick?})`, `TaskDetailScreen({taskId})`, and `ListDetailScreen({listId})`.
Each screen includes the exported `TaskAccess` guard.
`TaskRow` and `TaskRowProps` expose the native checkbox row.
Validation exports: `taskInputSchema`, `taskDateSchema`, and `listNameSchema`.
`taskKeys.all` returns `['tasks',accountId,pairId]`; `.lists`, `.list`, `.task`, and `.due` add their scope.

Import calendar APIs from `apps/mobile/src/features/calendar`.
Existing event exports remain available: `CalendarScreen`, `EventDetailScreen`, `EventFormScreen`, `EventRow`, and `eventDateLabel`.
Existing queries and commands retain their signatures: `listAgenda`, `getEvent`, `createEvent`, `updateEvent`, and `deleteEvent`.
Existing validation, temporal, revocation, and type exports remain in `index.ts`.

| New export | Return or behavior |
|---|---|
| `listImportantDates(pairId,from,to)` | `Promise<AgendaItem[]>`; important dates from the server agenda |
| `importantDateCountdown(date,pairTimezone,now?)` | `number`; calendar-day difference; optional Luxon `DateTime` clock |
| `nextImportantDate(items,pairTimezone,now?)` | `AgendaItem\|undefined`; first upcoming all-day start, excluding past overlapping starts |
| `listDateIdeas(pairId,state?,cursor?)` | `Promise<Page<DateIdea>>`; state defaults to Saved; pages contain up to 50 items |
| `getDateIdea(pairId,id)` | `Promise<DateIdea\|null>` |
| `createIdea(input,commandId)` | `Promise<Result<DateIdea>>` |
| `updateIdea(id,input,expectedVersion,commandId)` | `Promise<Result<DateIdea>>` |
| `archiveIdea(id,expectedVersion,commandId)` | `Promise<Result<DateIdea>>` |
| `planDateIdea(ideaId,eventInput,expectedVersion,commandId)` | `Promise<Result<Event>>`; version belongs to the source idea |

`IdeaInput`: `id,pairId,title,note,link`. Optional note/link values are empty strings in the client.
`IdeaState`: `'saved'|'planned'|'archived'`.
`DateIdea` adds `authorId,state,linkedEventId:string|null,version,createdAt`.
`Page<T>` is the core `{items:T[];nextCursor:string|null}`. Pass the opaque cursor unchanged.
`ideaInputSchema` and `ideaKeys` are exported.
Idea list keys are `['calendar',accountId,pairId,'ideas',state]`; detail keys end with `'idea',id`.

New screens: `IdeaListScreen()`, `IdeaFormScreen({ideaId?})`, and `IdeaDetailScreen({ideaId})`.
`EventFormScreen` also accepts `ideaId` for planning.
`EventInput` and `EventFormValues` add optional `importantDate:boolean` and `repeat:'none'|'yearly'`.
Yearly events imply importance and require one-day all-day values.
Expanded rows retain the event ID. Their temporal fields show the occurrence; `seriesDate` retains the stored date.
Fetch `getEvent(pairId,id)` for detail and series edits. Keep occurrence dates distinct when rendering repeated rows.
`calendarKeys`, `agendaDates`, and the existing `AgendaItem`/`Event` types remain the integration contract.

All commands use the core `Result<T>` contract.
Feature errors include `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `CONFLICT`, and `RETRYABLE`.
Queries and storage use the core query scope to reject stale work after account or pair changes.
Do not generate a new command ID while retrying an uncertain result.

## Database and dependencies

Apply the four core migrations before these CLI-generated migrations:

1. `20261004161300_tasks.sql`.
2. `20261004161305_dates-and-ideas.sql`.

Tasks add `public.task_lists` and `public.tasks`.
Composite foreign keys prevent references across pairs. General has a system author; named lists have member authors.
Names are unique within each pair, without case sensitivity. General cannot be renamed or deleted through feature commands.
Commands use current access checks, `private.lock_pair`, versions, and the core receipt table.
Content tables grant authenticated SELECT access only. Mutations use narrow RPC wrappers.

| Task RPC | Parameters |
|---|---|
| `create_task` | `p_input jsonb,p_command_id uuid` |
| `update_task` | `p_task_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid` |
| `set_task_completed` | `p_task_id uuid,p_completed boolean,p_expected_version integer,p_command_id uuid` |
| `delete_task` | `p_task_id uuid,p_expected_version integer,p_command_id uuid` |
| `create_list` | `p_pair_id uuid,p_name text,p_command_id uuid` |
| `rename_list` | `p_list_id uuid,p_name text,p_expected_version integer,p_command_id uuid` |
| `move_list_tasks_to_general` | `p_list_id uuid,p_command_id uuid` |
| `delete_empty_list` | `p_list_id uuid,p_command_id uuid` |

Task input uses `id,pair_id,list_id,title,assignee_id,due_date`. Optional values use JSON null.
Task/list RPC results use database rows. Client schemas convert snake-case fields to exported types.
Private task signals use topic `tasks:<pair UUID>`, event `changed`, and payload `{}`.
The SELECT policy on `realtime.messages` checks current membership and topic.
Tasks and lists stay outside Postgres Changes. Mounted task screens share one channel.
Ordinary task changes do not bump profile versions or force auth reloads.

Calendar adds `important_date`, `repeat_month`, and `repeat_day` to `public.events`, plus `public.date_ideas`.
It replaces `list_agenda` and the private event command while preserving public event RPC signatures.
Ideas have composite author/event references, a unique event link, current-member RLS, and private mutation functions.
The plan command rejects foreign pairs, stale versions, private events, yearly plans, and reused event IDs.
Receipt replay rechecks current access and linked event existence.
Deleting a past event clears the idea link while retaining Planned state.
A linked event cannot become Private while its shared idea link exists.

| Idea RPC | Parameters |
|---|---|
| `create_date_idea` | `p_input jsonb,p_command_id uuid` |
| `update_date_idea` | `p_idea_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid` |
| `archive_date_idea` | `p_idea_id uuid,p_expected_version integer,p_command_id uuid` |
| `plan_date_idea` | `p_idea_id uuid,p_event_input jsonb,p_expected_version integer,p_command_id uuid` |

Idea input uses `id,pair_id,title,note,link`. Plan input uses the existing event JSON plus repeat/importance fields.
Create/update/archive return an idea row; plan returns an event row. Clients convert them to exported types.
Idea signals use private topic `calendar:<pair UUID>`, event `changed`, and an empty payload.
The idea table stays outside Postgres Changes. Existing event publication and core subscribers remain unchanged.
Baseline limitation: event DELETE can expose an opaque record ID through Postgres Changes.
The core table keeps default replica identity; this branch does not enable full old-row payloads.

Local override: `.superpowers/local-backend/supabase/config.toml`; project ID `deseo-02-planning`.

| Service | Port |
|---|---:|
| Shadow database | 55320 |
| API | 55321 |
| Database | 55322 |
| Studio | 55323 |
| Mail UI | 55324 |
| Analytics | 55327 |
| Edge inspector | 55328 |
| Pooler, disabled | 55329 |

Ports `55320–55339` were free during preparation. Check again before starting Supabase.
Migrations, tests, functions, and templates use junctions to this worktree. The seed file was copied.
No stack, accounts, or keys were created. Do not commit the override or reset another chat's database.
Docker Desktop `4.93.0` and WSL `2.7.13.0` are installed.
Virtual Machine Platform setup requires a Windows restart. The engine remains unavailable.

## Verification

Environment: Windows 11 Education, x64; Node `24.18.0`, npm `11.16.0`, Supabase CLI `2.119.0`.
Package installation and rebuild passed using the repository lockfile.

| Check | Importance | Exact command or action | Actual result |
|---|---:|---|---|
| Mobile types | Required | `npm run typecheck` | Passed |
| Mobile lint | Required | `npm run lint`; scoped ESLint after fixes | Passed; all changed source and test files passed scoped ESLint |
| All mobile behavior | 93–100 | Full Jest command below | Passed: 25 suites, 105 tests, no test warnings |
| Calendar behavior | 95–100 | Jest with `--testPathPattern 'features/calendar'` | Initial 48 passed; the link fix passed two covering suites with 12 tests |
| Task behavior | 93–100 | Jest with `--testPathPattern 'features/tasks'` | Passed: 6 suites, 22 tests, including list rename recovery |
| Auth race harness types | 100 | Standalone TypeScript command below | Both harnesses passed |
| SQL syntax and assertion count | Supporting | Local pglast `7.9` via `.superpowers/sdd/2026-10-04-deseo-implementation/check-sql.py` | Parsed 200 migration statements, 36 PL/pgSQL functions, and 187 assertions |
| Real database assertions | 95–100 | Isolated `supabase test db --local` | Not run: 67 core, 67 task, and 53 idea assertions |
| Concurrent Auth and Realtime behavior | 100 | `npm run test:db:race` with local keys | Not run; Docker engine unavailable |
| Advisors and generated types | Required | Isolated commands below | Not run; database unavailable |
| Android/iOS JavaScript exports | Required | From `apps/mobile`: `npx expo export --platform android --platform ios --output-dir dist` | Passed: both bundles and 54 assets |
| Native routes, restart, and two-account changes | 93–100 | Android/iOS development builds on devices | Not run; no native build or device |

The final export removed `Env:NO_COLOR` and set `FORCE_COLOR=0` for that process. It produced no warnings.
JavaScript exports do not verify native storage or device behavior.
Initial combined Jest failed when new screen exports loaded MMKV through the Today cache test.
Three screen mocks fixed the test boundary. The full rerun passed without changing Today product code.
Task review also found conflict values stored only in memory. The fix now persists both versions through restart.
Yearly query parsing caught a reserved alias. The corrected query and all function bodies parse.
Calendar review added a shared server URL validator and both private-channel boundaries to the Auth harness.
Final review found stale list renames could overwrite newer names. The fix adds expected versions and durable conflict review.
New rename tests failed before the fix. The corrected client passed all task tests and the full mobile suite.
Scoped final review accepted the fix and found no new source defects.
Source review does not replace the pending database and native acceptance checks.

Jest's absolute pattern fails inside this hidden Windows worktree. Use the source-relative override:

```powershell
node node_modules/jest/bin/jest.js --config apps/mobile/jest.config.cjs --testMatch '**/src/**/*.test.ts' '**/src/**/*.test.tsx' --runInBand
```

Add `--testPathPattern 'features/tasks'` or `'features/calendar'` for focused checks.
The shared Jest configuration is unchanged.

```powershell
node_modules/.bin/tsc.cmd --noEmit --target es2022 --module esnext --moduleResolution bundler --types node --strict --skipLibCheck supabase/tests/pairing-races.test.ts supabase/tests/planning-races.test.ts
```

The planning harness uses real Auth accounts and separate clients when run.
It covers task/list conflicts, receipt replay, assignment, list moves, private channels, atomic planning, and access revocation.
A type check does not prove those behaviors. SQL parsing does not execute policies, constraints, triggers, or transactions.

## Integration instructions

1. Complete the Windows restart when convenient, then verify the Docker engine.
2. Check the isolated project ID and ports before starting Supabase.
3. Run core and planning database checks. Fix failures before using this branch as an integration baseline.
4. Generate types from the verified schema.
5. Integrate through Chat 05. Keep source and handoff commits together.
6. Wire `TasksScreen` into the Tasks tab. Supply the pair-local date to `listDueTasks` for Today.
7. Wire the calendar queries into Today. Add reminders in Chat 05.
8. Verify native routes, two-account updates, restart, offline drafts, conflict recovery, and revoked access.

CLI help was checked for these pending commands. Run from this worktree:

```powershell
node_modules/.bin/supabase.cmd start --workdir .superpowers/local-backend
node_modules/.bin/supabase.cmd db reset --local --workdir .superpowers/local-backend
node_modules/.bin/supabase.cmd test db --local --workdir .superpowers/local-backend
node_modules/.bin/supabase.cmd db advisors --local --type all --fail-on warn --workdir .superpowers/local-backend
node_modules/.bin/supabase.cmd gen types --local --schema public --workdir .superpowers/local-backend
```

Set `SUPABASE_TEST_URL=http://127.0.0.1:55321` for the race command.
Supply local `SUPABASE_TEST_PUBLISHABLE_KEY` and `SUPABASE_TEST_SERVICE_ROLE_KEY` without committing or printing their values.
Then run `npm run test:db:race`. It runs core and planning harnesses, with cleanup of their synthetic accounts and pairs.
Complete core OTP, session, and Realtime acceptance from [01-core.md](01-core.md).

Native task links use `deseo-dev://tasks`, `deseo-dev://tasks/new`, `deseo-dev://tasks/<taskId>`, and `deseo-dev://tasks/lists/<listId>`.
Idea routes: `/ideas`, `/ideas/new`, `/ideas/<ideaId>`, and `/ideas/<ideaId>/edit`.
Plan route: `/events/new?ideaId=<ideaId>`. Existing event detail and edit routes remain available.
Use actual synthetic IDs. Do not add temporary navigation or fake data.

## Decisions and remaining work

- Continue source work without Docker, as requested. Backend failures can still require changes.
- Use the accepted design and Tasks 6–7. No new design gate was needed.
  Changes to that accepted scope require later design work.
- Use agents, as requested, despite the embedded inline-execution instruction.
  One implementer wrote each task; separate agents reviewed the changes.
- Keep tabs, Today, and reminders with Chat 05. Their integration remains incomplete here.
- Generate types only from a real schema; none were fabricated.
  Integration still requires schema generation and a type check.
- Use PowerShell after Git Bash plan helpers failed. Task briefs retain the original text.
- Use the Jest glob override. Reconcile the normal command during integration.
- Include one-off important dates because the screen spec makes yearly repeat optional.
  This adds one importance field and form control.
- Maintain three screen mocks in the Today cache test. This narrow test-only exception preserves the public API assertion.
- Add `expectedVersion` to list rename. The data and screen contracts require conflict checks for text edits.
  This corrects the three-argument signature in Task 6. Chat 05 must use the four-argument API.

The local review ledger remains available while required backend checks are pending.

Pending backend work: migrations, pgTAP, Auth races, Broadcast delivery, advisors, generated types, and core security acceptance.
Pending device work: Android/iOS routes, process termination/restart, large text, screen readers, keyboard, and Back behavior.
This branch is not ready for Chat 05 integration until required automated backend checks pass.
