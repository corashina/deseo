# Deseo Web Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React web portal, retain Expo mobile behavior, create a local test pair, and show each product page.

**Architecture:** Separate browser and native interfaces share domain contracts and one Supabase backend. Each application owns its session, query lifecycle, navigation, and media preparation. Feature modules call existing authenticated tables, transactions, and Edge functions.

**Tech Stack:** React, TypeScript, Vite, React Router data mode, TanStack Query, React Hook Form, Zod, Luxon, Supabase, Expo, Playwright.

**Spec:** [Approved design](../specs/2026-10-05-deseo-web-portal-design.md).

## Global Constraints

- Keep the Expo application for Android and iOS.
- Use separate React web screens with shared rules and data.
- Keep Deseo's approved pastel colors and Two voices icon.
- Use Cupla and Couply for feature structure, visual hierarchy, spacing, and card proportions where they fit Deseo.
- Use ChatGPT's sidebar and content layout as a reference.
- Use a 256px expanded sidebar, 72px collapsed rail, and header at least 72px high.
- Use desktop padding 32px, tablet padding 24px, and narrow padding 16px.
- Cap content at 1440px, forms at 720px, and messages at 960px.
- Use card padding 24px desktop and 20px narrow; card gaps 24px desktop and 16px narrow.
- Use 20px card corners, 12px control corners, 16px body text, and 48px navigation targets.
- Use a persistent sidebar from 1024px, a rail from 768px, and a drawer below 768px.
- Keep shared rows, private images, and unsent drafts in memory.
- Keep authentication tokens in Supabase's supported browser session storage.
- Use None, 15 minutes, one hour, or one day before. Keep all-day reminders at 09:00 in the event timezone.
- Remove obsolete copies and paths. Do not add compatibility exports or fixture fallbacks.
- Add only tests scoring at least 90. State each rating before writing the test.
- Use the required stop-slop skill for interface text and documentation. Keep instructions within 20 words.
- Capture product pages at 1440×1000 and 390×844. Check layouts at 320px, 768px, and 1024px.
- Do not add browser push, a service worker, offline content storage, or an installation prompt.
- Keep public-site delivery, avatar backend work, account export, and account deletion outside this portal scope.

Use Node 24.18.0, npm 11.16.0, and the root lockfile. Preserve existing exact dependency pins.
Verify new versions through package metadata and official documentation before installing them.

## Review Focus

1. A late response after sign-out or pair closure must not restore private content. Task 3 owns the test.
2. A daylight-saving gap or repeated hour must require a valid, explicit event time. Task 4 owns the test.
3. A timeout after server acceptance must not duplicate a message, event, or photo. Tasks 4, 6, and 7 own tests.
4. Large text and long names must fit the rail, drawer, calendar, and forms. Tasks 3 and 10 own tests.
5. An expired photo link or revoked upload must not expose content or discard editable input. Task 7 owns tests.

## Execution contract

The owner approved the design. The implementation plan still needs owner review and an execution choice.
Do not start product implementation before that review.

Recommend native execution with one independent branch review at the end.
The tasks share session, route, and data interfaces; serial execution limits integration overhead.
Use subagent-driven execution if the owner prefers a reviewer after each task.

## File and responsibility map

| Path | Responsibility |
|---|---|
| `apps/web/src/app/router.tsx` | Registered browser routes and feature boundaries |
| `apps/web/src/app/route-manifest.ts` | Route IDs, route patterns, screenshot coverage requirements |
| `apps/web/src/app/SessionProvider.tsx` | Verified account and pair state, account transition cleanup |
| `apps/web/src/app/AppShell.tsx` | Sidebar, rail, drawer, header, account menu, content region |
| `apps/web/src/lib/supabase.ts` | One browser client; public configuration validation |
| `apps/web/src/lib/query-client.ts` | Cache scope, cancellation, browser focus and network lifecycle |
| `apps/web/src/lib/drafts.ts` | Account-scoped, in-memory drafts and unsaved-input protection |
| `apps/web/src/features/<feature>/index.ts` | Feature public interface |
| `apps/web/src/features/<feature>/queries.ts` | Authorized reads and query keys |
| `apps/web/src/features/<feature>/commands.ts` | Validation, UUID reuse, version checks, targeted invalidation |
| `apps/web/src/features/<feature>/pages/` | Browser feature screens |
| `apps/web/src/components/ui/` | Accessible browser controls without backend access |
| `apps/web/src/styles/` | CSS token mapping, shell layout, shared control styles |
| `packages/domain/src/<feature>/` | Shared schemas, types, pure payloads and date rules |
| `packages/domain/src/result.ts` | Current result envelope, error types and conversion |
| `supabase/dev/prepare-web-stack.ps1` | Dedicated disposable local stack configuration |
| `supabase/dev/seed-web-pair.ts` | Named synthetic accounts and idempotent sample content |
| `supabase/dev/web-fixtures.ts` | Stable record IDs and fixture content |
| `supabase/functions/_shared/browser-origin.ts` | Explicit browser origin and preflight handling |
| `apps/web/tests/` | Real two-user flows, browser failures, route and screenshot coverage |
| `docs/design/web-portal/` | Product screenshot gallery, route index, evidence record |

Keep platform-specific drafts, media objects, device registration, and native lifecycle code inside their applications.
Create feature files when that task starts. Do not scaffold empty feature packages.

## Common commands and interfaces

Task 1 adds `npm run dev:web`, `npm run build:web`, `npm run test:web`, and `npm run verify:web`.
`verify:web` runs browser typecheck, scoped lint, production build, and implemented acceptance tests.
Task 2 adds `npm run test:domain`. Task 4 adds `npm run seed:web`.

Use `npm run test:web -- <file>` for a focused browser suite.
Use `npm run test:mobile -- <file>` for existing native suites.
All verification commands run from the execution worktree root unless stated otherwise.

Browser test support exposes:

```ts
type FixtureIds = {
  annaId: string; marekId: string; pairId: string;
  sharedEventId: string; privateEventId: string; ideaId: string;
  generalListId: string; groceriesListId: string; taskId: string;
  annaMessageId: string; marekMessageId: string; memoryId: string;
};
```

`loginWithLocalEmailCode(page: Page, email: string): Promise<void>` uses the real sign-in UI and local mail inbox.
Task 3's `createEntryFixture(state: 'unpaired'|'pending'|'active')` returns `{ accountIds: string[]; email: string; pairId: string|null; inviteToken: string|null }`.
`cleanupEntryFixture(fixture)` removes only those named disposable accounts and their pair.
Define these helpers in `apps/web/tests/support/entry-fixtures.ts`; they need no calendar, task, or memory records.
Task 4 defines the full content fixture helpers below.
`createPortalPairFixture(): Promise<FixtureIds>` creates an isolated test pair through local Auth and pairing commands.
`cleanupPortalPairFixture(ids: FixtureIds): Promise<void>` removes only that disposable test fixture.
Define `FixtureIds` in `supabase/dev/web-fixtures.ts`. Test support imports that type; seed code does not import application tests.
These functions live in `apps/web/tests/support/local-auth.ts` and `apps/web/tests/support/fixtures.ts`.
Their server credentials stay in the test process. No test helper enters the browser bundle.

## Task 1: Isolated baseline and reproducible local tooling

**Files:**
- Create: `supabase/dev/prepare-web-stack.ps1`.
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/playwright.config.ts`.
- Modify: `package.json`, `package-lock.json`, `eslint.config.mjs`, `docs/engineering/DEVELOPMENT.md`.
- Integrate: reviewed missing changes from commits `fa5ac67` and `03d7fd4` only.
- Verify: existing mobile, SQL, and race suites; `supabase/tests/reminder-offsets.test.sql`.

**Interfaces:**
- Consumes: approved design, primary checkout commit `c87430b`, existing integration correction commits.
- Produces: isolated `codex/deseo-web-portal` branch; working native baseline; dedicated local backend and web commands.

- [ ] Read the worktree skill. Inspect attached worktrees and current changes before creating a checkout.
- [ ] Create or reuse an isolated worktree from the approved design and plan commits. Preserve other checkouts.
- [ ] Review `git show fa5ac67` and `git show 03d7fd4`. Integrate only their missing reminder and core backend corrections.
- [ ] Run `npm ci` and `npm run verify:mobile`. Record failures before changing shared code.
- [ ] Discover the installed Supabase CLI commands with `--help`. Check current Supabase documentation before backend changes.
- [ ] Prepare `deseo-web` in `.superpowers/web-backend`, using ports 55720–55729 and inspector port 55728.
- [ ] Check listeners and container identity. Refuse to reset any stack outside the new disposable `deseo-web` project.
- [ ] Start and replay that stack. Run local SQL and race suites against `http://127.0.0.1:55721`.
- [ ] Verify that zero-minute reminders fail and 15, 60, and 1440-minute reminders pass. Existing test importance: 100.
- [ ] Pin web tooling versions. Reuse installed React 19.2.3, forms, query, validation, date, and Supabase versions.
- [ ] Configure development port 5174 and production preview port 4174 with strict port checks and loopback binding.
- [ ] Configure Playwright projects at 1440×1000 and 390×844. Keep credentials and Auth state files in ignored paths.
- [ ] Run `npm run typecheck` and `npm run lint`. Confirm existing native behavior still passes.
- [ ] Commit only baseline and local tooling files with `chore: prepare isolated web portal baseline`.

## Task 2: Shared contracts without native regression

**Files:**
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/result.ts`.
- Create: `packages/domain/src/auth/{schema,types,index}.ts`, `packages/domain/src/pair/{schema,types,index}.ts`.
- Create: `packages/domain/src/calendar/{schema,types,payload,ideas,dates,index}.ts`.
- Create: `packages/domain/src/tasks/{schema,types,payload,index}.ts`.
- Create: `packages/domain/src/messages/{schema,types,index}.ts`.
- Create: `packages/domain/src/memories/{schema,types,index}.ts`, `packages/domain/src/notifications/{schema,types,index}.ts`.
- Modify: root workspaces, both application packages, native imports, native feature public interfaces, Jest workspace transform settings.
- Remove: moved native contract files and duplicate contract definitions; retain native-only draft and device definitions.
- Test: `packages/domain/tests/contracts.test.ts`; existing native calendar, task, message, memory, and reminder suites.

**Interfaces:**
- Consumes: current native public types and schemas after Task 1's reminder correction.
- Produces: `@deseo/domain/result`, `/auth`, `/pair`, `/calendar`, `/tasks`, `/messages`, `/memories`, `/notifications` exports.
- Preserve existing names such as `Account`, `PairContext`, `EventInput`, `EventFormValues`, `TaskInput`, `Message`, `Memory`, and `NotificationPreferences`.
- Preserve `toEventInput`, `eventToForm`, `resolveWallTime`, message cursor encoding, result conversion, and row-schema transformations.
- Add `eventPayload(input: EventInput)` and `taskPayload(input: TaskInput)` with existing database field names.
- Move pure date-idea schemas and countdown rules; leave queries and commands in application features.

- [ ] Rate the contract test 97. Assert round trips preserve all-day dates, message UUIDs, row authorship, and supported reminder offsets.

```ts
test('advance reminder contract rejects the obsolete zero offset', () => {
  const choice = preferencesSchema.shape.defaultEventReminderMinutes;
  expect(choice.safeParse(0).success).toBe(false);
  for (const value of [null, 15, 60, 1440]) expect(choice.safeParse(value).success).toBe(true);
});
```

- [ ] Run `npm run test:domain`. Confirm the new shared imports fail before extraction.
- [ ] Extract contracts and payloads. Keep native draft/device schemas local when the browser does not consume them.
- [ ] Update both application consumers and tests to shared imports. Do not leave compatibility modules at old paths.
- [ ] Add lint import rules that reject Expo, React Native, MMKV, browser globals, and application imports inside domain code.
- [ ] Run domain tests and `npm run verify:mobile`. Confirm the complete existing native suite passes after extraction.
- [ ] Export Android and iOS JavaScript bundles from `apps/mobile`; confirm workspace resolution succeeds for both platforms.
- [ ] Commit with `refactor: share portal and mobile domain contracts`.

## Task 3: Verified browser entry and portal shell

**Files:**
- Create: `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/app/{router,SessionProvider,AppShell}.tsx`.
- Create: `apps/web/src/app/route-manifest.ts`, `apps/web/src/lib/{supabase,query-client,drafts}.ts`.
- Create: `apps/web/src/features/auth/{queries,commands,index}.ts`, `apps/web/src/features/auth/pages/{WelcomePage,EmailPage,VerifyPage,ProfilePage}.tsx`.
- Create: `apps/web/src/features/pair/{queries,commands,index}.ts`, `apps/web/src/features/pair/pages/{StartPage,InvitePage,JoinPage,WaitingPage,WelcomePage,EndedPage}.tsx`.
- Create: `apps/web/src/components/ui/{Button,Field,Status,Avatar,Dialog,PageHeader}.tsx`.
- Create: `apps/web/src/styles/{tokens,base,shell,controls}.css`, `apps/web/.env.example`.
- Test: `apps/web/tests/{entry,session-isolation,shell}.spec.ts`, `apps/web/tests/support/{local-auth,entry-fixtures}.ts`.

**Interfaces:**
- `getSupabase(): SupabaseClient` validates `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; missing configuration shows an error.
- `captureQueryScope(): { signal: AbortSignal; assertCurrent(): void }`; `resetPrivateQueries(): Promise<void>`.
- `useSession(): { status: 'loading'|'signedOut'|'authenticated'|'error'; account: Account|null; pair: PairContext|null; revalidate(): Promise<void> }`.
- `requestEmailCode(email: string): Promise<Result<{ retryAt: string }>>`; `verifyEmailCode(email: string, code: string): Promise<Result<{ userId: string }>>`.
- `saveProfile(input: ProfileInput, expectedVersion?: number): Promise<Result<Account>>`.
- Pair commands keep the native signatures for create, invite, preview, accept, cancel, and end transactions.
- `useUnsavedChanges(dirty: boolean): void` protects browser route changes and reload; drafts stay in account-scoped memory.
- `RouteCoverage` contains `{ id, path, fixture: 'signedOut'|'unpaired'|'pending'|'active'|'ended', views: string[] }`.
- Export `routeManifest: readonly RouteCoverage[]`. Each registered route has one stable coverage ID.

- [ ] Rate entry tests 100, session isolation 100, and shell accessibility 93.
- [ ] Add failing tests for email-code entry, invitation preservation through sign-in, malformed code, expired code, and pair state gates.
- [ ] Add a delayed-response test: sign out before `get_pair_context` resolves; assert the new screen contains no prior partner identity.
- [ ] Add `disabled account cannot restore a cached session`: keep the old JWT, disable the disposable account, and reload.
  Assert entry shows no shared content and backend protected reads fail. Test importance: 100.
- [ ] Add keyboard tests for drawer focus, Escape, account menu focus restoration, and active navigation at 390px, 768px, and 1440px.
- [ ] Run the three focused suites. Confirm failures identify missing browser behavior.
- [ ] Implement the client, verified session gate, request cancellation, memory drafts, and pairing pages using existing backend contracts.
- [ ] Map brand JSON tokens into CSS. Use the approved shell dimensions, outline icon family, and paired identity.
- [ ] Use React Router data mode for browser history and unsaved-form blockers. Register only implemented routes.
- [ ] Set each route's page title. Scrub invitation query data from logging and use no-referrer behavior.
- [ ] Run entry, isolation, shell, typecheck, lint, and build checks. Confirm refresh validates account status before displaying shared content.
- [ ] Commit with `feat: add verified portal entry and desktop shell`.

## Task 4: Real local pair and complete browser calendar

**Files:**
- Create: `supabase/dev/{web-fixtures,seed-web-pair}.ts`, `supabase/dev/assets/{sample-walk,sample-dinner}.jpg`.
- Create: `apps/web/src/features/calendar/{queries,commands,index}.ts`.
- Create: `apps/web/src/features/calendar/pages/{CalendarPage,EventDetailPage,EventFormPage}.tsx`.
- Create: `apps/web/src/features/calendar/components/{MonthGrid,Agenda,PartnerDayView,EventRow,EventFields}.tsx`.
- Create: `apps/web/tests/support/fixtures.ts`, `apps/web/tests/{calendar,fixture-safety}.spec.ts`.
- Modify: root seed script and route manifest.

**Interfaces:**
- `seedWebPair(): Promise<FixtureIds>` creates or reuses `anna@deseo.example.test` and `marek@deseo.example.test`.
- Export fixed fixture UUIDs and a fixed screenshot date from `web-fixtures.ts`; use Europe/Warsaw and English.
- `listAgenda(range: AgendaRange): Promise<AgendaItem[]>`; `getEvent(pairId: string, id: string): Promise<Event|null>`.
- `createEvent(input: EventInput, commandId: string): Promise<Result<Event>>`.
- `updateEvent(id: string, input: EventInput, expectedVersion: number, commandId: string): Promise<Result<Event>>`.
- `deleteEvent(id: string, expectedVersion: number, commandId: string): Promise<Result<{ id: string }>>`.
- Calendar views use `/calendar?view=month`, `?view=agenda`, and `?view=compare` with explicit date and owner filters.

- [ ] Rate paired calendar tests 98, privacy tests 100, timezone tests 96, and fixture safety tests 100.
- [ ] Test a shared event saved by Anna and read by Marek after refresh. Test that Marek cannot read Anna's private event.
- [ ] Test a replayed command UUID creates one event and a stale edit preserves the draft with a conflict message.
- [ ] Test Warsaw's missing spring hour and repeated autumn hour using shared `wallTimeChoices` and explicit offsets.

```ts
test('Warsaw daylight-saving input requires a valid explicit time', () => {
  expect(wallTimeChoices('2026-03-29', '02:30', 'Europe/Warsaw')).toHaveLength(0);
  expect(wallTimeChoices('2026-10-25', '02:30', 'Europe/Warsaw')).toHaveLength(2);
  expect(() => resolveWallTime('2026-10-25', '02:30', 'Europe/Warsaw')).toThrow();
});
```

- [ ] Test all-day end dates and multi-day overlap across month, agenda, and comparison views.
- [ ] Test fixture setup rejects hosted backend URLs and preserves unrelated users and content on repeat runs.
- [ ] Run focused tests. Confirm failures before implementing calendar routes and fixtures.
- [ ] Create local Auth accounts using the server-side Admin API. Obtain fixture sessions in the seed process through supported local Auth APIs.
- [ ] Create profiles, invites, active membership, and initial events through normal commands. Reuse stable UUIDs and resolve existing fixture records.
- [ ] Print fixture identifiers and mail-inbox sign-in instructions. Keep keys, codes, and tokens out of terminal output and committed files.
- [ ] Implement calendar toolbar, owner filters, month grid, agenda, partner columns, full-page create/edit, and details.
- [ ] Expose detail, edit, and delete actions with permission and version checks. Preserve command IDs after uncertain responses.
- [ ] Run `npm run seed:web`, paired calendar tests, mobile checks, and portal build. Verify the named pair remains usable.
- [ ] Commit with `feat: add paired portal calendar and local test users`.

## Task 5: Tasks, lists, date ideas, and initial Today

**Files:**
- Create: `apps/web/src/features/tasks/{queries,commands,index}.ts`, `pages/{TasksPage,TaskDetailPage,TaskFormPage,ListManagerPage,ListDetailPage}.tsx`.
- Create: `apps/web/src/features/calendar/ideas/{queries,commands,index}.ts`, `pages/{IdeasPage,IdeaDetailPage,IdeaFormPage}.tsx`.
- Create: `apps/web/src/features/today/{queries,index}.ts`, `apps/web/src/features/today/pages/TodayPage.tsx`.
- Create: `apps/web/src/features/tasks/components/TaskRow.tsx`.
- Test: `apps/web/tests/{tasks,ideas,today}.spec.ts`.
- Modify: fixture content and route manifest.

**Interfaces:**
- Preserve native task query and command names and signatures, including explicit `setTaskCompleted(id, completed, expectedVersion, commandId)`.
- Preserve `createList`, `renameList`, `moveListTasksToGeneral`, and `deleteEmptyList` command results.
- Preserve `listDateIdeas(pairId, state?, cursor?)`, `getDateIdea(pairId, id)`, `createIdea`, `updateIdea`, `archiveIdea`, and `planDateIdea` signatures.
- `getToday(pairId: string, date: string)` composes public calendar/task queries. Add personal content in Tasks 6 and 7.

- [ ] Rate completion/conflict tests 98, list integrity tests 98, date-idea tests 98, and Today composition tests 92.
- [ ] Test cross-user completion, failed-write rollback, Undo, assignment, due dates, and a stale title edit.
- [ ] Test General cannot be removed or renamed. Moving tasks to General must finish before removing a nonempty list.
- [ ] Test Plan date creates one shared event linked to its idea, and deleting that future event returns the idea to Saved.
- [ ] Test Today shows at most three upcoming events and three unfinished due tasks in the pair timezone.
- [ ] Run focused tests. Confirm failures before adding these feature pages.
- [ ] Implement named lists, compact task rows, quick add, detail/edit forms, confirmation dialogs, and list management.
- [ ] Implement saved/planned/archived idea views and full-page forms. Validate HTTPS links with the shared schema.
- [ ] Implement Today with planning first and the important-date countdown. Omit empty personal cards until real content exists.
- [ ] Extend seed content with General/Groceries, assigned/unassigned/completed tasks, a yearly date, and two ideas.
- [ ] Run focused acceptance suites, portal verification, and relevant native tests.
- [ ] Commit with `feat: add portal tasks date ideas and Today`.

## Task 6: Conversation, pinned notes, and send recovery

**Files:**
- Create: `apps/web/src/features/messages/{queries,commands,notes,index}.ts`.
- Create: `apps/web/src/features/messages/pages/MessagesPage.tsx`, `components/{MessageRow,Composer,NoteCard}.tsx`.
- Create: `apps/web/src/features/messages/pending-sends.ts`.
- Test: `apps/web/tests/messages.spec.ts`.
- Modify: Today composition, unread sidebar badge, route manifest, fixture messages.

**Interfaces:**
- Preserve `listMessages(pairId, before?): Promise<Page<Message>>` and `getUnreadCount(pairId): Promise<number>`.
- `sendMessage(input: SendMessageInput): Promise<Result<Message>>`; `reconcileMessageSends(pairId, clientIds)` uses existing durable reconciliation.
- Preserve `deleteMessage`, `setReadCursor`, `pinMessage`, `unpinMessage`, and note queries.
- `/messages?view=notes` selects pinned notes; `/messages` selects the conversation.

- [ ] Rate message delivery and recovery tests 98; draft tests 95; author permission tests 100.
- [ ] Test Anna sends, Marek reads, both notes appear, and each person can pin or delete only their own messages.
- [ ] Simulate a lost accepted-send response. Retry the same client UUID and assert one durable message appears.
- [ ] Test failed text remains in the composer or pending-send row. Sign-out clears it before another account opens Messages.
- [ ] Test pagination beyond 50 messages and new messages while the reader views older content. Do not force scrolling.
- [ ] Run the message suite and confirm failures before implementation.
- [ ] Implement sender labels, stable colors, timestamps, unread counts, note cards, and a composer within the 960px content area.
- [ ] Keep read cursors private. Add no typing, online-status, or partner read-receipt indicators.
- [ ] Reconcile uncertain sends before retry. Use browser visibility and authenticated reads after Realtime invalidation.
- [ ] Add both sample messages and pins to the seed. Compose the newest note into Today.
- [ ] Run message acceptance, portal verification, and native message suites.
- [ ] Commit with `feat: add portal conversation and pinned notes`.

## Task 7: Private browser memories and photo upload

**Files:**
- Create: `apps/web/src/features/memories/{queries,commands,prepare,media,index}.ts`.
- Create: `apps/web/src/features/memories/pages/{MemoriesPage,MemoryDetailPage,MemoryFormPage}.tsx`.
- Create: `apps/web/src/features/memories/components/{MemoryCard,MemoryImage,PhotoSelection}.tsx`.
- Create: `supabase/functions/_shared/browser-origin.ts`.
- Modify: existing browser-facing memory Edge handlers and their shared response helper.
- Test: `apps/web/tests/memories.spec.ts`, `supabase/functions/browser-origin.test.ts`.
- Modify: Today, fixture memory publication, route manifest.

**Interfaces:**
- `PreparedBrowserPhoto = { id: string; full: Blob; thumb: Blob; width: number; height: number; thumbWidth: number; thumbHeight: number }`.
- `preparePhoto(file: File, signal: AbortSignal): Promise<PreparedBrowserPhoto>` returns JPEGs with metadata removed.
- Use the current `MemoryReservationInput` envelope, adding browser bytes only at the application upload boundary.
- Preserve `reserveMemory`, `inspectMemory`, `finalizeMemory`, `updateMemory`, `deleteMemory`, `listMemories`, and `getMemoryMedia` results.
- `uploadMemoryPhoto(memory: Memory, photo: PreparedBrowserPhoto): Promise<Result<MemoryPhoto>>` includes verified session metadata.
- `browserOriginHeaders(request: Request): Headers` and `browserPreflight(request: Request): Response|null` use exact `WEB_APP_ORIGIN`.
- Native requests without Origin remain supported. Browser OPTIONS accepts only the configured origin and required request headers.

- [ ] Rate publication tests 98, access tests 100, media validation tests 96, and retry/input preservation tests 95.
- [ ] Test one-to-five images, 2560px full-image limit, 512px thumbnails, and 5 MiB per prepared file.
- [ ] Test caption/date preservation after failure, removed failed photo, and one publication after uncertain immutable upload.
- [ ] Test partner viewing and author-only editing. Revoke the pair during upload and assert publication fails.
- [ ] Test expired links refresh once, forbidden links show recovery, and sign-out removes image content and object URLs.
- [ ] Test allowed/unknown/null browser origins, preflight, native requests, and no-store media responses. Rate 100.
- [ ] Run browser and Edge tests. Confirm expected failures before implementing media and CORS handling.
- [ ] Decode supported image inputs using maintained browser image support. Re-encode JPEG through canvas to remove metadata.
- [ ] Limit dimensions and bytes; reject unsupported or oversized selections with a visible error. Dispose decoded images and object URLs.
- [ ] Upload through reservations with `upsert:false` and session metadata. Inspect after uncertainty and finalize only validated photos.
- [ ] Implement month feed, 3:2 cards, full-image details, author forms, copy download, and deletion confirmation.
- [ ] Publish two synthetic fixture memories through the real upload workflow. Add the newest memory to Today.
- [ ] Run browser memories, Edge validation, backend memory races, portal build, and native memory suites.
- [ ] Commit with `feat: add private portal memories and browser uploads`.

## Task 8: Notifications and scoped settings

**Files:**
- Create: `apps/web/src/features/notifications/{queries,commands,index}.ts`, `pages/{NotificationsPage,PreferencesPage}.tsx`.
- Create: `apps/web/src/features/notifications/components/ReminderControl.tsx`.
- Create: `apps/web/src/features/settings/pages/{SettingsPage,ProfileSettingsPage,PairSettingsPage,AccountSettingsPage}.tsx`.
- Modify: browser auth sensitive-action commands, pair end flow, router, manifest, existing sensitive-action Edge handler.
- Test: `apps/web/tests/{notifications,settings,pair-revocation}.spec.ts`.

**Interfaces:**
- Preserve notification preference, reminder, notification list, mark-read, and authorized destination contracts.
- Preserve `requestSensitiveActionCode('end_pair')`, `verifySensitiveAction('end_pair', code)`, and `endPair(pairId, proof, commandId)`.
- `signOut(scope: 'local'|'global'): Promise<void>` clears browser private state and uses supported Auth sign-out.
- Global sign-out also uses the existing revoke-all-devices command. Do not register a browser as an Expo device.
- Profile settings reuse `saveProfile(input, expectedVersion)`; account settings expose current sign-out controls.

- [ ] Rate reminder timing tests 96, settings access tests 100, and end-pair/revocation tests 100.
- [ ] Test current choices contain no zero offset. Test all-day scheduling uses 09:00 in the stored event timezone.
- [ ] Test preferences remain available while unpaired and after the pair ends. Profile edits preserve stored event instants.
- [ ] Test end-pair confirmation requires a fresh action code. Success clears both viewers' shared pages and blocks direct record links.
- [ ] Test local/global sign-out, expired sessions, revoked notification destinations, and source unavailable states.
- [ ] Run focused tests and confirm failure before implementing settings pages.
- [ ] Apply Task 7's browser-origin handling to sensitive-action verification. Keep codes and proofs in memory only.
- [ ] Implement notification list, viewer preferences, reminders, profile, pair identity, end-pair verification, and account controls.
- [ ] Keep account settings outside the active-pair gate. Show native push status as a native capability, without browser permission prompts.
- [ ] Run settings/notification browser tests, portal verification, relevant SQL access tests, and native reminder suites.
- [ ] Commit with `feat: add portal notifications and scoped settings`.

## Task 9: Route errors, navigation, and shared failure behavior

**Files:**
- Create: `apps/web/src/app/{RouteErrorPage,NotFoundPage}.tsx`.
- Modify: implemented routes, page headings, unsaved-change guards, feature errors and loading states.
- Test: `apps/web/tests/{navigation,failures,accessibility}.spec.ts`.

**Interfaces:**
- Router resolves only implemented pages. Record unavailable and forbidden records share a privacy-safe recovery view.
- Feature results keep shared `Result<T>` error codes. Forms retain editable values after validation, conflict, or request failure.

- [ ] Rate navigation tests 92, failure tests 95, and keyboard tests 93.
- [ ] Test direct detail URL reload, browser Back from edits, unknown route, invalid UUID, and an unauthorized record ID.
- [ ] Test offline submission is disabled without losing input and reconnect requires a deliberate retry.
- [ ] Test unsaved changes across sidebar navigation, route Back, reload, and account transitions.
- [ ] Test every confirmation dialog supports keyboard focus, Escape when safe, and focus restoration.
- [ ] Run focused tests. Correct missing states with shared controls and feature commands.
- [ ] Run portal verification. Confirm no production route depends on synthetic browser state or a test-only authentication shortcut.
- [ ] Commit with `fix: complete portal navigation and failure recovery`.

## Task 10: Visual verification and complete screenshot gallery

**Files:**
- Create: `apps/web/tests/support/screenshot-scenarios.ts`, `apps/web/tests/screenshot-coverage.spec.ts`.
- Create: `docs/design/web-portal/{README.md,index.html,coverage.json}` and product `.jpg` captures.
- Modify: feature CSS and layout components only where rendered review finds defects.

**Interfaces:**
- `ScreenshotScenario = { routeId: string; view: string; fixture: string; state: string; url: string }`.
- `ScreenshotRecord = ScreenshotScenario & { viewport: { width: number; height: number }; file: string }`.
- `coverage.json` maps every route-manifest entry and required subview to rendered desktop and narrow-browser images.
- Root redirect records identify their rendered destination. Do not count a redirect as an additional product page.

- [ ] Rate screenshot coverage tests 90 and responsive navigation/form overflow tests 92.
- [ ] Test each implemented route and subview has a declared screenshot scenario. Missing entries fail with route and view IDs.
- [ ] Assert every route/view record exists at widths 1440 and 390. Verify each referenced image file exists and has bytes.
- [ ] Test 320px, 390px, 768px, 1024px, and 1440px layouts with long names, long titles, and 200% text zoom.
- [ ] Run focused coverage and overflow tests. Fix missing scenarios and measured overflow before capture.
- [ ] Use browser tools to inspect the running portal against the approved layout and official Cupla/Couply references.
- [ ] Capture each main page, detail, create/edit form, settings page, and authentication/pairing page at both specified viewport sizes.
- [ ] Capture Calendar month/agenda/comparison, pinned notes, list management, named destructive confirmations, and representative failure states.
- [ ] Use real local fixtures for normal pages. Use isolated test fixtures and controlled request failures for failure states.
- [ ] Keep Anna and Marek active after capture. Use separate fixtures for ended, disabled, and unpaired states.
- [ ] Save full-page images for long forms. Record route, fixture, state, and viewport for each image.
- [ ] Build the gallery and Markdown index from coverage records. Show full-size images, labels, and links to each capture.
- [ ] Embed page images in the final report. Provide the gallery for the complete set; report any absent capture by route.
- [ ] Run the coverage test and `git diff --check`. Commit with `docs: add verified portal page screenshots`.

## Task 11: Final regression, documentation, and review

**Files:**
- Modify: `README.md`, `STYLE.md`, `docs/README.md`, `docs/architecture/{ARCHITECTURE,DATA}.md`.
- Modify: `docs/product/SCREENS.md`, `docs/engineering/{DEVELOPMENT,TESTING}.md`.
- Create: `docs/handoffs/web-portal.md` with commit IDs, test commands, results, screenshot coverage, and native limits.

**Interfaces:**
- Document React web plus Expo mobile, shared domain imports, supported browser storage, and exact local commands.
- Preserve the data access and lifecycle contract. Replace obsolete native-only product restrictions and outdated workspace statements.
- Document `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`, and server-only `WEB_APP_ORIGIN`.

- [ ] Read the verification-before-completion skill before reporting completion.
- [ ] Run `npm run verify:mobile`, `npm run test:domain`, and `npm run verify:web` on the final code.
- [ ] Run clean local backend replay, SQL tests, relevant race tests, and modified Edge checks on the dedicated disposable stack.
- [ ] Export both native JavaScript bundles after the final shared-code change. Record physical device checks separately.
- [ ] Run `git diff --check`. Check the web bundle for server keys, fixture tokens, compatibility paths, and native-only imports.
- [ ] Update documentation with measured results and working commands. Do not copy another branch's test totals as new evidence.
- [ ] Verify all screenshots resolve in the gallery and the named local pair can still sign in and save content.
- [ ] If native execution was selected, request one independent whole-branch review. Fix actionable findings and repeat affected checks.
- [ ] If subagent-driven execution was selected, complete its required task and whole-branch reviews.
- [ ] Commit with `docs: record portal verification and platform architecture`.
- [ ] Use the finishing-branch skill. Present integration choices with the screenshot gallery and remaining native device checks.

## Self-review result

The plan covers the approved platform choice, reference layout, product routes, shared rules, real sample pair, and screenshot delivery.
Tasks 3–9 cover authentication, access, retries, conflicts, and errors. Tasks 10–11 cover visual evidence and final regression.
The five Review Focus conditions each have an owning acceptance test.
Account export, account deletion, avatars, public pages, and browser push remain outside the approved portal scope.
No product implementation step has run while writing this plan.

## Documentation sources checked during planning

- [Vite guide](https://vite.dev/guide/): browser tooling and workspace file handling.
- [React Router data installation](https://reactrouter.com/start/data/installation): browser data router and history setup.
- [Supabase changelog](https://supabase.com/changelog): current changes; recheck affected APIs at execution.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots): deterministic viewport and visual verification practices.
