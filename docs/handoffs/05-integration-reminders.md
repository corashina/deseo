# Chat 05: Integration and reminders

## Identity

- Branch: `codex/deseo-integration`.
- Worktree: `C:\Users\Corashina\Documents\Projects\deseo\.worktrees\deseo-05-integration`.
- Core baseline: `7564cd0e13bfa9df492603f5e1f6a0919aeddfcf`.
- Feature merges: Planning `e5c4abc`, Messages `619c8b8`, Memories `eb06f89`.
- Tested source checkpoint: `c2fa060a7e10f8e0c2fa9770ed74d9df42c6f25d`.
- This report follows the source commit in a separate documentation commit.

The primary checkout remains on `master`. No feature worktree was reset or removed.
The app worktree tool failed an ownership check. Git created the requested worktree in the ignored `.worktrees` directory.
The owner requested multiple agents. Agents handled frontend integration, SQL, workers, and independent review.

## Status

- Code status: **In progress**. Source checks pass. The at-start timing conflict remains unresolved.
- Backend status: **Blocked**. Docker's engine pipe is unavailable. No combined schema replay or live security check passed.
- Device status: **Pending**. Android and iOS JavaScript exports pass; native binaries and devices remain untested.
- Release status: **Blocked**. This checkpoint does not establish Stage B or Stage C acceptance.

The owner requested source integration. That request did not convert earlier unrun checks into acceptance evidence.
No remote service, deployment, native build, real push, or real user contact occurred.

## Implemented source

The app has Today, Calendar, Memories, Messages, and Tasks tabs. Root guards cover the feature routes.
Today reads due tasks, the important-date countdown, the newest pinned note, and the latest memory through public feature interfaces.
Messages shows an unread badge. Today shows a recent unread notification indicator without claiming a total count.
Shared subscriptions refresh visible feature data. The memory boundary controls memory reads and image lifecycle access.
Obsolete standalone tab entry routes were removed.

Event and task details contain personal reminder controls. Event defaults prefill a choice; Save reminder confirms it.
Task reminders convert an explicit local date and time to an instant. Ambiguous or missing DST times require another choice.
Permission prompts follow Save reminder or enabled message alerts. Resume checks never request permission.
The app shows allowed, denied, and not-requested states and links to device settings.

Device registration binds installation, token, account, and live Auth session. Token transfer revokes the previous owner.
Sign-out attempts device revocation before Auth sign-out and clears local private state even after a network failure.
Workers also check live Auth sessions. Failed remote revocation still requires retry; local cleanup cannot prove remote success.

SQL source creates per-recipient notifications and per-device jobs. Jobs use leases, source versions, retries, and expiry.
Source, preference, device, profile, and pair changes cancel or refresh unsent work.
Yearly reminders use a rolling 90-day horizon. Quiet hours use the recipient's timezone.
Known provider tickets cannot resubmit. Receipts track provider acceptance and revoke invalid tokens.
Timeouts after provider submission can cause duplicate pushes. Provider acceptance does not prove device display.

Notification payloads contain generic text and an opaque notification ID. Navigation fetches current source authorization.
The client rejects route text in push data and refuses destinations from a different active pair.

## Open timing decision

SCREENS.md offers “At start” and 09:00 all-day reminders. DATA.md expires event pushes at the corresponding start time.
The current zero-offset choice therefore has equal due and expiry times. The worker cannot submit it after claiming it.
The UI warning describes possible expiry but does not fix this contract conflict.

The owner has a pending choice:

1. Permit a one-minute delivery window for zero-offset reminders.
2. Remove zero-offset choices and retain reminders before the event.

Do not mark Chat 05 complete until that choice is implemented and tested. Include both timed and all-day cases.

## Public interfaces

Import notification APIs from `apps/mobile/src/features/notifications/index.ts`.

| Export | Contract |
|---|---|
| `registerDevice(input)` | `Result<{deviceId}>`; input has `installationId`, `token`, `platform`, `permission` |
| `revokeDevice(installationId, all=false)` | `Result<{revoked:true}>` |
| `revokeCurrentDevice(all)` | Rejects when remote revocation cannot be confirmed |
| `getNotificationPreferences()` | Preferences with message alerts, default offset, quiet times, timezone, version |
| `saveNotificationPreferences(input)` | Uses the input version as the expected version |
| `setReminder(input, commandId)` | Stable command ID, source ID, expected version; returns personal reminder state |
| `getReminder(eventId, taskId)` | Exactly one source; returns the viewer's reminder or null |
| `listNotifications(cursor)` | `{items, nextCursor}`, at most 50 items |
| `markNotificationRead(id)` | `Result<{id}>` |
| `resolveNotification(id)` | `Result<{kind:'event'|'task'|'messages', id, pairId}>` |
| `ReminderControl` | Source ID/version, timezone, optional all-day/completed/due-date values |

Reminder input fields are `id`, `pairId`, `eventId`, `taskId`, `minutesBefore`, `remindAt`, `active`, and `expectedVersion`.
Exactly one source ID is non-null. Inactive reminders may have no schedule.
Reminder output adds `version`, `state: scheduled|past|off`, and `nextDueAt`.
Event offsets currently accept 0, 15, 60, or 1440 minutes, subject to the open zero-offset decision.

Query keys start with `notifications`, followed by account and pair where relevant.
Reminder keys include the source version. Confirmed commands invalidate the notification namespace.
Auth and pair changes retain the existing full private-cache reset.

Routes: `/notifications`, `/settings/notifications`, and the five tab routes.
Push opens `/notifications?notificationId=...`; it cannot select an arbitrary route.

## Worker interfaces

The following public RPC wrappers grant access only to `service_role`. Their private implementations use fixed search paths.

| RPC | Input | Output |
|---|---|---|
| `claim_due_jobs` | `p_limit`, `p_lease_seconds` | Jobs with ID, lease, notification ID, token, attempt, expiry |
| `revalidate_notification_job` | `p_id`, `p_lease_id` | Rechecked job or null |
| `complete_job` | `p_id`, `p_lease_id`, `p_outcome` | `{ok}` |
| `claim_push_receipts` | `p_limit`, `p_lease_seconds` | Receipt jobs with ticket and lease |
| `complete_push_receipt` | `p_id`, `p_lease_id`, `p_outcome` | `{ok}` |
| `refresh_notification_horizon` | None | `{refreshed}` |

Dispatch outcomes: `submitted` plus `ticket`, `retry` plus `code`, `failed` plus `code`, or `device_not_registered`.
Receipt outcomes: `accepted`, `pending`, `failed`, or `device_not_registered`.
Workers authenticate `Authorization: Bearer <NOTIFICATION_WORKER_SECRET>`. Minimum secret length is 32 characters.
Dispatch accepts `{}` or `{"action":"refresh_horizon"}`. Receipt checks accept `{}`.
Provider calls use a ten-second timeout and a 64 KiB response bound.

Authorization rechecks serialize with source changes. A disconnect after that transaction cannot recall an in-flight provider request.

## Database and dependencies

All nine feature migration versions remain unchanged and unique. Two CLI-generated migrations follow them:

1. `20261004175809_notification-preferences.sql`.
2. `20261004175817_notification-jobs.sql`.

New public tables: `notification_preferences`, `devices`, `reminders`, and `notifications`.
New private table: `notification_jobs`.
RLS restricts personal reads. Clients cannot read push tokens or write job state directly.
Notification uniqueness binds recipient, source, and occurrence. Delivery uniqueness adds source version and device.
Preference and reminder versions guard pending work without creating another delivery identity.

No migration reached a database in this chat. Syntax parsing does not validate grants, triggers, or transaction behavior.
Generated database types remain absent. Do not replace them with hand-written declarations labeled as generated output.

Added package: `expo-notifications@57.0.21`, matching the installed Expo SDK's compatibility map.
The app config adds its native plugin. Authorized development builds need `EXPO_PUBLIC_EAS_PROJECT_ID` and platform push credentials.
The package manifests retain all feature dependencies. npm regenerated the combined lockfile.

The disposable stack uses project ID `deseo-integration` and ports 55620–55629.
`supabase/tests/prepare-integration-stack.ps1` creates its local configuration and source junctions without starting Docker.
All race harnesses default to port 55621. Messages and Notifications also enforce that port.

Cron dispatches and checks receipts every minute. Daily horizon refresh runs at 00:07 UTC.
Vault needs `notification_function_url` and `notification_worker_secret`; neither was provisioned.
The function URL is an environment-specific `/functions/v1` base.
Functions use runtime Supabase server credentials and optional `EXPO_ACCESS_TOKEN`.

## Account-module dependencies for Chat 06

- `profiles.user_id`, account status, and timezone drive recipient authorization and quiet hours.
- Profile timezone changes update the notification preference timezone and refresh pending work.
- `pair_members.left_at` and `pairs.state` drive cancellation and current access.
- `devices.session_id` must retain its link to live `auth.sessions` checks after account-control changes.
- Account deletion must revoke sessions and disable the profile before cleanup proceeds.
- Device and profile foreign keys cascade notification records and private jobs during final deletion.
- Export must exclude push tokens, device secrets, worker secrets, and provider metadata.
- Personal reminders and preferences belong only to their owner. Partner reminder settings must remain private.
- Existing event timezones remain authoritative for all-day reminders. A pair-zone edit must not reinterpret them silently.
- Keep the public `revokeCurrentDevice` call in Auth sign-out or provide an equally verified lifecycle path.
- Keep private-cache resets and memory cleanup before showing a different account or pair.

## Verification

Test ratings preceded implementation. No new test rated below 90 was added.

| Check | Importance | Command or action | Result |
|---|---:|---|---|
| Combined baseline | Required | `npm run verify:mobile` | 37 suites, 174 tests passed |
| Final mobile | 95–100 | `npm run verify:mobile` | Typecheck, lint, 45 suites, 200 tests passed |
| Edge functions | 100 | Pinned Deno 2.9.6, tests listed below | 33 tests passed, including 15 notification tests |
| Edge types | Required | Deno check for all five memory/notification entry points | Passed |
| Native compatibility | Required | Cached Expo Doctor 1.20.4, network enabled | 21/21 passed |
| Native JavaScript | Required | `npx --no-install expo export --platform android --platform ios --output-dir dist` | Both exports passed |
| Race harness types | 100 | TypeScript command below | All five harnesses passed |
| SQL syntax | Required | Pinned pglast parse | 98 statements and 46 function definitions parsed |
| SQL fixtures | 98–100 | Fixture plan counts | 38 device and 81 job assertions; zero executed |
| Backend startup | Required | Dedicated-stack `supabase start` | Failed: Docker engine pipe absent |
| Live pgTAP | 98–100 | `supabase test db` | Blocked; connection refused |
| SQL concurrency | 100 | Existing races plus `test:notifications:race` | Not run; no local backend |
| Maestro flows | 98–100 | Files under `apps/mobile/e2e` | Authored; not run |
| Stage B/C devices | Required | Two real development builds | Not run |
| Real push/receipts | 100 | Authorized platform setup and devices | Not run |

Edge checks used the cached executable at:
`C:/Users/Corashina/AppData/Local/npm-cache/_npx/7a40be787520bede/node_modules/deno/deno.exe`.

```powershell
deno test --allow-env --frozen --config supabase/functions/deno.json supabase/functions/finalize-memory/validate-jpeg.test.ts supabase/functions/memories.test.ts supabase/functions/notifications.test.ts
deno check --frozen --config supabase/functions/deno.json supabase/functions/finalize-memory/index.ts supabase/functions/get-memory-media/index.ts supabase/functions/cleanup/index.ts supabase/functions/dispatch-notifications/index.ts supabase/functions/check-push-receipts/index.ts
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --types node --target es2022 --module esnext --moduleResolution bundler supabase/tests/pairing-races.test.ts supabase/tests/planning-races.test.ts supabase/tests/messages-races.test.ts supabase/tests/memories-races.test.ts supabase/tests/notification-races.test.ts
```

npm wrapper commands are in package.json. The first npm network attempt failed inside the sandbox; cached Deno ran the checks.
Expo Doctor's network checks passed after approved network access.
An initial CommonJS-mode race typecheck was unsuitable for existing top-level await. The documented ES module command passed.

## Review and remaining work

Independent review found three important issues. The source-version UI regression failed before its fix and passed afterward.
SQL changes address lost deferred work during token and preference changes. Their new regression assertions remain unrun.
The zero-offset timing issue remains open. Review found no deferred minor issue.

Continue this chat before starting Chat 06:

1. Resolve and test the zero-offset timing rule.
2. Start Docker and replay the combined schema in the disposable integration stack.
3. Run all SQL, concurrency, advisor, and generated-type checks. Fix failures before accepting this baseline.
4. Run both native permission flows, denied-permission planning, quiet hours, real push, and receipt checks.
5. Complete Stage B and Stage C on two devices, including disconnect and source-edit races.

Chat 06 may inspect these source interfaces. This checkpoint is not a verified backend baseline for downstream acceptance.
Keep the worktree and its `.superpowers` verification logs until these checks finish.

Reference contracts: [Expo push delivery](https://docs.expo.dev/push-notifications/sending-notifications/),
[Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/),
and [Maestro permissions](https://docs.maestro.dev/reference/commands-available/setpermissions).
