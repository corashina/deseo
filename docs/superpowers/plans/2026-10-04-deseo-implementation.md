# Deseo Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` inline. Follow the assigned [chat brief](../../implementation/CHAT_GUIDE.md) and its file ownership rules.

**Goal:** Deliver a private Android and iOS app for two people to plan, message, and keep memories.

**Architecture:** Expo feature modules use one Supabase backend. A separate static Astro site handles public pages and installation handoff. Database commands protect shared writes.

**Tech Stack:** Expo, TypeScript, Expo Router, TanStack Query, Supabase, PostgreSQL, Astro, native Expo modules.

**Spec:** [Product design](../specs/2026-10-04-deseo-design.md), [screens](../../product/SCREENS.md), [data](../../architecture/DATA.md), [architecture](../../architecture/ARCHITECTURE.md).

**Status:** Tasks 1–5 have core source and mobile checks. Backend and device acceptance remain pending.

The Chat 01 handoff records partial coverage. Unchecked acceptance items must pass before parallel work starts.

**Multi-chat execution:** Use the [eight-chat guide](../../implementation/CHAT_GUIDE.md) for order, prerequisites, materials, and prompts.

Chat briefs override execution order and shared-file ownership only. Product requirements and acceptance checks remain unchanged.

Chats 02–04 defer shared navigation and Today wiring to Chat 05. Their master tasks stay partial until integration passes.

## Global constraints

- The native app uses Expo and TypeScript for Android and iOS.
- Each account can join one active pair. Each pair has two people.
- Use the pastel palette and selected Two voices icon in STYLE.md.
- Use English first and one light theme.
- Use current membership checks for data access.
- Private events are visible only to their author.
- Notes are pinned messages. Today composes existing feature data.
- Keep fetched shared data in memory. Store local drafts encrypted.
- Use one npm workspace, exact dependency versions, and one lockfile.
- Rate tests before writing them. Implement only tests rated 90 or higher.
- Keep schema migrations for current evolution. Do not add legacy compatibility paths.
- Do not add reduced-motion variants unless the owner requests them.
- Do not provision, publish, submit to stores, or contact real users during local implementation without the required authorization.

## File and command conventions

The complete target tree is in [ARCHITECTURE.md](../../architecture/ARCHITECTURE.md).

Paths below are planned files. Create them only when their task starts.

Unless a path starts with `apps/`, `supabase/`, `brand/`, or `docs/`, native source paths are relative to `apps/mobile/`.

Generate SQL filenames with `supabase migration new <task-name>`. Never guess timestamped filenames.

Each task names its migration label. Keep related policies, constraints, triggers, and functions in that generated migration.

The scaffold defines the command contract in DEVELOPMENT.md. Add each test script when its feature suite starts.

`test:mobile -- <path>` forwards to Jest in `apps/mobile`. `test:db` runs the documented Supabase database suite.

Use the installed CLI's help before adding CLI commands. Record the working commands in DEVELOPMENT.md.

For each test-bearing task: write the named failing test, confirm failure, implement the behavior, then rerun it.

Finish each task with typecheck, relevant checks, and a focused commit if Git is initialized. Do not stage unrelated files.

## Interface conventions

Create `apps/mobile/src/lib/result.ts` in Task 2:

```ts
type Id = string;
type CommandError = {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION' | 'CONFLICT'
    | 'INVITE_UNAVAILABLE' | 'ALREADY_PAIRED' | 'RATE_LIMITED'
    | 'QUOTA_EXCEEDED' | 'RETRYABLE';
  field?: string;
};
type Result<T> = { ok: true; data: T } | { ok: false; error: CommandError };
type Page<T> = { items: T[]; nextCursor: string | null };
```

Validate IDs as UUIDs at command input. Derive the authenticated actor on the server.

Use `commandId: Id` for create/retry commands and `expectedVersion: number` for mutable content edits.

Define feature input and view types in that feature's `types.ts`. Follow DATA.md field limits exactly.

## Review focus

| Risk | Owning task and required evidence |
|---|---|
| Account restore after remote deletion | Task 2 rejects disabled accounts before displaying shared data; Task 17 verifies stale JWT behavior |
| Two simultaneous joins or invite replacement | Task 3 uses real concurrent database clients; at most one second member succeeds |
| DST gaps, repeated times, and leap dates | Tasks 4 and 7 cover real IANA transitions and February 29 |
| Lost response after successful message or upload | Tasks 11 and 13 retry the same UUID without duplicate records |
| Disconnect while a job, export, or media link is active | Tasks 9, 13, 16, and 17 recheck access and document link expiry limits |

## Stage A: Two people share one event

### Task 1: Native foundation and brand

**Files:** Root workspace manifest/lockfile; `apps/mobile/{package.json,app.config.ts,eas.json,tsconfig.json}`; `src/app/_layout.tsx`; `src/components/ui/{Button,Field,Screen,Status,Avatar,Badge}.tsx`; `src/theme/index.ts`; `brand/tokens.json`; mobile assets.

**Consumes:** STYLE.md and selected icon PNG.

**Produces:** Native theme, accessible base controls, and a development build with a working Welcome screen.

- [ ] Confirm stable Expo SDK, Node support, and npm workspace behavior from current documentation.
- [ ] Scaffold Expo Router in `apps/mobile`; pin compatible versions and define root verification scripts.
- [ ] Map brand tokens to native colors, spacing, typography, radii, and 48dp targets.
- [ ] Add the selected icon, splash, Android adaptive icon, and monochrome notification asset.
- [ ] Write `src/components/ui/Field.test.tsx` for labels, errors, and submit access. Importance: 93.
- [ ] Run the field test; confirm its initial failure, then complete the controls.
- [ ] Build and open a development build on Android and iOS; inspect safe areas and large text.
- [ ] Run Expo Doctor, typecheck, and the control test. Record exact versions and device evidence.

**Acceptance:** Both platforms render Welcome and its form controls without a web wrapper or clipped text.

### Task 2: Verified account and encrypted session

**Files:** `src/features/auth/{commands,queries,schema,types,index}.ts`; `screens/{Welcome,Email,Verify,Profile}Screen.tsx`; `src/lib/{result,supabase,private-storage,query-client,database.types}.ts`; `(auth)` routes; migration `accounts`; `supabase/tests/accounts.test.sql`.

**Interfaces:** `requestEmailCode(email): Promise<Result<{retryAt:string}>>`; `verifyEmailCode(email,code): Promise<Result<{userId:Id}>>`; `getAccount(): Promise<Account|null>`; `signOut(scope:'local'|'global'): Promise<void>`.

`Account` contains `id`, `displayName`, `timezone`, `locale`, and `status:'active'|'disabled'`.

Add `verifySensitiveAction(action,code): Promise<Result<{proof:string,expiresAt:string}>>` and `supabase/functions/verify-sensitive-action/index.ts` in this task.

- [ ] Configure local Auth email codes: six digits, ten-minute expiry, and 60-second resend interval.
- [ ] Create profile records and self-only read rules; keep email outside profile records. Task 3 adds current-partner access.
- [ ] Add encrypted MMKV session/draft storage with its key in SecureStore. Never fall back to plaintext.
- [ ] Implement email verification, profile save, session restoration, and foreground refresh.
- [ ] Implement action-bound, single-use server verification proofs and current Auth session checks from DATA.md.
- [ ] Write `auth.test.ts` for invalid/expired codes, storage failure, pending intent, and disabled-account restore. Importance: 100.
- [ ] Test long session values, key loss, sign-out cache removal, and real device restart. Importance: 98.
- [ ] Test proof forgery, expiry, replay, wrong action, and wrong account. Importance: 100.
- [ ] Run account SQL checks and mobile auth tests; verify no public profile reads.

**Acceptance:** One verified account survives restart. An unverified or disabled account cannot open protected records.

### Task 3: Pairing transaction and native invitation flow

**Files:** `src/features/pair/{commands,queries,schema,types,index}.ts`; pair screens; `src/app/(pair)/` routes; `src/app/invite.tsx`; `src/lib/links.ts`; migration `pairing`; `supabase/tests/pairing.test.sql`; `supabase/tests/pairing-races.test.ts`.

**Interfaces:** `getPairContext(): Promise<PairContext>`; `createPair(timezone,commandId)`; `createInvite(pairId,commandId)`; `acceptInvite(token,commandId)`; `cancelPendingPair(pairId,commandId)`. Commands return `Promise<Result<...>>`.

`PairContext` is `unpaired`, `pending` with pair/invite metadata, `active` with two members, or `ended` with own-export deadline.

- [ ] Implement DATA.md membership constraints, invite hashing, expiry, row locks, and idempotent acceptance.
- [ ] Add current-partner profile access after membership tables exist. Verify active membership on every protected read.
- [ ] Implement invitation rate limits and generic token errors.
- [ ] Build create/share, enter, preview, join, waiting, and pair-welcome screens.
- [ ] Preserve the incoming invitation through sign-in and app restart in encrypted storage.
- [ ] Write concurrent tests for three joiners, self-join, cross-pair join, stale regeneration, and replay. Importance: 100.
- [ ] Verify two accounts join once; a third account cannot read the pair or its profiles.
- [ ] Run SQL tests, the race harness, and the two-device invitation flow.

**Acceptance:** Exactly two accounts form one pair. Neither account can hold two active memberships.

### Task 4: Complete one-off calendar flow

**Files:** `src/features/calendar/{commands,queries,schema,types,index}.ts`; `screens/{Calendar,EventDetail,EventForm}Screen.tsx`; `components/EventRow.tsx`; calendar/event routes; migration `events`; `supabase/tests/events.test.sql`.

**Interfaces:** `listAgenda({pairId,from,to}): Promise<AgendaItem[]>`; `createEvent(input,commandId): Promise<Result<Event>>`; `updateEvent(id,input,expectedVersion,commandId)`; `deleteEvent(id,expectedVersion,commandId)`.

`EventInput` contains title, owner, visibility, optional location/description, and exactly one timed or all-day temporal value.

- [ ] Implement event rows, author/private policies, immutable pair/author fields, versions, and command receipts.
- [ ] Build agenda, month selection, event detail, and native create/edit forms.
- [ ] Use Luxon for timezone conversion; require a choice for ambiguous times and reject nonexistent local times.
- [ ] Write `calendar.test.ts` for private/shared visibility, inclusive all-day UI, stale edits, and duplicate saves. Importance: 98.
- [ ] Test Europe/Warsaw spring and autumn transitions and partners in Europe/Warsaw and America/New_York. Importance: 98.
- [ ] Test midnight crossings and events that start before, but overlap, the agenda query range. Importance: 96.
- [ ] Verify cross-pair and guessed private-event IDs through direct backend requests. Importance: 100.
- [ ] Run calendar checks and confirm a shared event appears on the second real device after refresh.

**Acceptance:** Shared and private events have correct visibility and dates after restart.

### Task 5: Today, shell, and early access revocation

**Files:** `src/features/today/{queries,types,index}.ts`; `screens/TodayScreen.tsx`; `(tabs)/{_layout,today,calendar}.tsx`; `src/features/pair/realtime.ts`; migration `end-pair-core`; `supabase/tests/end-pair.test.sql`.

**Interfaces:** `getToday(pairId,date): Promise<TodayView>`; `endPair(pairId,verificationProof,commandId): Promise<Result<{endedAt:string}>>`.

`TodayView` initially contains agenda and pair identity. Add optional content fields only when later tasks implement them.

- [ ] Compose Today from calendar queries; add visible owner names and one Add event action.
- [ ] Implement authenticated app entry, current-pair refresh, route guards, and empty/loading/error states.
- [ ] Add realtime refresh signals and a durable refetch on reconnect.
- [ ] Implement pair closure, shared-cache clearing, pending invite cancellation, and access denial.
- [ ] Write navigation and revoked-session tests, including the app resuming after remote disconnect. Importance: 100.
- [ ] Run the complete Stage A journey with two devices and a third adversarial account.

**Stage A exit:** A pair can sign in, connect, share an event, and disconnect with verified access revocation.

## Stage B: Daily planning and reminders

Chat 05 source checks: 200 mobile tests and 33 Edge-function tests pass. Backend and device acceptance remain unverified.
The owner removed zero-offset reminders. Keep 15-minute, one-hour, and one-day advance choices with strict event-start expiry.

### Task 6: Shared lists and tasks

**Files:** `src/features/tasks/{commands,queries,schema,types,index}.ts`; task screens/components/routes; migration `tasks`; `supabase/tests/tasks.test.sql`.

**Interfaces:** `listTasks(pairId,listId): Promise<Task[]>`; `createTask(input,commandId)`; `updateTask(id,input,expectedVersion,commandId)`; `setTaskCompleted(id,completed,expectedVersion,commandId)`; `createList(pairId,name,commandId)`.

Also produce `deleteTask(id,expectedVersion,commandId)`, `renameList(id,name,commandId)`, `moveListTasksToGeneral(id,commandId)`, and `deleteEmptyList(id,commandId)`.

- [ ] Create pair-scoped lists/tasks with cross-pair foreign-key protection and assignee checks.
- [ ] Create General lists through an active-pair trigger. Initialize lists for existing pairs when introducing the task schema.
- [ ] Build quick add, task details, assignment, optional due date, completed group, and Undo.
- [ ] Add task deletion and safe list rename, move, and empty-list deletion.
- [x] Add Tasks to the tab shell and due tasks to Today.
- [ ] Write duplicate completion, reopen, concurrent title edit, and invalid assignee tests. Importance: 95.
- [ ] Verify checkbox semantics and large text in native task rows. Importance: 93.
- [ ] Run task checks and verify both devices show confirmed changes after restart.

### Task 7: Important dates and saved date ideas

**Files:** `src/features/calendar/{important-dates,date-ideas}.ts`; idea screens/routes; migration `dates-and-ideas`; `supabase/tests/date-ideas.test.sql`.

**Interfaces:** `listImportantDates(pairId,from,to): Promise<AgendaItem[]>`; `createIdea(input,commandId)`; `planDateIdea(ideaId,eventInput,expectedVersion,commandId)`; `archiveIdea(id,expectedVersion,commandId)`.

- [ ] Add one-day yearly important dates and the next-date countdown.
- [ ] Implement the February 29 rule and series-only editing.
- [ ] Build saved ideas, HTTPS link validation, archive, and Plan date prefilling.
- [ ] Save an idea-linked event atomically; return the idea to Saved when its future event is deleted.
- [ ] Write leap-year, timezone countdown, duplicate planning, and cross-pair link tests. Importance: 96.
- [ ] Verify yearly results inside a 366-day query without duplicate calendar rows.

### Task 8: Device permission and notification preferences

**Files:** `src/features/notifications/{commands,queries,types,index}.ts`; permission/settings screens; `src/app/settings/notifications.tsx`; migration `notification-preferences`; `supabase/tests/devices.test.sql`.

**Interfaces:** `registerDevice(input): Promise<Result<{deviceId:Id}>>`; `saveNotificationPreferences(input)`; `setReminder(input,commandId)`; `revokeDevice(installationId)`.

- [ ] Add per-user preferences, devices, and one-owner reminders.
- [x] Request operating system permission only after the person chooses a reminder or enables message alerts.
- [x] Show denied, allowed, and not-requested states; add a settings link.
- [ ] Bind tokens to account and installation; revoke them on local or global sign-out.
- [ ] Write token reassignment, account switching, and denied-permission tests. Importance: 98.
- [ ] Verify permission flows on real Android and iOS development builds.

### Task 9: Durable push delivery

**Files:** `supabase/functions/{dispatch-notifications,check-push-receipts}/index.ts`; shared job helpers; migration `notification-jobs`; `supabase/tests/notification-jobs.test.sql`; worker tests.

**Interfaces:** Internal `claim_due_jobs(limit,lease_seconds)`, `complete_job(id,lease_id,outcome)`, and source-triggered job generation. No public unauthenticated worker interface.

- [ ] Add notifications, unique delivery keys, source versions, leases, and job expiry.
- [ ] Recalculate unsent jobs after source edits, timezone changes, completion, or disconnect.
- [ ] Implement minute scheduling, quiet hours, generic payloads, retry bounds, and receipt handling.
- [ ] Materialize a rolling 90-day horizon for yearly reminders; test horizon renewal without duplicate occurrences.
- [ ] Write duplicate worker, provider timeout, invalid token, DST, quiet-hour, and disconnect-race tests. Importance: 100.
- [ ] Simulate a worker crash after claim and after provider submission; preserve truthful delivery states.
- [ ] Verify delivery on both real platforms; inspect provider receipts and missed-delivery recovery.

**Acceptance:** Retries do not duplicate app records. The system never claims guaranteed or exactly-once device display.

### Task 10: Planning notifications and Stage B review

**Files:** `src/features/notifications/screens/NotificationListScreen.tsx`; `src/app/notifications.tsx`; Today reminder status; Maestro planning flows.

**Interfaces:** `listNotifications(cursor): Promise<Page<Notification>>`; `markNotificationRead(id)`; `resolveNotification(id): Promise<Result<AllowedDestination>>`.

- [x] Add a small notification list and deep links that fetch current authorized source data.
- [ ] Show unavailable content after deletion or disconnect; never restore it from a push payload.
- [x] Add notification state to event/task details without implying the partner enabled reminders.
- [ ] Test forged destinations and stale notification IDs. Importance: 98. Forged-route client tests pass; live stale-ID checks remain pending.
- [ ] Complete Stage B on two devices, including a denied-permission device.

**Stage B exit:** Calendar, tasks, important dates, date ideas, and reminders work without the app staying open.

## Stage C: Personal content

### Task 11: Durable messages

**Files:** `src/features/messages/{commands,queries,schema,types,index}.ts`; `screens/MessagesScreen.tsx`; `components/{MessageRow,Composer}.tsx`; messages tab; migration `messages`; `supabase/tests/messages.test.sql`.

**Interfaces:** `listMessages(pairId,before?): Promise<Page<Message>>`; `sendMessage({pairId,clientId,body})`; `deleteMessage(id,commandId)`; `setReadCursor(pairId,cursor)`.

- [ ] Add durable messages, uniqueness, private read cursors, and keyset paging.
- [ ] Build the keyboard-safe composer and Sending/Sent/Failed states.
- [ ] Preserve encrypted drafts and failed client IDs across restart.
- [ ] Refetch after reconnect and reconcile acknowledgements by client ID.
- [ ] Write lost-response, reordered-update, duplicate-send, deleted-message, and cross-pair tests. Importance: 100.
- [ ] Verify pagination while new messages arrive and the user reads older content. Importance: 95.
- [ ] Run two-device message flows with airplane mode and app termination.

### Task 12: Notes and personal Today content

**Files:** `src/features/messages/notes.ts`; `components/NoteCard.tsx`; Today composition; migration `pinned-notes`; `supabase/tests/notes.test.sql`.

**Interfaces:** `pinMessage(id,commandId)`; `unpinMessage(id,commandId)`; `listPinnedNotes(pairId): Promise<Message[]>`.

- [ ] Enforce one own pinned message per member, with atomic replacement.
- [ ] Add Pin as note and unpin controls; show both notes in Messages.
- [x] Show the newest pin on Today without duplicating message content.
- [ ] Test concurrent pin replacement, deletion, and unauthorized partner-message pinning. Importance: 94.
- [ ] Verify note updates and revoked access on both devices.

### Task 13: Private memory upload

**Files:** `src/features/memories/{commands,queries,schema,types,upload,index}.ts`; memory form route; `supabase/functions/finalize-memory/index.ts`; migration `memories`; `supabase/tests/memories.test.sql`.

**Interfaces:** `prepareMemoryDraft(input): Promise<MemoryDraft>`; `reserveMemory(input,commandId)`; `uploadMemoryPhoto(reservation,localFile)`; `finalizeMemory(memoryId,commandId): Promise<Result<Memory>>`.

- [ ] Add private storage, memory/photo records, quota reservation, and author-only pending access.
- [ ] Convert supported native images to metadata-free JPEG at the documented size limit.
- [ ] Validate server-side file type, dimensions, size, metadata, reservation, and current membership.
- [ ] Publish all selected photos atomically after validation. Keep upload retry state and captions encrypted locally.
- [ ] Write forged MIME, oversized file, GPS metadata, quota race, lost-response, and disconnect-during-upload tests. Importance: 100.
- [ ] Verify one to five photos from Android and iOS pickers, including HEIC input conversion where supported.
- [ ] Run database and worker checks; confirm an unrelated account cannot fetch pending or published objects.

### Task 14: Memory feed, detail, and cleanup

**Files:** Memory feed/detail/edit screens; Memories tab; `supabase/functions/cleanup/index.ts`; memory media queries; photo cleanup tests.

**Interfaces:** `listMemories(pairId,cursor): Promise<Page<Memory>>`; `getMemoryMedia(photoId): Promise<Result<{url:string,expiresAt:string}>>`; `updateMemory(id,input,expectedVersion,commandId)`; `deleteMemory(id,commandId)`.

- [ ] Build dated feed cards and full-image detail, with memory-only image caching.
- [ ] Add author edits/deletion and deliberate save-copy behavior.
- [ ] Issue authorized media links for at most 60 seconds; retry one expired link after reauthorization.
- [ ] Clean abandoned upload reservations after 24 hours and retry deleted-object cleanup.
- [ ] Add the latest memory to Today and the Memories tab to the shell.
- [ ] Test stale links, partial cleanup, deleted images, account switching, and large-text captions. Importance: 98.
- [ ] Complete Stage C on two devices with all five tabs enabled.

**Stage C exit:** Messages, notes, and photos survive restart and respect pair access across failure cases.

## Stage D: Public beta and complete account control

### Task 15: Complete settings and profile controls

**Files:** `src/features/account/{commands,queries,types,index}.ts`; Settings screens/routes; profile and timezone tests.

**Interfaces:** `updateProfile(input,expectedVersion)`; `changeEmail(email,verificationProof)`; `getAccountSettings(): Promise<AccountSettings>`.

- [ ] Build profile, pair, notification, help, version, and account sections.
- [ ] Add private avatar upload using the validated image preparation from Task 13.
- [ ] Extract `src/lib/prepare-image.ts` only now, when memories and avatars both need it.
- [ ] Implement verified email change without changing account identity or pair membership.
- [ ] Apply timezone changes to display and future reminders without shifting stored event instants.
- [ ] Separate disconnect and deletion from ordinary settings.
- [ ] Test account switching, stale verification, timezone changes, and accessible destructive confirmations. Importance: 97.
- [ ] Verify the complete settings flow on both platforms.

### Task 16: User data export

**Files:** `supabase/functions/{request-export,process-exports}/index.ts`; data settings screen; migration `exports`; export authorization and worker tests.

**Interfaces:** `requestExport(pairId,verificationProof,commandId)`; `getExport(jobId): Promise<ExportStatus>`; `getExportPart(jobId,partId)`.

- [ ] Add current-access and ended-pair author-only export modes.
- [ ] Produce JSON and media in private parts up to 100 MiB; persist progress between worker runs.
- [ ] Recheck access at each step and download. Expire results after 24 hours.
- [ ] Test private-event exclusion, another author's media, disconnect races, job replay, and expired downloads. Importance: 100.
- [ ] Export a full synthetic pair and verify record counts, dates, and file integrity.

### Task 17: Account deletion and retention completion

**Files:** `supabase/functions/{delete-account,process-deletions,cleanup}/index.ts`; account deletion screens; migration `deletion-jobs`; `supabase/tests/deletion.test.sql`.

**Interfaces:** `requestAccountDeletion(verificationProof,commandId): Promise<Result<{receipt:string}>>`; `getDeletionStatus(receipt): Promise<DeletionStatus>`.

- [ ] Disable the account in the first transaction, revoke sessions, and close active membership.
- [ ] Purge authored records and files through bounded retryable steps before removing the Auth account.
- [ ] Retain only the former partner's own 30-day export access; purge ended pairs at expiry.
- [ ] Add seven-day content-free deletion receipts and 24-hour purge targets to monitoring.
- [ ] Test valid stale JWTs, interrupted cleanup, duplicate jobs, export races, and foreign-key deletion ordering. Importance: 100.
- [ ] Verify no authored files remain after the completed deletion fixture.

### Task 18: Public website and installation handoff

**Files:** `apps/site/{package.json,astro.config.mjs}`; public pages/components/styles/scripts from the architecture tree; `.well-known` association files; site tests.

**Interfaces:** `/invite?token=...` opens the native invitation route; `/delete-account` uses Task 17 after the same fresh email verification.

- [ ] Build the landing page from real product screenshots and approved brand tokens.
- [ ] Build support, privacy, terms, invitation, and independently usable account deletion pages.
- [ ] Add truthful prelaunch store states; inject verified store links only when they exist.
- [ ] Configure the actual domain's Android App Links and iOS Universal Links before production builds.
- [ ] Set no-referrer behavior, token redaction, security headers, and restricted deletion-request CORS.
- [ ] Write mobile-width, keyboard, no-app invite handoff, token leakage, and external deletion tests. Importance: 96.
- [ ] Run site tests and static build; verify public pages have no account or pair data in generated HTML.

### Task 19: Device, accessibility, and product review

**Files:** `apps/mobile/e2e/` flows; device evidence under `docs/release/`; amendments to SCREENS.md and STYLE.md only when findings justify them.

- [ ] Run complete pairing, planning, messaging, memory, export, and deletion flows on both real platforms.
- [ ] Test VoiceOver, TalkBack, 200% text, safe areas, Android Back, keyboards, and permission denial. Importance: 95.
- [ ] Test cold start, session expiry, reinstall, airplane mode, slow uploads, timezone travel, and deep links. Importance: 98.
- [ ] Test feed pagination with 1,000 messages, 200 memories, and a 366-day agenda fixture. Importance: 90.
- [ ] Conduct the five-pair usability review in the product spec with consenting testers.
- [ ] Record findings and fix core-flow failures before adding any new scope.

### Task 20: Operations and release candidate

**Files:** `.github/workflows/verify.yml`; controlled build workflow; environment examples; release runbook and evidence.

- [ ] Configure separate staging/production values, verified SMTP, push credentials, backups, and restricted worker invocation.
- [ ] Run SQL advisors and access tests after generating and applying reviewed schema migrations.
- [ ] Add content-free alerts for failed sends, aged jobs, quota errors, and purge deadlines.
- [ ] Test backup restore in an isolated environment; never restore over a live project as a drill.
- [ ] Complete privacy disclosures, content ratings, legal pages, support handling, and store deletion requirements.
- [ ] Build signed release candidates and run the release checklist against the exact artifacts.
- [ ] Record unresolved launch inputs as release blockers. Do not fill them with fake values.
- [ ] Present the tested release candidate for owner review before publishing or store submission.

**Stage D exit:** All first-release requirements have evidence, store assets match the product, and operations can recover failed work.

## Spec coverage

| Requirement | Tasks |
|---|---|
| Native visual system and selected icon | 1, 19 |
| Auth, welcome, sessions, profile | 2, 15 |
| Pairing, invitation links, race safety | 3, 5, 18 |
| Today and five tabs | 5, 6, 11, 14 |
| Calendar, privacy, dates, saved ideas | 4, 7 |
| Lists, tasks, reminders | 6, 8–10 |
| Messages and love notes | 11–12 |
| Photos and memories | 13–14 |
| Settings, export, disconnect, deletion | 5, 15–17 |
| Landing, public documents, installation | 18 |
| Usability, accessibility, performance | 19 |
| Security, monitoring, store release | 20 and each feature's access tests |

## Handoff

Use the [numbered chat guide](../../implementation/CHAT_GUIDE.md) and copy each assigned prompt into a new project chat.

Run 01, then 02–04 in parallel, then 05–08 in order. Parallel chats use isolated worktrees and databases.

Every chat records exact interfaces and verification results using the [handoff template](../../implementation/HANDOFF_TEMPLATE.md).

The owner starts each chat. Do not create chats or send messages between them automatically.

No release date or development duration is promised by this plan.
