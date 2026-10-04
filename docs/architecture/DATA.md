# Data and access contract

Status: Proposed schema contract. This document contains no executed SQL.

## 1. Shared conventions

Use UUID record IDs. Use UTC `timestamptz` values for instants and `date` values for calendar dates.

Use `created_by`, `created_at`, `updated_at`, and an integer `version` on mutable content records.

Each pair record carries `pair_id`. Composite foreign keys prevent references to a record from another pair.

Include current account status in access checks. Include active membership and pair status for shared content reads.

Generate database types from the actual schema. Keep database checks authoritative when client validation duplicates them.

## 2. Records

| Record | Required fields and constraints |
|---|---|
| `profiles` | `user_id`, display name 1–40, IANA timezone, locale, avatar path, `account_status` |
| `pairs` | ID, state `pending/active/ended`, timezone, created/ended timestamps, purge deadline |
| `pair_members` | Pair, user, stable slot `a/b`, joined/left timestamps; unique active membership per user |
| `pair_invites` | Pair, token hash, creator, expiry, accepted/revoked time; only one live invite per pending pair |
| `events` | Pair, author, owner `a/b/together`, visibility `shared/private`, title, temporal fields, optional location/description |
| `date_ideas` | Pair, author, title 1–120, note ≤1,000, HTTPS link ≤2,048, state `saved/planned/archived`, linked event |
| `task_lists` | Pair, name 1–40, creation time; General list exists once per pair |
| `tasks` | Pair, list, title 1–200, optional assignee, optional due date, completed time/person, version |
| `messages` | Pair, author, body 1–4,000, server timestamp, client UUID, optional pinned time |
| `conversation_reads` | Pair, user, last seen `(created_at,id)` cursor; private to the reader |
| `memories` | Pair, author, memory date, caption ≤1,000, state `pending/published/deleting`, version |
| `memory_photos` | Pair, memory, uploader, object paths, order 0–4, dimensions, byte counts, validation state |
| `reminders` | User, exactly one event or task reference, choice/instant, active state, version |
| `notification_preferences` | User, message alerts, default event reminder, quiet-hour times and timezone |
| `devices` | User, installation ID, Expo token, platform, permission state, last seen, revoked time |
| `notifications` | Recipient, pair, source reference, generic kind, created time, read time |
| `notification_jobs` | Notification, device, due time, source version, attempt count, lease, provider ticket, state |
| `export_jobs` | Requester, pair scope, access mode, request/expiry time, progress cursor, result parts, state |
| `deletion_jobs` | Account or ended pair, phase, cursor, attempts, state, error code |
| `command_receipts` | Actor, pair, command UUID, command type, result ID, result version, expiry |
| `verification_proofs` | Account, action, hashed random proof, expiry, consumed time; private server-only record |

Keep invites, proofs, delivery jobs, command receipts, and deletion internals outside the exposed schema.

Store avatars privately. Only their owner and current partner can retrieve them.

No separate table exists for Today, notes, countdowns, or a relationship score.

## 3. Temporal fields

Timed event: `starts_at`, `ends_at`, `timezone`; require `ends_at > starts_at`.

All-day event: `start_date`, `end_date_exclusive`, `timezone`; require a positive date span.

A check constraint permits exactly one temporal representation, never both.

Yearly important dates use a one-day all-day event with `repeat = yearly` and a stored month/day.

Other events use `repeat = none`. Yearly edits affect the series; there are no occurrence overrides.

Calendar queries expand yearly dates only inside the requested range, limited to 366 days per request.

Include events that overlap the requested range, even when they start before it. Treat the query end as exclusive.

Luxon converts wall times to instants. Detect invalid and ambiguous times before committing a timed event.

All-day reminder times use 09:00 in the event timezone. Yearly dates follow the February 28 leap-day rule.

Task due dates are dates in the pair timezone. A task reminder stores an explicit chosen instant.

## 4. Access matrix

| Record | Read | Create | Change / delete |
|---|---|---|---|
| Profile | Self and current partner; email remains self-only | Authenticated self | Self |
| Pair/membership | Current members | Verified unpaired account | Named pairing commands only |
| Invitation | Creator sees metadata; verified token recipient sees limited inviter data | Pending-pair creator | Creator revoke; join transaction consume |
| Shared event | Active pair members | Either member | Either member |
| Private event | Author only | Author as sole owner | Author only |
| Date idea/list/task | Active pair members | Either member | Either member |
| Message/note | Active pair members | Authenticated author | Author deletes/pins; no sent-text edits |
| Published memory | Active pair members | Either member | Author only |
| Pending photo/memory | Author only | Author with reserved upload | Author or validated job |
| Reminder | Owner only | Owner for visible source | Owner; source changes invalidate jobs |
| Notification/device/preference | Owner only | Owner or verified job | Owner or verified job |
| Export job | Requester only | Verified requester | Worker changes progress; requester downloads |
| Ended-pair content | No normal reads | None | Author export endpoint only, within retention window |

Moving content to another pair is forbidden. Changes to author, pair, and membership slot are server-controlled.

Changing an event to Private requires its author. Reset owner to the author and revoke the partner's reminders.

Changing it back to Shared requires the author and explicit visibility confirmation.

RLS covers direct reads, reads through views, subscriptions, and storage objects. Test every path with a third account.

Use `security_invoker` views if a view is required. Do not expose unrestricted views or storage buckets.

## 5. Pair transactions

### Create and regenerate

`create_pair(timezone, command_id)` creates a pending pair and membership atomically.

`create_invite(pair_id, command_id)` generates a cryptographically random 12-character Crockford code and returns it once.

Store only its hash. Regeneration revokes the prior live invitation. Expire it after 24 hours.

The same token works in a link and manual entry. Treat it as a secret, not an account identifier.

Apply verified-account and network-level rate limits to validation and acceptance. Start with five failed attempts per 15 minutes per account.

### Join

`accept_invite(token, command_id)` derives the actor from verified authentication.

Lock the relevant account rows in sorted ID order, then the pair and invitation rows.

Check account status, expiry, revocation, self-join, active membership, and available slot within the same transaction.

Insert slot `b`, mark the pair active, consume the invitation, and record the command result.

Task 6 adds an active-pair trigger that creates the General list within this transaction.
Its schema change also initializes General lists for existing pairs.
The earlier pairing function must not depend on task tables before they exist.

A unique partial index on active membership backs the account check. A unique pair/slot constraint caps capacity.

Acquire the same locks during invite regeneration and pair termination. A failed transaction leaves no partial membership.

Idempotent replay by the same actor returns the original pair. A different actor cannot reuse that result.

Cancel an empty pending pair before joining another. A pending pair cannot contain published shared content.

## 6. Content commands and conflicts

Create commands accept `command_id`. Durable content IDs also use client UUIDs where appropriate.

Use a unique `(actor, command_id, command_type)` receipt. Keep receipts for 30 days.

Never create a new UUID for a retry. After receipt expiry, stable content IDs still prevent duplicate creates.

Edit commands accept `expected_version`. Update only when it matches; return `CONFLICT` otherwise.

Return a stable result shape: `ok`, `data`, `error.code`, and optional `error.field`.

Error codes: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `CONFLICT`, `INVITE_UNAVAILABLE`, `ALREADY_PAIRED`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `RETRYABLE`.

`set_task_completed(task_id, completed, expected_version, command_id)` sets a desired state, not a toggle.

Lists have unique case-insensitive names within a pair. General cannot be deleted or renamed.

Delete other lists only when empty. Move tasks to General through an explicit user action before removing a nonempty list.

`pin_message(message_id, command_id)` unpins the author's prior note and pins the selected message atomically.

`plan_date_idea(idea_id, event_input, expected_version, command_id)` creates the shared event and links the idea atomically.

Creating or editing a source record updates pending reminder work within the same transaction or an authoritative database trigger.

## 7. Messages and realtime

Use `(created_at,id)` keyset pagination. Timestamps come from the server; UUIDs break ties.

Unique `(pair_id, author_id, client_id)` prevents duplicate sends after timeouts.

Keep failed local sends outside the confirmed message query. Reconcile by client ID after reconnect.

Subscribe only while the app is active. On reconnect, fetch the durable rows before updating unread state.

Update the viewer's private read cursor when messages are visible. Never send a read receipt to the partner.

Pair closure emits only a revocation signal. Revalidate access and remove content from screen and cache.

Do not send message bodies through an unrestricted broadcast channel.

## 8. Photos

Limit each memory to five photos. Limit a prepared photo to 5 MiB and 2,560 pixels on its longest side.

Accept prepared JPEG files only. Convert supported native selections before upload and remove metadata.

Keep each original camera file on the person's device. The accepted prepared image becomes Deseo's full image.

Create a separate thumbnail up to 512 pixels. Validate actual byte type, dimensions, size, and absence of location metadata.

Reject invalid files on the server. Do not trust extension, client MIME type, or client-reported dimensions.

Use a maintained file metadata parser. Do not write a custom image decoder or cryptographic format.

Reserve storage against a 1 GiB pair quota, including pending uploads. Return a clear quota message before upload.

Paths follow `pair_id/memory_id/photo_id/{full,thumb}.jpg`. Check all IDs against authorized database rows.

Upload with no overwrite. Finalize only when every declared file exists and passes validation.

The finalization transaction checks current membership and marks the memory published once. Retries return that same result.

An object uploaded after disconnect cannot publish. Cleanup removes abandoned reservations and files after 24 hours.

Issue media links for at most 60 seconds. Clear app image caches on disconnect and sign-out.

An already issued link may work until expiry. Explain this technical limit in the privacy design; never claim instant copy revocation.

Delete memory metadata visibility first. Retry storage removal until completion. Keep failed cleanup visible to operations.

## 9. Reminders and push

Create one notification for each recipient and source occurrence. Create a delivery job for each active opted-in device.

Use a unique `(recipient, source, occurrence, source_version, device)` delivery key.

Cron claims due jobs every minute using leases and row locks. Workers skip locked jobs.

A daily job materializes the next 90 days of yearly reminder occurrences. Source edits refresh the same horizon immediately.

Use the occurrence's local date in its unique key. Skip past reminder times and show that state to the requester.

The server expands yearly dates for agenda queries and reminder jobs. Native screens format those returned occurrences.

Recheck current account status, pair membership, source existence/version, reminder preference, device status, and quiet hours before sending.

Cancel superseded unsent jobs when the event changes, the task completes, or the pair ends.

Use generic payload text: **You have an update in Deseo.** Put only an opaque notification ID in the data payload.

Open the notification through an authenticated fetch. A revoked source shows an unavailable state.

Retry transient provider failures at one, five, and fifteen minutes, bounded by source expiry.

Check provider receipts after submission. Remove tokens that return `DeviceNotRegistered`.

Distinguish queued, submitted, provider-accepted, failed, expired, and canceled. Provider acceptance does not prove device display.

A network timeout after provider acceptance can cause a duplicate push. Do not claim exactly-once delivery.

Never submit the same known accepted provider ticket again. App content remains idempotent regardless of push duplication.

Quiet hours use the recipient's timezone. Defer messages until quiet hours end; expire event pushes after event start.

Persist notifications for 30 days. Do not maintain a second calendar inside the notification system.

## 10. Export, disconnect, and deletion

### Fresh verification

A server function verifies a fresh email code against the authenticated account's actual email.

It returns a random, single-use proof bound to that account and the requested action, valid for ten minutes.

Store only the proof hash. Consume it atomically with the sensitive command. Do not trust client timestamps or JWT refresh times.

Check the JWT session ID against the current Auth session for protected reads and commands, including global sign-out enforcement.

A deletion-page user completes the same sign-in and action verification. No proof grants access to another account.

### Export while paired

Fresh email verification permits export of records the requester can currently read, including shared content and their private events.

Produce UTF-8 JSON plus media files. Preserve record dates and authorship. Exclude tokens, device secrets, and the partner's private events.

Use bounded parts of at most 100 MiB. Persist progress between worker invocations to stay within platform execution limits.

Store export parts privately for 24 hours. Authorize each download and issue at most 60-second links.

Recheck access during each export step and download. Cancel shared export parts if the pair ends before download.

### End pair

Require fresh verification within ten minutes and explicit confirmation.

Atomically mark the pair ended, close memberships, revoke invitations, cancel unsent jobs, and invalidate shared export jobs.

Former members can request a new author-only export for 30 days. Filter every record and photo by original author.

Allow a new pair immediately after termination. Never copy the former pair's records into it.

Purge ended-pair records and media after 30 days. Completed external downloads cannot be recalled.

### Delete account

Use the same verified command from the native app and the public deletion page.

Mark the account disabled first. RLS and jobs check this state even if an old JWT remains valid.

Revoke Auth sessions and end the active pair. Deny content requests immediately after the disabling transaction.

Purge the deleting person's authored content and private files within 24 hours. Retry partial failures through `deletion_jobs`.

The former partner retains only their own 30-day export access. Purge the Auth account after dependent cleanup succeeds.

Keep content-free job status under an opaque receipt for seven days so the deletion page can show progress.

Backups follow the selected hosting retention. Verify and disclose that retention before launch; do not promise immediate backup erasure.

## 11. Indexes and limits

- Unique active `pair_members(user_id)` and unique `(pair_id, slot)`.
- Index content foreign keys and common `(pair_id, created_at, id)` feed access.
- Index timed events by pair and start; private reads also constrain author.
- Index tasks by pair, list, completion, and due date.
- Index pending jobs by due time; index cleanup work by state and expiry.
- Index reminder source IDs and unique command/message identifiers.
- Page lists at 50 rows. Limit agenda reads to 366 days.

Inspect query plans with realistic synthetic pair data. Avoid indexing every field without a query that needs it.

## 12. Required adversarial cases

Simultaneous invitation joins, one user joining two pairs, stale tokens, cross-pair IDs, private-event probes, duplicate sends, and stale edits.

Also test uploads after disconnect, old media links, disabled accounts with valid JWTs, duplicate workers, and exports racing with deletion.

See [TESTING.md](../engineering/TESTING.md) for importance ratings and required evidence.
