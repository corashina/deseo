# Chat 01: Core app

## Identity

- Scope: native foundation, authentication, pairing, one-off calendar, Today, and early access revocation.
- Master Tasks 1–5: source implemented; backend and device acceptance remain partial.
- Integration branch: `codex/deseo-integration`.
- Checkout: `C:\Users\Corashina\Documents\Projects\deseo`.
- Documentation base: `17095fa5cb0f9e6e2b3fb789bcf374b9312e4dda`.
- Tested code commit: `118fdf553ed3c37ffe2ff01a9cf2b68e2de08485`.
- This report is committed separately after the code commit.
- No shared baseline is approved for Chats 02–04 yet.

## Status

- Code status: **In progress**. Mobile checks pass; required backend security checks remain unrun.
- Device status: **Pending**, Android and iOS. JavaScript bundles passed; native binaries and devices were unavailable.
- Release status: **Blocked**. Backend checks, device checks, network invitation limits, and dependency advisories remain open.

The owner deferred Docker setup. This defers database validation; it does not change the backend or acceptance rules.
No remote services, real users, EAS projects, builds, deployments, or store submissions were created.

## Implemented behavior

The source supports these flows. Mobile tests cover their client behavior; real backend journeys remain unverified.

- Native Welcome, email entry, six-digit verification, and profile entry.
- Verified session restoration before protected routes open. Network and storage failures keep those routes closed.
- AES-256 MMKV storage for sessions, drafts, and invitation intent. SecureStore holds the encryption key.
- Pair creation, invitation copy/share, preview, explicit acceptance, waiting, cancellation, and pair welcome.
- Incoming invitation preservation through sign-in and restart. A complete typed code can also save while offline.
- Calendar agenda, month selection, owner filters, details, creation, editing, and deletion.
- Timed and all-day events, private visibility, explicit sharing consent, version conflicts, and stable retry IDs.
- Warsaw DST gap rejection and explicit selection of repeated times. Timed events render in the viewer's timezone.
- Encrypted event drafts preserve input, original versions, and uncertain submissions.
- Today shows up to three upcoming plans from the calendar. Confirmed saves invalidate its cache.
- Pair closure uses a fresh, action-bound proof. Local and global sign-out clear private client state.
- Foreground and reconnect checks refresh account and pair access before protected content opens.
- Durable pair scope and event revocation records remove inaccessible drafts after restart.

Only Today and Calendar tabs exist. Later chats add tasks, messages, memories, reminders, export, and deletion.
The 30-day own-export deadline is metadata. Chat 06 implements the export and retention workflow.

### Review and execution decisions

The saved design and master Tasks 1–5 supplied the accepted scope. Product brainstorming was not repeated.
The direct request for subagents took precedence over the prompt's embedded no-agent instruction.
Auth, backend, and calendar work used separate file ownership in the new integration checkout.
One independent review covered the complete change, followed by one fix pass.

Review fixes address current visibility before receipt replay, draft revocation signals, background draft flushing, restart cleanup, and Today invalidation.
A related Today fix removes completed timed events before applying the result limit.
Regression tests failed before their fixes and passed afterward. The SQL regression remains unexecuted.

## Changed files

| Area | Files |
|---|---|
| Workspace | Root manifests, lockfile, Node pin, npm settings, Git ignore rules, and ESLint rules |
| Native configuration | `apps/mobile/app.config.ts`, `eas.json`, `tsconfig.json`, and `.env.example` |
| Brand and controls | `brand/`, `apps/mobile/assets/`, `src/theme/`, and `src/components/ui/` |
| Features | `apps/mobile/src/features/{auth,pair,calendar,today}/` |
| Shared runtime | `apps/mobile/src/lib/` |
| Routes | `apps/mobile/src/app/` |
| Backend | `supabase/config.toml`, four migrations, verification function, email template, and tests |
| Setup documents | Root README, documentation index, development guide, plan status, and backend guide |

All `src/` paths below are relative to `apps/mobile/`.
The selected icon is copied unchanged into `assets/icon.png` and `brand/icon-source.png`.
The monochrome notification source is `brand/notification-icon.svg`. Notification registration belongs to Chat 05.
Generated database types remain pending. No hand-written file claims to be generated schema output.

## Public interfaces

Import other features through their `index.ts` files. ESLint rejects cross-feature imports into internal files.

### Results and sessions

`src/lib/result.ts` exports `Id`, `CommandError`, `Result<T>`, `Page<T>`, `AppError`, validation schemas, and error conversion helpers.

```ts
type Id = string;
type Result<T> = { ok: true; data: T } | { ok: false; error: CommandError };
type Page<T> = { items: T[]; nextCursor: string | null };
```

`CommandError` contains `code`, plus optional `field`, `message`, and `retryAt` strings.
Codes are `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `CONFLICT`, `INVITE_UNAVAILABLE`, `ALREADY_PAIRED`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, and `RETRYABLE`.
Commands validate UUIDs at their boundary. The server derives the actor from the live Auth session.

`src/features/auth/index.ts` exports these contracts:

| Export | Return value |
|---|---|
| `requestEmailCode(email: string)` | `Promise<Result<{retryAt: string}>>` |
| `verifyEmailCode(email: string, code: string)` | `Promise<Result<{userId: Id}>>` |
| `saveProfile(input: ProfileInput, expectedVersion?: number)` | `Promise<Result<Account>>` |
| `getAccount()` | `Promise<Account \| null>` |
| `restoreSession()` | `Promise<SessionContext \| null>` |
| `signOut(scope: 'local' \| 'global')` | `Promise<void>`; throws if revocation or cleanup fails |
| `requestSensitiveActionCode(action: SensitiveAction)` | `Promise<Result<{retryAt: string}>>` |
| `verifySensitiveAction(action: SensitiveAction, code: string)` | `Promise<Result<{proof: string; expiresAt: string}>>` |
| `useAuth()` | `{state: AuthState; refresh(): Promise<void>; retryStorage(): Promise<void>}` |

`Account` is `{id, displayName, timezone, locale, status: 'active'|'disabled', version: number}`.
`ProfileInput` contains `displayName`, `timezone`, and `locale`.
`SessionContext` is `{userId: Id; account: Account|null}`.
`AuthState.status` is `loading`, `signedOut`, `error`, or `authenticated`. Only the last contains session context.
`SensitiveAction` currently permits only `end_pair`.

Other auth exports: `AuthProvider`, `emailSchema`, `emailCodeSchema`, `profileSchema`, `timezoneSchema`, and the four auth screens.
`src/lib/supabase.ts` exports the lazy `getSupabase(): Promise<SupabaseClient>` and `resetSupabaseClient(): Promise<void>`.
The single client uses encrypted storage, `processLock`, and requests scoped to the current client access state.
`get_session_context` checks the JWT session ID against `auth.sessions` and checks current account status.

### Pairing and membership

`src/features/pair/index.ts` exports `PairContext`, `PairMember`, `InvitePreview`, `pairContextSchema`, and these functions:

| Export | Return value |
|---|---|
| `getPairContext()` | `Promise<PairContext>` |
| `createPair(timezone: string, commandId: Id)` | `Promise<Result<{pairId: Id}>>` |
| `createInvite(pairId: Id, commandId: Id)` | `Promise<Result<{token: string|null; expiresAt: string; alreadyDelivered: boolean}>>` |
| `previewInvite(token: string)` | `Promise<Result<InvitePreview>>` |
| `acceptInvite(token: string, commandId: Id)` | `Promise<Result<{pairId: Id}>>` |
| `cancelPendingPair(pairId: Id, commandId: Id)` | `Promise<Result<{endedAt: string}>>` |
| `endPair(pairId: Id, verificationProof: string, commandId: Id)` | `Promise<Result<{endedAt: string}>>` |
| `useCore()` | `{account: Account; pair: PairContext; online: boolean; refresh(): Promise<void>}` |

`PairMember` is `{userId: Id; displayName: string; slot: 'a'|'b'}`.
`PairContext` has these shapes:

- `unpaired`: `{status}`.
- `pending`: `{status, pairId, timezone, member, invite: {expiresAt}|null}`. The creator occupies slot `a`.
- `active`: `{status, pairId, timezone, members}`. Runtime validation requires exactly two members.
- `ended`: `{status, pairId, endedAt, ownExportDeadline}`.

`InvitePreview` is `{pairId, inviterName, timezone, expiresAt}`.
`PairProvider` requires `reconcileDrafts(accountId, pairId): Promise<void>`; the root supplies the calendar implementation.
`usePairGate()` returns `{account, pair, checking, error, online, refresh}` with nullable account and pair.

Screen exports are `StartScreen`, `JoinScreen`, `WaitingScreen`, `EndedScreen`, `EntryScreen`, `InviteScreen`, `PairWelcomeScreen`, and `PairSettingsScreen`.

### Calendar and Today

`src/features/calendar/index.ts` exports the following:

| Export | Return value |
|---|---|
| `listAgenda({pairId, from, to}: AgendaRange)` | `Promise<AgendaItem[]>` |
| `getEvent(pairId: Id, id: Id)` | `Promise<Event|null>` |
| `createEvent(input: EventInput, commandId: Id)` | `Promise<Result<Event>>` |
| `updateEvent(id: Id, input: EventInput, expectedVersion: number, commandId: Id)` | `Promise<Result<Event>>` |
| `deleteEvent(id: Id, expectedVersion: number, commandId: Id)` | `Promise<Result<{id: Id}>>` |
| `reconcileEventDrafts(accountId: Id, pairId: Id)` | `Promise<void>` |

```ts
type Owner = 'a' | 'b' | 'together';
type Visibility = 'shared' | 'private';
type EventTime =
  | { kind: 'timed'; startsAt: string; endsAt: string }
  | { kind: 'allDay'; startDate: string; endDateExclusive: string };
type EventInput = {
  id: Id; pairId: Id; title: string; owner: Owner; visibility: Visibility;
  timezone: string; temporal: EventTime; location?: string; description?: string;
  confirmShared?: boolean;
};
type Event = Omit<EventInput, 'confirmShared'> & { authorId: Id; version: number };
type AgendaItem = Event;
type AgendaRange = { pairId: Id; from: string; to: string };
```

Agenda ranges use dates in the pair timezone. They include overlaps and exclude the end date; the maximum range is 366 days.
Timed values use UTC instants. All-day values use dates with an exclusive end; forms show the last included date.
`EventFormValues` is exported from the feature; its full field contract is in `types.ts`.

Other exports: `calendarKeys`, `agendaDates`, `eventInputSchema`, `eventFormSchema`, `resolveWallTime`, `wallTimeChoices`, and `inclusiveEndDate`.
Screen/component exports: `CalendarScreen`, `EventDetailScreen`, `EventFormScreen`, `EventRow`, `EventRowProps`, and `eventDateLabel`.

`src/features/today/index.ts` exports `getToday(pairId: Id, date: string): Promise<TodayView>`, `TodayScreen`, and `todayKeys`.
`TodayView` is `{pair: Extract<PairContext, {status: 'active'}>; agenda: AgendaItem[]}`.

### Query keys and drafts

| Builder | Exact key |
|---|---|
| `pairKeys.context(accountId)` | `['account', accountId, 'pair']` |
| `calendarKeys.all(accountId, pairId)` | `['calendar', accountId, pairId]` |
| `calendarKeys.agenda(accountId, {pairId, from, to})` | `['calendar', accountId, pairId, 'agenda', from, to]` |
| `calendarKeys.event(accountId, pairId, id)` | `['calendar', accountId, pairId, 'event', id]` |
| `todayKeys.day(accountId, pairId, date)` | `['today', accountId, pairId, date]` |

`src/lib/query-client.ts` exports `queryClient`, `captureQueryScope`, `resetPrivateQueries`, and `connectQueryLifecycle`.
`captureQueryScope()` returns `{signal, assertCurrent()}`. A reset aborts requests, clears queries, and rejects stale completion.
Fetched content remains in memory. Persistent storage contains sessions, intent, and local drafts only.

`getPrivateStorage(): Promise<PrivateStorage>` is exported from `src/lib/private-storage.ts`.
All storage operations are asynchronous and serialized. Read methods return `string|null`; writes and purges return `void`.

```ts
session.getItem(key); session.setItem(key, value); session.removeItem(key);
clearSession();
getDraft(accountId, pairId: string|null, key);
setDraft(accountId, pairId: string|null, key, value);
removeDraft(accountId, pairId: string|null, key);
purgeAccountDrafts(accountId); purgePairDrafts(accountId, pairId);
getIntent(key); setIntent(key, value); removeIntent(key);
```

The module also exports `PrivateStorageError`, `onPrivateStorageFailure`, and `resetPrivateStorage`.
Storage failure blocks private access. Reset requires the user's explicit destructive choice and removes local sessions and drafts.
Intent keys include `invite`, `emailAttempt`, `lastAccount`, and `lastPair:<accountId>`.
Calendar draft keys are `calendar:new` and `calendar:<eventId>`, inside the account/pair scope.
Drafts contain form values, event UUID, command UUID, expected version, and any uncertain submission.

`src/lib/draft-lifecycle.ts` exports `registerDraftFlush(writer)` and `flushPrivateDrafts()`.
New draft editors must register a writer so backgrounding saves the latest input before access resets.
Sign-out purges account drafts. Account changes purge the previous account's drafts. Pair changes purge the previous pair's drafts.
Before opening an active pair, `reconcileEventDrafts` removes drafts listed in the caller's event revocations.

### Theme, controls, and routes

`src/theme/index.ts` exports `theme` and `ui`. Tokens come from `brand/tokens.json`.
Theme fields include colors, spacing, radii, 48dp targets, and native typography.
`ui` exports `card`, `row`, and `stack` styles.

Controls are named exports from `src/components/ui/<Name>.tsx`:

- `Button`: `label`, `onPress`, optional `variant`, `loading`, and `disabled`.
- `Field`: native text input props plus `label`, optional `error`, and `hint`.
- `Screen`: children, optional `title`, `subtitle`, `refreshing`, and `onRefresh`.
- `Status`: `message`, optional `tone`, `actionLabel`, and `onAction`.
- `Avatar`: `name`, optional `slot`.
- `Badge`: `label`, optional `owner`.

Routes: `/`, `/invite`, `/(auth)/{welcome,email,verify,profile}`, and `/(pair)/{start,join,waiting,welcome,ended}`.
Protected routes: `/(tabs)/{today,calendar}`, `/events/new`, `/events/[eventId]`, `/events/[eventId]/edit`, and `/settings/pair`.
The root stack stays mounted during restoration. Guards remove protected screens until account and pair checks succeed.

The native scheme is `deseo-dev`. Invitation links use `deseo-dev://invite?token=<code>`.
`parseInviteLink` also accepts HTTPS `/invite?token=<code>` links from the configured `EXPO_PUBLIC_SITE_URL` origin.
Foreign origins, fragments, extra query parameters, and malformed codes are rejected.
`src/lib/links.ts` exports the parser, `inviteTokenSchema`, `setPendingInvite`, `getPendingInvite`, and `clearPendingInvite`.
Associated domains and public invitation landing pages remain with Chat 07.

## Database and dependencies

The CLI generated these migration filenames in dependency order:

1. `20261004151119_accounts.sql`: profiles, receipts, proofs, session checks, self-only profile access, and account RPCs.
2. `20261004151120_pairing.sql`: pairs, membership, hashed invitations, attempt limits, partner reads, and pairing RPCs.
3. `20261004151121_events.sql`: event permissions, immutable identity, versions, receipts, agenda reads, and draft revocations.
4. `20261004151123_end-pair-core.sql`: proof consumption, pair closure, invitation cancellation, and access removal.

The API exposes only `public`. Internal tables and privileged functions use `private` with fixed search paths.
Public command wrappers call private functions with explicit session, account, membership, and content checks.
RLS helpers are `private.active_actor()`, `private.is_member(pairId, activeOnly default true)`, and `private.is_partner(userId)`.
Commands use `private.lock_pair` and lock profiles in UUID order before pair rows.
Do not bypass current access checks when replaying a command receipt.

Receipts are actor/command scoped, bind a payload hash, and expire after 30 days.
Invitations use 12-character Crockford codes, stored as hashes, with 24-hour expiry.
A replayed invitation receipt returns no token. Use a new command UUID to replace the invitation.
Five failed invitation attempts trigger a 15-minute account limit. Trusted network limits remain unimplemented.
The service-only proof issuer binds an opaque proof to account, session, action, and expiry.
The Edge function verifies the actual Auth email and revokes the extra session created by OTP verification.

See [the backend guide](../../supabase/README.md) for exact RPC parameters, response fields, function requests, and local commands.
Profiles, membership, and events are in the Realtime publication.
Own-profile updates signal pair changes and private-event revocations after shared rows become unreadable.
Client code treats Realtime as an invalidation signal and rechecks access on reconnect and foreground.

Local project ID: `deseo`. Ports: API `54321`, PostgreSQL `54322`, Studio `54323`, local email `54324`, shadow database `54320`.
No local stack is running. No test keys or service secrets are committed.

Primary versions: Node `24.18.0`, npm `11.16.0`, Expo `57.0.26`, React Native `0.86.3`, React `19.2.3`.
Router `57.0.24`, Supabase JS `2.117.2`, Supabase CLI `2.119.0`, TanStack Query `5.104.1`, and TypeScript `6.0.3`.
MMKV `4.3.2`, Nitro Modules `0.37.1`, SecureStore `57.0.4`, Luxon `3.7.2`, Zod `3.25.76`.
React Hook Form `7.89.0`, Jest `29.7.0`, Jest Expo `57.0.5`, and Testing Library `14.0.1`.
Manifests and the single lockfile record all exact versions. Root overrides keep Expo's React and native peers consistent.
Both development native identifiers are `dev.deseo.mobile`. MMKV requires development builds; Expo Go is unsupported.

## Verification

Environment: Windows, PowerShell, Node `24.18.0`, npm `11.16.0`; checks completed on 2026-10-04.
No Android/iOS device, simulator, native build ID, or device screenshot is available.
Test importance was recorded before implementation. Mobile scores range from 93 to 100; SQL and races score 100.

| Check | Importance | Exact command or action | Actual result |
|---|---|---|---|
| Mobile behavior | 93–100 | `npm run test:mobile` | Passed: 14 suites, 60 tests |
| Mobile types | Required | `npm run typecheck` | Passed |
| Lint and import rules | Required | `npm run lint` | Passed |
| Expo compatibility | Required | `npx --yes expo-doctor@1.20.4` in `apps/mobile` | Passed: 21/21 |
| Native JS exports | Required | `npx expo export --platform android --platform ios --output-dir dist` in `apps/mobile` | Passed: both Hermes bundles |
| SQL syntax | Supporting only | Inline Python using pglast 7.9; reproduction below | Passed: 119 statements, 22 PL/pgSQL bodies |
| SQL assertion plans | 100 | Same parser script | 67 assertions counted: accounts 12, pairing 19, events 21, end-pair 15 |
| Edge types | Required | `npm exec --yes --package deno@2.9.6 -- deno check --frozen --config supabase/functions/verify-sensitive-action/deno.json supabase/functions/verify-sensitive-action/index.ts` | Passed |
| Race harness types | Required | `node_modules/.bin/tsc.cmd --noEmit --target es2022 --module esnext --moduleResolution bundler --types node --strict --skipLibCheck supabase/tests/pairing-races.test.ts` | Passed |
| Database behavior | 100 | `npm run test:db` | Could not connect to `127.0.0.1:54322`; no assertions ran |
| Concurrent Auth/HTTP races | 100 | `node --experimental-strip-types supabase/tests/pairing-races.test.ts` | Stopped: local test keys absent |
| Advisors | Required | `npx supabase db advisors --local --type all --fail-on warn` | Could not connect to local database |
| Generated types | Required | `npx supabase gen types --local --schema public` | Blocked: Docker/Podman unavailable |
| Native safety and usability | 93–100 | Android/iOS safe areas, keyboard, large text, restart, and two-device Stage A | Not run; devices/build access unavailable |
| Dependency audit | Required | `npm audit --json` | Failed: 93 affected dependency entries; see below |
| Diff whitespace | Required | `git diff --cached --check` | Passed before code commit |

Exports are ignored under `apps/mobile/dist/`. They are not installable binaries.
Syntax and unit checks do not prove SQL execution, RLS, transaction races, email verification, or Realtime delivery.
No database or physical acceptance check is reported as passed.

### Dependency audit

The final audit reports 83 high and 10 moderate entries propagated from four transitive advisories:

- `braces`: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), nested-pattern stack exhaustion.
- `decode-uri-component`: [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), malformed-input denial of service.
- `node-forge`: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), signature verification parsing.
- `uuid`: [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), supplied-buffer bounds checks.

Registry checks returned latest `braces` 3.0.3 and `node-forge` 1.4.0, both inside the reported affected ranges.
Newer `decode-uri-component` and `uuid` releases exist outside the installed dependency ranges.
Their upstream upgrades or targeted overrides still require compatibility review.
The audit suggested incompatible major changes, including Expo 44. No forced upgrade or downgrade was applied.
Do not treat the current dependency tree as release-ready.

### SQL parser reproduction

The temporary parser package is `pglast==7.9` under `$env:TEMP/deseo-sql-parser`.
The check used the bundled Python executable shown below. This is a static check, separate from pgTAP.

```powershell
@'
import sys, pathlib, re, os
sys.path.insert(0, os.path.join(os.environ['TEMP'], 'deseo-sql-parser'))
from pglast import parse_sql, parse_plpgsql
for path in sorted(pathlib.Path('supabase/migrations').glob('*.sql')):
    content = path.read_text(encoding='utf-8')
    statements = parse_sql(content)
    functions = 0
    for match in re.finditer(r'create function[\s\S]*?\$\$;', content, re.I):
        sql = match.group()
        if 'language plpgsql' in sql.lower():
            parse_plpgsql(sql)
            functions += 1
    print(path.name, len(statements), 'statements;', functions, 'PL/pgSQL bodies')
fixture = pathlib.Path('supabase/tests/fixtures/setup.sql').read_text(encoding='utf-8')
for path in sorted(pathlib.Path('supabase/tests').glob('*.sql')):
    content = path.read_text(encoding='utf-8')
    parse_sql(content.replace('\\ir fixtures/setup.sql', fixture))
    expected = int(re.search(r'select plan\((\d+)\)', content).group(1))
    assertions = len(re.findall(r'^select (?:ok|is|matches|throws_ok|has_table|has_function)\(', content, re.M))
    assert expected == assertions, path
    print(path.name, assertions, 'assertions; execution pending')
'@ | & 'C:/Users/Corashina/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -
```

## Integration instructions

1. Continue this core checkout before opening Chats 02–04.
2. When Docker setup resumes, start a disposable local Supabase stack and apply migrations in order.
3. Run SQL tests, race tests, advisors, and fresh verification against real local Auth accounts.
4. Verify private visibility changes, receipt replay, remote disconnect, stale sessions, and Realtime revocation signals.
5. Generate `src/lib/database.types.ts` from the verified schema and apply it to the client.
6. Complete native acceptance or record each unavailable physical check separately.
7. Commit required fixes and publish one verified core baseline for all three parallel chats.

Chat 02 adds General task lists and their active-pair trigger. Pairing currently references no task tables.
Later editors must preserve account/pair draft scopes, stable source UUIDs, version checks, and command UUIDs across uncertain retries.
Chat 05 owns new tabs, Today composition, reminders, and cancellation hooks after the related tables exist.
There are no unresolved file conflicts. The public contract is recorded but is not cleared for parallel implementation yet.

## Remaining work

- **Backend checks:** Run all 67 pgTAP assertions, the real-account race harness, advisors, and fresh database reset.
- **Backend integration:** Verify OTP/proof issuance, current-session rejection, Realtime signals, and the full two-account flow.
- **Code inputs:** Generate database types and add trusted network invitation limits with a spoofing test before deployment.
- **Dependency work:** Resolve or explicitly assess the four audit advisories before release.
- **Local credentials:** Supply local publishable/server test keys through ignored environment files after starting Supabase.
- **Native devices:** Build Android/iOS, inspect controls and icons, test keyboard and large text, and verify encrypted restart behavior.
- **Human checks:** Review invitation consent, privacy text, conflict recovery, and destructive-action confirmation on devices.
- **Later scope:** Complete notifications, export/retention, deletion, production domains, identifiers, and release credentials in their assigned chats.

The next eligible work is continued Chat 01 validation. Chats 02–04 must wait for the automated security gate.
