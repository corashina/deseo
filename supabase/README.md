# Local backend

Chat 01 adds accounts, pairing, one-off events, and pair closure.

The CLI generated migration names in dependency order. Use Supabase CLI 2.119.0.

## Commands

Run these commands from the repository root after you install and start Docker.

```powershell
npx supabase start
npx supabase db reset --local
npx supabase functions serve --env-file supabase/functions/.env.local
npx supabase test db --local
node --experimental-strip-types supabase/tests/pairing-races.test.ts
npx supabase db advisors --local --type all --fail-on warn
npx supabase gen types --local --schema public
```

Use the `deseo` project on ports 55720–55729. It contains the combined development data.

`db reset --local` deletes this data. Back up the database and storage before a reset.

Write generated schema output to `apps/mobile/src/lib/database.types.ts` after migrations pass.
Do not replace that file with hand-written schema types.

Set `SUPABASE_PUBLISHABLE_KEY` in the ignored `supabase/functions/.env.local` file.
The local Edge runtime supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Set these environment values before the race harness:

| Name | Value |
|---|---|
| `SUPABASE_TEST_URL` | Local API URL; default `http://127.0.0.1:55721` |
| `SUPABASE_TEST_PUBLISHABLE_KEY` | Local publishable key |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | Local server key |

The harness creates real Auth accounts and concurrent requests. It deletes only its own fixtures.
It rejects remote URLs. It does not print account credentials.

## Public RPCs

Commands return `{ok:true,data:T}` or `{ok:false,error:{code,field?}}`.
Reads from exposed tables use current-session RLS checks.

| RPC | Parameters | Success data |
|---|---|---|
| `get_session_context` | None | `{userId,account:Account|null}` |
| `save_profile` | `p_display_name,p_timezone,p_locale,p_expected_version=null` | `Account` |
| `get_pair_context` | None | `PairContext` |
| `create_pair` | `p_timezone,p_command_id` | `{pairId}` |
| `create_invite` | `p_pair_id,p_command_id` | `{token,expiresAt,alreadyDelivered}` |
| `preview_invite` | `p_token` | `{pairId,inviterName,timezone,expiresAt}` |
| `accept_invite` | `p_token,p_command_id` | `{pairId}` |
| `cancel_pending_pair` | `p_pair_id,p_command_id` | `{endedAt}` |
| `list_agenda` | `p_pair_id,p_from,p_to` | Event rows |
| `create_event` | `p_input,p_command_id` | Event row |
| `update_event` | `p_event_id,p_input,p_expected_version,p_command_id` | Event row |
| `delete_event` | `p_event_id,p_expected_version,p_command_id` | `{id}` |
| `end_pair` | `p_pair_id,p_command_id` | `{endedAt}` |

`Account` has `id,displayName,timezone,locale,status,version`.

`PairContext.status` selects one shape:

- `unpaired`: `{status}`.
- `pending`: `{status,pairId,timezone,member:{userId,displayName,slot:'a'},invite:{expiresAt}|null}`.
- `active`: `{status,pairId,timezone,members:[{userId,displayName,slot:'a'|'b'}]}` with two members.
- `ended`: `{status,pairId,endedAt,ownExportDeadline}`.

Event inputs use `id,pair_id,title,owner,visibility,timezone,location,description`.
Supply `starts_at,ends_at` or `start_date,end_date_exclusive`.
One-off events use `repeat:'none'`. Private-to-shared changes require the author and `confirm_shared:true`.
Event rows also include `created_by,created_at,updated_at,version`.
Agenda ranges use dates in the pair timezone. The end date is exclusive. The limit is 366 days.

Retry with the same command UUID and payload. A changed payload returns `CONFLICT`.
An invitation receipt stores metadata. Its replay returns `token:null,alreadyDelivered:true`.
Use a new command UUID to generate another invitation.

## Fresh verification

Call `end_pair` from a session that signed in during the last ten minutes. Other sessions get `FORBIDDEN`.
Send a code with `signInWithOtp({email,options:{shouldCreateUser:false}})`.
Verify it with `verifyOtp` in a separate client without saved sessions. Send `end_pair` with that client, then sign it out.
A retry with the same command UUID replays the receipt from any session of the same account.

## Refresh signals

Subscribe to the caller's `profiles` row with `user_id=eq.<account-id>`.
Pair acceptance and closure change that row's `updated_at` and `version`.
Making an event private also changes its former reader's profile version.
The content-free `event_access_revocations` table lists drafts that reader must remove before reopening protected screens.
Pair closure keeps the caller's self-profile readable after shared access ends.
Refetch account and pair context after each signal, foreground transition, and reconnect.

Subscribe to `events` for the current pair. Treat changes as refresh signals and refetch through RLS.
The publication also includes each caller's content-free membership row.

## Verification status

Security and concurrency tests have importance 100/100.

Four SQL suites contain 67 assertions. Parsing cannot prove constraints, policies, transactions, or Realtime delivery.

On 2026-10-04, PostgreSQL parsing passed for all migrations and PL/pgSQL function bodies.
Deno 2.9.6 typechecking passed for the Edge function. TypeScript checking passed for the race harness.

Database tests and advisors could not connect to `127.0.0.1:54322`.
Type generation reported missing Docker and Podman. The owner deferred Docker setup.
The race harness stopped because local test keys were absent. No database test has passed yet.

Account invitation limits allow five failed attempts per 15 minutes.
Production network invitation limits require a trusted gateway and a spoofing test.
Client-supplied `X-Forwarded-For` cannot prove a client's network address.
This deployment check remains open. Auth provides its separate network limits for email verification.

Later migrations must attach reminder and export cancellation to pair closure after those tables exist.
