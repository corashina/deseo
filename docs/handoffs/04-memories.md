# Chat 04: Private memories

## Identity

- Scope: private photo memories, uploads, feed, author controls, and initial media cleanup.
- Master Tasks 13–14: source implemented. Backend and device acceptance remain pending.
- Branch: `codex/deseo-04-memories`.
- Worktree: `C:\Users\Corashina\Documents\Projects\deseo\.worktrees\deseo-04-memories`.
- Base commit: `7564cd0e13bfa9df492603f5e1f6a0919aeddfcf`.
- Tested code commit: `021d6b48c7724488bf31540424412a01cb7b63f3`.
- Integration branch: `codex/deseo-integration`. Chat 05 integrates this branch.

## Status

- Code status: **In progress**. Source checks pass; required backend acceptance remains pending.
- Device status: **Pending**, Android and iOS.
- Release status: **Blocked** by backend, device, and inherited core release checks.

The owner explicitly approved implementation while backend checks remain pending.
This overrides the core handoff's coding gate. It does not establish backend security or release acceptance.
The branch remains separate. No remote services, deployments, native builds, or real users were created.

## Implemented behavior

These flows exist in source. Local unit checks do not establish real Storage or native behavior.

- Choose one to five photos, prepare JPEG full images and thumbnails, and preserve originals.
- Store captions, dates, retry identifiers, and upload state in encrypted account/pair drafts.
- Reserve quota before immutable uploads. Inspect uncertain uploads, validate each photo, then publish the complete memory.
- Read a dated feed and details. Authors can edit dates/captions and delete memories.
- Request private media links with a 60-second lifetime. Use memory-only fetched image caching.
- Save a library copy after an explicit action. Explain that saved copies remain after deletion or disconnect.
- Remove abandoned uploads and deleted files through leased cleanup jobs with bounded retries.

Chat 05 owns the Memories tab and Today's latest memory. Chat 06 owns export, retention, and full account cleanup.

### Review decisions

The saved design and master tasks supplied the accepted scope. Product brainstorming was not repeated.
The direct request for agents overrode the prompt's embedded no-agent instruction.
Native dependency configuration, test discovery, and verification scripts were required scope exceptions.
Independent database, Edge, and final reviews ran. All reported source findings were fixed and reviewed again.
Fixes cover Storage session identity, transaction locks, service outages, cleanup retries, cache eviction, and active save-copy files.
Backend and device checks remain separate acceptance work under the owner's explicit instruction.

## Changed files

| Area | Paths |
|---|---|
| Feature | `apps/mobile/src/features/memories/` |
| Routes | `apps/mobile/src/app/memories/` |
| Schema | `supabase/migrations/20261004155832_memories.sql` |
| Edge | `supabase/functions/{_shared,finalize-memory,get-memory-media,cleanup}/` |
| Edge setup | `supabase/functions/{deno.json,deno.lock,.env.example}`, `supabase/config.toml` |
| Backend tests | `supabase/tests/memories*.{sql,ts}`, `supabase/tests/prepare-memory-stack.ps1` |
| Dependencies and checks | Root manifests/lockfile, mobile manifest/config/Jest setup, feature import boundaries |

Shared layouts, Today, core APIs, shared controls, and other features were not edited.
Jest discovery uses relative patterns because absolute Windows paths under `.worktrees` found no tests.

## Public interfaces

Import through `apps/mobile/src/features/memories/index.ts`.
Types: `Memory`, `MemoryPhoto`, `MemoryInput`, `MemoryDraft`, `LocalMemoryPhoto`, `MemoryReservationInput`, `MemoryMedia`, and `MemoryInspection`.
`MemoryInput` is `{memoryDate,caption}`. Dates use `YYYY-MM-DD`; captions permit 1,000 characters.
`Memory` contains IDs, author, date, caption, state, version, timestamps, expiry, and ordered photos.
`MemoryPhoto` contains IDs, immutable full/thumb paths, declared byte counts, dimensions, order, and validation state.

| Export | Parameters | Result |
|---|---|---|
| `prepareMemoryDraft` | `{draft,assets,assertCurrent}` | `Promise<MemoryDraft>` |
| `reserveMemory` | `input: MemoryReservationInput, commandId: string` | `Promise<Result<Memory>>` |
| `uploadMemoryPhoto` | `reservation: Memory, localFile: {id,fullUri,thumbUri}` | `Promise<Result<MemoryPhoto>>` |
| `inspectMemory` | `memoryId: string` | `Promise<MemoryInspection>` |
| `finalizeMemory` | `memoryId: string, commandId: string` | `Promise<Result<Memory>>` |
| `updateMemory` | `id, input: MemoryInput, expectedVersion, commandId` | `Promise<Result<Memory>>` |
| `deleteMemory` | `id, expectedVersion, commandId` | `Promise<Result<{id:string}>>` |
| `listMemories` | `pairId: string, cursor: string\|null = null` | `Promise<Page<Memory>>` |
| `latestMemory` | `pairId: string` | `Promise<Memory\|null>` |
| `getMemory` | `pairId: string, id: string` | `Promise<Memory>` |
| `getMemoryMedia` | `photoId: string, variant: 'full'\|'thumb' = 'full'` | `Promise<Result<MemoryMedia>>` |
| `saveMemoryCopy` | `photoId: string` | `Promise<void>` |
| `ensureMemoryLifecycle` | None | Idempotent process setup |
| `reconcileMemoryAccess` | None | `Promise<void>` |

Reads throw `AppError`; commands return `Result<T>`. `MemoryMedia` is `{url,expiresAt}`.
Errors use core codes: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `CONFLICT`, `QUOTA_EXCEEDED`, and `RETRYABLE`.
Deletion requires `expectedVersion`, matching core content deletion rules. Chat 05 must use this actual signature.
Page cursors are JSON strings containing `{memoryDate,id}`. Pages contain at most 50 memories.

`memoryKeys.all(accountId,pairId)` starts with `['memories',accountId,pairId]`.
Suffixes are `feed`, `latest`, `detail,id`, and `media,photoId,variant`.
`subscribeMemorySignals(accountId,pairId,onRevocation)` returns `Promise<() => void>`.
The callback is required. It must hide mounted photos and clear image memory after a deletion signal.
The process lifecycle owns this subscription and callback. Integrated screens normally need only `ensureMemoryLifecycle()`.

Screen exports: `MemoriesScreen()`, `MemoryDetailScreen({memoryId})`, `MemoryFormScreen({memoryId?})`, `MemoryLayout()`, and `MemoryAccessBoundary({children})`.
`MemoryCard` and `MemoryImage` are feature-owned presentation exports. Use the actual component prop types during integration.
Routes and screens require the current Auth and pair providers.
No fetched records or signed URLs are persisted. Stable memory, photo, and command IDs survive retry through encrypted drafts.
Retry checks remote reservation state before requiring local files. Cache eviction cannot block confirmation of a completed publication.

### Edge functions

All functions accept POST. Responses use the core `Result<T>` shape and `Cache-Control: no-store`.
The app endpoints validate the JWT, live Auth session, account status, and current pair membership.

| Function | Body | Success data |
|---|---|---|
| `finalize-memory` | `{action:'inspect',memoryId}` | `{memory,photos:[{id,full,thumb,validated}]}` |
| `finalize-memory` | `{action:'validate',memoryId,photoId}` | `MemoryPhoto` |
| `finalize-memory` | `{action:'publish',memoryId,commandId}` | `Memory` |
| `get-memory-media` | `{photoId,variant?:'full'\|'thumb'}` | `{url,expiresAt}` |
| `cleanup` | Empty body; secret Bearer header | `{completed,retried}` |

Each validation request decodes one full image and thumbnail. Publication waits for all photo validations.
The validator uses ExifReader `4.46.0` and jpeg-js `0.4.4`. Supabase JS is pinned to `2.117.2`.
An envelope check rejects metadata segments, malformed framing, and trailing bytes before full JPEG decoding.
The Deno lockfile pins transitive dependencies. The development runner is Deno `2.9.6`.

Runtime variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, and `MEMORY_CLEANUP_SECRET`.
The cleanup secret needs at least 32 random characters. Keep it outside source and mobile configuration.
Function JWT gateway verification is disabled because these handlers verify their own credentials.

## Database and dependencies

Apply the four core migrations first, then `20261004155832_memories.sql`.
The migration depends on core profiles, pairing locks, Auth session checks, and command receipts.
Generated database types remain pending until a local database can run.

Public tables are `memories`, `memory_photos`, and `memory_access_revocations`.
Private tables are `memory_reservations`, `memory_tombstones`, and `memory_cleanup_jobs`.
Clients cannot write metadata tables directly. RLS permits published pair reads and pending author reads.
Realtime publishes memories and content-free deletion signals for current members.

The private `memory-photos` bucket grants authenticated INSERT only.
It grants no client SELECT, UPDATE, or DELETE, including direct creation of arbitrary-lifetime signed URLs.
Paths are `pair_id/memory_id/photo_id/{full,thumb}.jpg`.
Upload with `upsert:false`, `contentType:'image/jpeg'`, and `metadata:{sessionId}` from the actual upload JWT.
The final Storage service write checks its owner, original live session, reservation, pair, and measured bytes.

Each memory permits 1–5 photos. Each full image and thumbnail permits 1–5,242,880 bytes.
Full dimensions permit 2,560 pixels per side. Thumbnails permit 512 pixels per side.
The 1 GiB pair quota includes pending, published, and deleting reservations until object removal succeeds.
Pending reservations expire after 24 hours. Pair closure queues pending reservations and prevents publication.
An issued media link can remain usable until expiry. Library copies cannot be revoked.

Client RPCs:

- `reserve_memory(p_input jsonb,p_command_id uuid)`.
- `get_memory(p_memory_id uuid)`.
- `list_memories(p_pair_id uuid,p_cursor jsonb=null,p_limit integer=50)`.
- `latest_memory(p_pair_id uuid)`.
- `update_memory(p_memory_id uuid,p_input jsonb,p_expected_version integer,p_command_id uuid)`.
- `delete_memory(p_memory_id uuid,p_expected_version integer,p_command_id uuid)`.
- `get_memory_media(p_photo_id uuid,p_variant text='full')`.

Reserve input is `{id,pairId,memoryDate,caption,photos:[{id,fullBytes,thumbBytes,width,height,thumbWidth,thumbHeight}]}`.
Update input is `{memoryDate,caption}`. Mutation and read RPCs return `Result<T>` JSON.
The media RPC returns `{bucket,path,expiresIn:60,photoId}` only after current authorization.

Service-only RPCs:

- `verify_memory_reservation(p_memory_id uuid,p_actor_id uuid,p_session_id uuid)`.
- `validate_memory_photo(p_memory_id uuid,p_photo_id uuid,p_actor_id uuid,p_session_id uuid,p_evidence jsonb)`.
- `publish_memory(p_memory_id uuid,p_actor_id uuid,p_session_id uuid,p_command_id uuid)`.
- `claim_memory_cleanup(p_limit integer=20)`.
- `complete_memory_cleanup(p_job_id uuid,p_lease_token uuid,p_error_code text=null)`.
- `retry_memory_cleanup(p_job_id uuid)`.

Photo evidence contains measured full/thumb byte counts and dimensions from the Edge decoder.
Validation stores immutable Storage object IDs. Publication rechecks these IDs and current access in one transaction.
Claims return `{id,memoryId,bucket,paths,leaseToken,attempt}[]`. Completion returns `{id,state}`.

Cleanup leases last five minutes. Claims and expiry sweeps cap each batch at 50 memories.
The Edge worker requests two jobs per invocation. Failures wait one, five, then fifteen minutes.
After five failed attempts, the worker retains a failed job for operations.
`retry_memory_cleanup` resets a retained failure after its cause is fixed.
Successful cleanup removes photo rows, captions, dates, reservations, and content-bearing receipts.
Private tombstones retain memory/pair/author UUIDs. Deletion signals retain memory/pair UUIDs and an operational timestamp.
Chat 06 must include these records in account and pair cleanup.

### Local stack

Project ID: `deseo-memories`. The helper creates ignored setup under `.superpowers/memories-backend`.
Ports: API 55521, database 55522, shadow 55520, Studio 55523, email 55524, analytics 55527, inspector 55528.
Pooler port 55529 is reserved but disabled. The helper stops if a required port already has a listener.

```powershell
./supabase/tests/prepare-memory-stack.ps1
npx supabase --workdir .superpowers/memories-backend start
npx supabase --workdir .superpowers/memories-backend db reset
npx supabase --workdir .superpowers/memories-backend test db
```

Supply local test keys outside the repository. Set `SUPABASE_TEST_URL=http://127.0.0.1:55521` for both race harnesses.
The memory harness rejects non-loopback hosts. Its synthetic fixtures are removed after the run.
Use the isolated SQL command above here. Root `npm run verify` targets the repository's default stack.
Serve functions with the isolated workdir and a private environment file.
Configure cleanup scheduling and failed-job monitoring before release. No scheduler was provisioned here.

### Native dependencies

Added `expo-image@57.0.5`, `expo-image-picker@57.0.20`, `expo-image-manipulator@57.0.20`, `expo-file-system@57.0.7`, and `expo-media-library@57.0.5`.
Native plugins add photo selection and save-copy permission text. Camera, microphone, and location-media access remain disabled.
A new native development build is required. Expo Go cannot validate the existing encrypted MMKV setup.

## Verification

| Check | Importance | Exact command or action | Actual result |
|---|---|---|---|
| Mobile types and boundaries | Required | `npm run typecheck`; `npm run lint` | Passed |
| Mobile regression suite | 90–100, declared before tests | `npm run verify:mobile` | 20 suites, 91 tests passed |
| Edge validation and workers | 100 | `npm run test:memories:functions` | 18 tests passed |
| Edge entrypoint types | Required | `npm run typecheck:memories:functions` | Passed |
| Dependency compatibility | Required | `npx expo-doctor` | 21/21 checks passed after native dependency changes |
| Android bundle | Required | From `apps/mobile`: `../../node_modules/.bin/expo.cmd export --platform android --output-dir ../../.superpowers/memories-export/android --max-workers 2` | Passed, 1,619 modules |
| iOS bundle | Required | From `apps/mobile`: `../../node_modules/.bin/expo.cmd export --platform ios --output-dir ../../.superpowers/memories-export/ios --max-workers 2` | Passed, 1,537 modules |
| SQL syntax | 100 | Pinned pglast command below | 74 migration statements, 30 function definitions; fixtures 126/64 statements |
| Race harness syntax | 100 | `node --experimental-strip-types --check supabase/tests/memories-races.test.ts` | Passed |
| Race harness lint | 100 | `npx eslint supabase/tests/memories-races.test.ts` | Passed |
| Race harness types | 100 | `npx tsc --noEmit --skipLibCheck --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --types node supabase/tests/memories-races.test.ts` | Passed |
| Isolated setup | Required | `./supabase/tests/prepare-memory-stack.ps1` | Configuration prepared; PowerShell syntax passed |
| Live SQL tests | 100 | `npx supabase --workdir .superpowers/memories-backend test db` | Not run: connection refused at `127.0.0.1:55522` |
| Live race tests | 100 | `npm run test:memories:race`, with local URL 55521 | Not run: local test keys unavailable |
| Native journeys | 95–100 | Deep links, picker, retries, sign-out, and save copy on Android/iOS | Not run: no native builds or devices |
| Whitespace | Required | `git diff --cached --check` | Passed |

Six memory suites add 31 tests. The final complete mobile run passed 20 suites and 91 tests.
SQL test fixtures use synthetic accounts and photos. The progressive JPEG fixture contains a synthetic 16×16 image.

SQL parsing used Python and pinned `pglast==7.9`, installed in a temporary directory.
Run from this worktree after that parser setup:

```powershell
$memoryPython = 'C:/Users/Corashina/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$memorySqlParser = Join-Path $env:TEMP 'deseo-sql-parser'
& $memoryPython -m pip install pglast==7.9 --target $memorySqlParser --upgrade --no-cache-dir --disable-pip-version-check
& $memoryPython -c "import sys,os,json; sys.path.insert(0,os.path.join(os.environ['TEMP'],'deseo-sql-parser')); from pathlib import Path; from pglast import parse_sql; from pglast.parser import parse_plpgsql_json; q=Path('supabase/migrations/20261004155832_memories.sql').read_text(); print(len(parse_sql(q)), 'SQL statements'); print(len(json.loads(parse_plpgsql_json(q))), 'function definitions'); [print(str(p),len(parse_sql(''.join(line for line in p.read_text().splitlines(True) if not line.startswith(chr(92))))),'statements') for p in Path('supabase/tests').glob('memories*.sql')]"
```

The environment is Windows with Node `24.18.0`, npm `11.16.0`, and Supabase CLI `2.119.0`.
Docker and a native device were unavailable. No native build ID exists for this work.
SQL parsing proves syntax only. It does not prove function behavior, RLS, Storage registration, or concurrency.
Mocked Edge/client tests do not replace backend or device checks.

## Integration instructions

1. Review this branch and retain the backend gate.
2. Apply the memories migration after core, then configure the three Edge functions.
3. Merge the scoped dependency, Jest, ESLint, and verification-script changes with parallel feature work.
4. Wire `MemoriesScreen` within `MemoryAccessBoundary` into the Memories tab. Keep feature routes for creation, details, and edits.
5. Use `latestMemory`, `memoryKeys.latest`, and guarded media exports for Today's tile. Wrap private memory views in `MemoryAccessBoundary`.
6. Start `ensureMemoryLifecycle()` once from the integrated app shell. It owns memory and deletion-signal subscriptions.
7. Run real backend and native checks before declaring Stage C complete.

Routes: `/memories`, `/memories/new`, `/memories/[memoryId]`, and `/memories/[memoryId]/edit`.
Feature routes use their own guarded layout. Root and tab layouts remain Chat 05's responsibility.
Captions, dates, conflict text, and retry IDs use encrypted `memories:new` and `memories:edit:<memory UUID>` drafts.
An encrypted `memories:files` intent registry records ownership and survives core draft purges.
Temporary photos use `Paths.cache/deseo-memories`. Destinations are registered before copying or downloading.
Startup removes unregistered files from this root and direct files in the known native picker/manipulator cache directories.
These native sweeps pause while selection or preparation runs. Chat 06 must review ownership before adding another image caller.
Unknown native cache locations remain a device check; the feature does not delete external source files.

Query resets cancel work and hide photos. They do not prove account or pair loss.
The controller verifies access before admitting resumed picker results or removing another scope's registered files.
Confirmed access loss removes drafts and files. Failed file removal remains registered for retry.
Core sign-out cannot await this feature's native file cleanup. Cleanup follows its signals and retries after restart.
This source does not prove synchronous device erasure or recovery after Android destroys the JavaScript process during selection.
An OS-accepted library save cannot be revoked after access changes.
Live save-copy operations retain their temporary files during same-owner reconciliation.
Confirmed access loss cancels downloads and waits for active native work before deleting their files.
This live ownership is not persisted. After restart, abandoned temporary copies become eligible for cleanup.

## Remaining work

- Backend: replay migrations, run core/memory SQL and races, inspect query plans, and run security/performance advisors.
- Storage: verify service-role final registration, rejected-upload cleanup, exact bytes, immutable writes, quota races, and link expiry.
- Workers: test object-removal failures, lost acknowledgements, expired leases, failed-job recovery, and scheduled invocation.
- Devices: open deep links in Android/iOS builds; test picker cancellation, backgrounding, process death, and restart recovery.
- Photos: test owned JPEG, PNG, and supported HEIC input; verify prepared bytes contain no location metadata.
- Privacy: test two accounts, two pairs, deletion signals, stale links, sign-out, account switching, and image-cache clearing.
- Usability: test large text, photo permissions, offline retries, edit conflicts, and deliberate save-copy notices.
- Integration: Chat 05 adds the tab and Today tile. Chat 06 extends image preparation for avatars and adds retention/export.
- Release: keep the unresolved core handoff requirements, including dependency advisory review.

Chat 05 may use this source under the owner's explicit pending-backend decision.
This branch is not a backend-accepted or device-accepted release baseline.
