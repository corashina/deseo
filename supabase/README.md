# Local backend

Migrations, Edge functions, SQL tests, and local fixtures. Use Supabase CLI 2.119.0.

## Commands

Use the root scripts in [Development](../docs/DEVELOPMENT.md#scripts). Start Docker first.

```sh
npm run backend:start
npm run backend:reset
npm run functions
npm run test
npx supabase db advisors --local --type all --fail-on warn
npm run gen:types
```

`supabase/config.toml` sets project `deseo` on ports 55720–55729.
`npm run backend:reset` deletes local data. Back up the database and storage first.
`npm run gen:types` writes `packages/domain/src/database.types.ts`. Do not edit that file by hand.
`supabase/dev/functions.env` sets the browser origins and public API address for local Edge functions.
The race test reads local keys from `supabase status`. It rejects other API addresses and removes its own fixtures.

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
| `end_pair` | `p_pair_id,p_verification_proof,p_command_id` | `{endedAt}` |

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

Send `POST /functions/v1/verify-sensitive-action` with the original account Bearer token.
Send `{action:'end_pair'}` to request a fresh code. The result contains `retryAt`.
Send `{action:'end_pair',code:'123456'}` to verify that code. The result contains `proof,expiresAt`.

The server verifies the account's actual Auth email. It checks the original live session again before issuing a proof.
The server revokes the unused session created by email verification.
The database stores only the random proof hash. Pair closure consumes the proof within the closure transaction.

## Refresh signals

Subscribe to the caller's `profiles` row with `user_id=eq.<account-id>`.
Pair acceptance and closure change that row's `updated_at` and `version`.
Making an event private also changes its former reader's profile version.
The content-free `event_access_revocations` table lists drafts that reader must remove before reopening protected screens.
Pair closure keeps the caller's self-profile readable after shared access ends.
Refetch account and pair context after each signal, foreground transition, and reconnect.

Subscribe to `events` for the current pair. Treat changes as refresh signals and refetch through RLS.
The publication also includes each caller's content-free membership row.

## Open checks

Account invitation limits allow five failed attempts per 15 minutes.
Production network invitation limits need a trusted gateway and a spoofing test.
Client-supplied `X-Forwarded-For` cannot prove a client's network address.
Auth provides its own network limits for email verification.

Later migrations must attach reminder and export cancellation to pair closure after those tables exist.
