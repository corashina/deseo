# Chat 03: Messages and notes

## Identity

- Scope: one durable conversation, unread cursors, encrypted drafts, and pinned notes.
- Master Tasks 11–12: feature source implemented. Backend validation, device checks, and shared integration remain open.
- Branch: `codex/deseo-03-messages`.
- Worktree: `C:\Users\Corashina\Documents\Projects\deseo\.worktrees\deseo-03-messages`.
- Base commit: `7564cd0e13bfa9df492603f5e1f6a0919aeddfcf`.
- Core source commit: `118fdf553ed3c37ffe2ff01a9cf2b68e2de08485`. The base adds the core handoff.
- Tested code commit: `fd445b274af9799039205e073183d6da379e14a1`.
- Integration branch: `codex/deseo-integration`.
- This report is committed separately after the code commit.

## Status

- Code status: **In progress**. Feature source and mobile checks are complete. Required backend checks remain unrun.
- Device status: **Pending**, Android and iOS. JavaScript exports passed. No native binary or device was tested.
- Release status: **Blocked**. Backend validation, native checks, shared integration, and inherited core gaps remain open.

The owner explicitly chose: “Implement Messages; defer backend validation.”
This permits feature implementation from the recorded core commit. It does not establish a verified security baseline.
No database, remote service, push job, native build, deployment, or store submission was created.

## Implemented behavior

These flows exist in source. Mobile tests cover client behavior. Database behavior has static checks only.

- `/messages` guards account and pair access. Signed-out and unpaired users return to the root route.
- The conversation loads 50 rows per page using a server timestamp and UUID cursor.
- New arrivals preserve loaded history, including arrivals during older-page requests and command-triggered refreshes.
- Sending, Sent, and Failed states preserve the meaning of an uncertain response.
- A failed send retains its original client UUID and text for retry.
- A confirmed send enters its scoped cache before refresh. A refresh failure cannot undo that confirmation.
- Draft text and pending sends use existing encrypted account/pair storage.
- Restart restores uncertain sends as failed. Durable reconciliation removes confirmed or deleted sends without automatic resending.
- Offline users can edit drafts. Sending and retry require a connection.
- Message text supports 4,000 Unicode code points. Up to 100 pending sends can remain in a draft.
- Visible durable rows advance a private, monotonic read cursor while the screen is active, focused, and online.
- Unread counts include partner messages only. The feature exposes no partner read receipts.
- Each author can pin one own message. Replacement is atomic; a pair can have two notes.
- Deletion clears text and pins. A retained UUID and hash prevent old retries from restoring deleted messages.
- Notes use the same message record. A note can open in full or focus the reply composer.
- Native rows expose author, time, status, links, and own-message actions.
- The composer uses safe-area and keyboard handling. These behaviors still need device checks.
- Realtime events request durable reads. Event payloads do not supply conversation content.

Chat 05 owns the Messages tab, unread badge, Today note, and message alerts.
This branch does not change shared layouts, Today, shared controls, or other feature modules.

### Review decisions

The saved design and master tasks supplied the accepted scope. Product design approval was not repeated.
The direct request for multiple agents took precedence over the embedded inline-only instruction.
Backend and client data work had separate file ownership. A separate agent reviewed the complete feature.

One review and fix pass addressed loaded-history loss, uncertain-send text, and inconsistent Unicode limits.
Regression tests failed before their fixes and passed afterward.

The standalone route prevents automatic tab exposure before Chat 05 owns navigation.
Server timestamps are assigned after the pair lock. Each send advances beyond existing timestamps by at least one microsecond.
Deletion uses the existing profile-version signal because deleted rows fail message RLS and cannot notify prior readers.
Native access, live SQL, Auth races, Realtime delivery, and advisors remain unverified.

## Changed files

| Area | Files |
|---|---|
| Route | `apps/mobile/src/app/messages.tsx` |
| Data and state | `apps/mobile/src/features/messages/{commands,queries,types,schema,notes,model,drafts,useMessageDraft,realtime,index}.ts` |
| Components | `apps/mobile/src/features/messages/components/{Composer,MessageRow,NoteCard}.tsx` |
| Screen | `apps/mobile/src/features/messages/screens/MessagesScreen.tsx` |
| Mobile tests | `commands.test.ts`, `queries.test.ts`, `model.test.ts`, `drafts.test.ts`, `useMessageDraft.test.tsx`, `screens/MessagesScreen.test.tsx` within the feature |
| Migrations | `supabase/migrations/20261004155449_messages.sql`, `supabase/migrations/20261004155450_pinned-notes.sql` |
| Backend tests | `supabase/tests/messages.test.sql`, `supabase/tests/notes.test.sql`, `supabase/tests/messages-races.test.ts` |
| Report | `docs/handoffs/03-messages.md` |

No package, lockfile, native configuration, core contract, or generated-type file changed.
The feature uses installed Expo Router navigation exports, TanStack Query, Zod, and the shared encrypted storage.

## Public interfaces

Import through `apps/mobile/src/features/messages/index.ts`.
Shared `Id`, `Page`, and `Result` come from `apps/mobile/src/lib/result.ts`.

```ts
type Id = string;
type MessageCursor = { createdAt: string; id: Id };
type Message = MessageCursor & {
  pairId: Id;
  authorId: Id;
  clientId: Id;
  body: string;
  pinnedAt: string | null;
  version: number;
};
type SendMessageInput = { pairId: Id; clientId: Id; body: string };
type Page<T> = { items: T[]; nextCursor: string | null };
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: CommandError };

listMessages(pairId: string, before?: string): Promise<Page<Message>>;
getUnreadCount(pairId: string): Promise<number>;
reconcileMessageSends(pairId: string, clientIds: readonly string[]): Promise<{
  messages: Message[];
  deletedClientIds: Id[];
}>;
sendMessage(input: SendMessageInput): Promise<Result<Message>>;
deleteMessage(id: string, commandId: string): Promise<Result<{ id: string }>>;
setReadCursor(pairId: string, cursor: MessageCursor): Promise<Result<MessageCursor>>;
pinMessage(id: string, commandId: string): Promise<Result<{ id: string }>>;
unpinMessage(id: string, commandId: string): Promise<Result<{ id: string }>>;
listPinnedNotes(pairId: string): Promise<Message[]>;
encodeMessageCursor(cursor: MessageCursor): string;
decodeMessageCursor(value: string): MessageCursor;

type NoteCardProps = {
  message: Message;
  authorName: string;
  onReply(): void;
  onOpen?(): void;
};
// Also exported: MessagesScreen (no props), NoteCard, and messageKeys.
```

`Message`, `MessageCursor`, `SendMessageInput`, and `NoteCardProps` are exported types.
The reconciliation result type is inferred by consumers; its named type remains internal.

`listMessages` returns newest rows first. It reads 51 rows to detect another 50-row page.
The JSON cursor contains `createdAt` and `id`. Keep the timestamp string intact to preserve microseconds.
`listPinnedNotes` returns up to two rows, newest `pinnedAt` first, then descending `id`.
`reconcileMessageSends` accepts up to 100 client UUIDs and returns only the current author's sends.
Queries reject on validation, transport, or access errors. Commands return the shared `Result` union.

The unchanged `CommandError` has `code`, optional `field`, optional `message`, and optional `retryAt`.
Its codes are `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `CONFLICT`, `INVITE_UNAVAILABLE`, `ALREADY_PAIRED`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, and `RETRYABLE`.
Messages adds no codes. Its domain checks use access, validation, and conflict codes.
A changed body with an existing client UUID returns `CONFLICT`. A deleted send retry returns `FORBIDDEN`.

### Query keys and cancellation

```ts
messageKeys.all(accountId, pairId)
// ['messages', accountId, pairId]
messageKeys.conversation(accountId, pairId)
// ['messages', accountId, pairId, 'conversation']
messageKeys.unread(accountId, pairId)
// ['messages', accountId, pairId, 'unread']
messageKeys.notes(accountId, pairId)
// ['messages', accountId, pairId, 'notes']
```

Commands invalidate message queries. Delete, pin, and unpin also invalidate Today queries.
Cursor writes invalidate unread queries only. Confirmed sends update the author's account/pair conversation cache before invalidation.
All requests use shared `captureQueryScope`, its abort signal, and scope checks before consuming responses.
The shared core clears caches and scoped storage after account or pair access changes.

The draft key is `messages` within existing account/pair storage.
Its value is `{ body, pending: [{ clientId, body, state: 'sending' | 'failed' }] }`.
Fetched message rows are never stored in drafts. Serialized writes use the existing `registerDraftFlush` hook.
Draft loading changes persisted `sending` entries to `failed`. Retry preserves the UUID and exact text.
Reconciliation runs after durable reads and reconnect. It does not resend automatically.

## Database and dependencies

Apply the four core migrations first, ending with `20261004151123_end-pair-core.sql`.
Then apply `20261004155449_messages.sql`, followed by `20261004155450_pinned-notes.sql`.
No migration was applied to a local or shared database during this chat.

### Tables and access

- `public.messages` holds text, ownership, client UUID, payload hash, timestamps, deletion state, and version.
- Unique `(pair_id, author_id, client_id)` binds a retry UUID to one durable message.
- Index `(pair_id, created_at DESC, id DESC)` supports keyset reads.
- The partial unique pin index permits one live pinned message per author and pair.
- Immutable identity and body checks prevent message edits. Deletion replaces text with null.
- Pair deletion cascades message rows. Author membership uses the existing pair-members foreign key.
- Active-member RLS excludes deleted rows. Authenticated clients have selected-column read grants and no direct writes.
- The payload hash is not granted to authenticated clients.
- `private.conversation_reads` stores each member's private cursor. Its RLS permits only that member to read it.
- Read cursors have no direct client writes and are excluded from the Realtime publication.
- `public.messages` joins the existing Realtime publication.

Public RPCs are invoker wrappers. Private implementations use restricted grants and an empty `search_path`.
They depend on core actor/session checks, pair locks, membership checks, and command receipts.
Current access is checked before receipt replay. Pin replacement and deletion share the pair lock.
Deletion increments member profile versions to trigger the existing invalidation channel.

### RPC names and parameters

| RPC | Parameters | Success data |
|---|---|---|
| `send_message` | `p_pair_id uuid, p_client_id uuid, p_body text` | Message row |
| `delete_message` | `p_message_id uuid, p_command_id uuid` | `{ id }` |
| `set_read_cursor` | `p_pair_id uuid, p_created_at timestamptz, p_message_id uuid` | `{ created_at, id }` |
| `get_unread_count` | `p_pair_id uuid` | `{ count }` |
| `reconcile_message_sends` | `p_pair_id uuid, p_client_ids uuid[]` | `{ messages, deleted_client_ids }` |
| `pin_message` | `p_message_id uuid, p_command_id uuid` | `{ id }` |
| `unpin_message` | `p_message_id uuid, p_command_id uuid` | `{ id }` |

Each RPC returns the shared JSON `Result` shape.
Message rows expose `id`, `pair_id`, `author_id`, `client_id`, `body`, `created_at`, `pinned_at`, and `version`.
The client schema converts these fields to camel case. RPC results omit hashes and deleted text.
There is no message `updated_at`: text is immutable, and `version` identifies pin and deletion changes.

### Local project and ports

No Messages stack was started. The planned isolated project ID is `deseo-03-messages`.
Ports `55420–55439` were available during the initial audit. Recheck them before starting a stack.
No local port override is committed.

The inherited config still uses project `deseo` and core ports.
These include API `54321`, database `54322`, shadow `54320`, Studio `54323`, mail `54324`, analytics `54327`, and inspector `8083`.
The disabled pooler specifies `54329`.

Inspect current CLI override support before starting the isolated stack.
Use API `55421`, database `55422`, shadow `55420`, Studio `55423`, mail `55424`, analytics `55427`, and inspector `55428`.
Use pooler `55429` if enabled. Assign any further enabled service within the reserved range.
Keep local configuration changes out of integration commits.

The race harness accepts only local HTTP hosts on port `55421`.
It reads `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, and `SUPABASE_TEST_SERVICE_ROLE_KEY`.
The URL defaults to `http://127.0.0.1:55421`. Keep key values outside the repository and report.
The harness creates synthetic accounts and removes only its own pair and accounts.

No packages or native settings were added. Combined database type generation remains assigned to Chat 05.

## Verification

Environment: Windows, PowerShell, Node `24.18.0`, npm `11.16.0`.
Commands ran in this worktree unless another directory is named.
Test scores were assigned before implementation. Only scores of 90 or above were implemented.

| Check | Importance | Exact command or action | Actual result |
|---|---|---|---|
| Reproducible install | Existing setup | `npm ci --ignore-scripts --no-audit --no-fund` | Passed; 1,019 packages installed, no manifest or lockfile changes |
| TypeScript | Existing check | `npm run typecheck` | Passed |
| Module boundaries and lint | Existing check | `npm run lint` | Passed |
| Mobile suite | 100 security/retry/cursor; 98 drafts; 95 paging/native interaction; 94 pins | `npm run test:mobile -- --testMatch '**/src/**/*.test.ts' '**/src/**/*.test.tsx'` | Passed: 20 suites, 98 tests; 38 new tests |
| Race harness types | 100/94 | `node_modules/.bin/tsc.cmd --noEmit --target es2022 --module esnext --moduleResolution bundler --types node --strict --skipLibCheck supabase/tests/messages-races.test.ts` | Passed |
| Static migration and fixture parsing | Supports backend tests | Python `pglast==7.9`, script below | Passed: 37 migration statements, seven PL/pgSQL bodies; fixture plans match 62 and 21 assertions |
| Android and iOS JavaScript bundles | Existing check | In `apps/mobile`: `npx expo export --platform android --platform ios --output-dir dist` | Passed for both platforms; native binaries were not built |
| Staged whitespace | Existing check | `git diff --cached --check` | Passed before the code commit |
| pgTAP security, retries, cursors, and pins | 100/94 | After isolated setup: `npx supabase test db supabase/tests/messages.test.sql supabase/tests/notes.test.sql` | Not run; owner deferred backend validation |
| Auth and transaction races | 100/94 | With isolated test keys: `node --experimental-strip-types --test supabase/tests/messages-races.test.ts` | Not run; no isolated stack or test keys |
| Live schema, Realtime, RLS, and advisors | 100 | Apply migrations; run core tests, schema lint, and security/performance advisors; verify two-member Realtime delivery | Not run |
| Native route and interaction | 95 | Open `deseo-dev://messages` on Android and iOS; verify keyboard, safe areas, restart, offline retry, and 200% text | Not run; no device or emulator available |

The default Jest glob finds no tests under this Windows worktree path.
The explicit `--testMatch` override above runs the full suite without changing shared configuration.

Regression coverage includes late account responses, lost acknowledgements, duplicate UUIDs, cursor ordering, and timestamp precision.
It also covers draft restoration, arrivals during paging, loaded-history retention, command refreshes, signed-out routing, and Unicode limits.
Mobile mocks verify client behavior. They do not establish live database or device behavior.

The Android export is `apps/mobile/dist/_expo/static/js/android/entry-04556c5328e3a482c6b11b6c4ccc1fb3.hbc`.
The iOS export is `apps/mobile/dist/_expo/static/js/ios/entry-2b18d5f8f20ea5c98043c1f469bd1635.hbc`.
These ignored local artifacts are JavaScript bundles. No native build ID exists.

### Static SQL check

The parser used the bundled Python runtime and a temporary installation of `pglast==7.9`.
The script below ran against the tested code commit. Parsing does not verify PostgreSQL execution or access rules.

```python
import os
import pathlib
import re
import sys

sys.path.insert(0, os.path.join(os.environ['TEMP'], 'deseo-messages-parser-20261004'))
from pglast import parse_sql, parse_plpgsql

for name in ['20261004155449_messages.sql', '20261004155450_pinned-notes.sql']:
    content = (pathlib.Path('supabase/migrations') / name).read_text(encoding='utf-8')
    statements = parse_sql(content)
    bodies = 0
    for match in re.finditer(r'create function[\s\S]*?\$\$;', content, re.I):
        if 'language plpgsql' in match.group().lower():
            parse_plpgsql(match.group())
            bodies += 1
    print(name, len(statements), 'statements;', bodies, 'PL/pgSQL bodies')

fixture = pathlib.Path('supabase/tests/fixtures/setup.sql').read_text(encoding='utf-8')
for name in ['messages.test.sql', 'notes.test.sql']:
    content = (pathlib.Path('supabase/tests') / name).read_text(encoding='utf-8')
    parse_sql(content.replace('\\ir fixtures/setup.sql', fixture))
    expected = int(re.search(r'select plan\((\d+)\)', content).group(1))
    actual = len(re.findall(r'^select (?:ok|is|matches|throws_ok|has_table|has_function)\(', content, re.M))
    assert actual == expected
    print(name, actual, 'assertions; execution pending')
```

## Integration instructions

1. Read the core, planning, messages, and memories handoffs.
2. Resolve deferred core and Messages security and transaction checks before treating this branch as a verified baseline.
3. Check that this branch descends from `7564cd0e13bfa9df492603f5e1f6a0919aeddfcf`.
4. Confirm that changes after `fd445b274af9799039205e073183d6da379e14a1` contain only this report.
5. Integrate feature branches in the guide's order: 02, 03, then 04.
6. Check migration version uniqueness and preserve core-before-messages ordering.
7. Rebuild a disposable integration database and run all core and feature backend tests.
8. Regenerate database types from the combined schema.
9. Add the Messages tab using the exported `MessagesScreen`.
10. Preserve guarded direct-route access and avoid duplicate tab entries.
11. Use `getUnreadCount(pairId)` with `messageKeys.unread(accountId, pairId)` for the unread badge.
12. Use `listPinnedNotes(pairId)` with `messageKeys.notes(accountId, pairId)` for notes.
13. Show the first returned note on Today with `NoteCard`, an author name, and a reply action.
14. Route note replies to Messages. Provide `onOpen` when the full note must be available from Today.
15. Connect message alerts and cancellation to durable message IDs and current pair access.
16. Verify background, reconnect, deletion, and notification navigation on both native platforms.

No feature branches were merged here. No known shared-file conflict was introduced.
Chat 05 must connect shared invalidation while Messages is closed, including unread and Today refreshes.
The route is `deseo-dev://messages` with the current development scheme. No temporary navigation was added.

## Remaining work

- **Backend validation:** run migrations, core tests, 83 new pgTAP assertions, Auth races, Realtime checks, and advisors.
- **Environment:** provide an isolated local stack and synthetic test keys. Docker and Podman were unavailable during this chat.
- **Native checks:** provide Android and iOS builds and devices. Android tools and a default SDK were unavailable.
- **Usability:** check keyboard overlap, safe areas, screen reader actions, large text, link handling, and note expansion.
- **Persistence:** verify encrypted restart recovery, uncertain sends, airplane mode, account switching, and pair revocation on devices.
- **Chat 05:** add tabs, unread badges, Today notes, alerts, generated schema types, and combined verification.
- **Chat 06:** include messages, tombstones, and read cursors in export, retention, and account-deletion workflows.
- **Inherited core gaps:** backend acceptance, network invitation limits, and recorded dependency advisories remain open in `01-core.md`.
- **Release inputs:** device evidence, notification setup, and owner release review remain required under the later briefs.

Chat 05 is the next integration owner after all parallel reports are available.
This branch is suitable for source review and integration preparation under the owner's deferral.
It is not a verified backend baseline. Master Tasks 11–12 remain incomplete until shared integration and acceptance checks pass.
