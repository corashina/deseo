# Chat 04: Private memories

**Master tasks:** 13–14. **Start:** After 01. **Parallel work:** 02 and 03.

**Output:** Private photo memories with captions, dates, safe retries, and cleanup.

## Materials

- [Execution and ownership guide](../CHAT_GUIDE.md).
- Read the future core report at `docs/handoffs/01-core.md`.
- [Master Tasks 13–14](../../superpowers/plans/2026-10-04-deseo-implementation.md#task-13-private-memory-upload).
- [Memory screens](../../product/SCREENS.md#10-memories).
- [Photo contract](../../architecture/DATA.md#8-photos), access rules, and record limits.
- [Style](../../../STYLE.md), [mobile reference](../../design/mobile.jpg), and [testing](../../engineering/TESTING.md).

Needed materials: isolated storage/database, synthetic JPEG/PNG/HEIC samples, malformed files, and device photo-picker access.
Use owned or synthetic photos for testing.

## Ownership and checks

Own memories, feature routes, memory finalization, initial media cleanup, migrations, and tests.
Keep image preparation inside memories until Chat 06 adds its second caller.

Prove quota races, file validation, metadata removal, retry recovery, author controls, and membership revocation.
Verify private media URLs expire within the contract limit.
Test cleanup after interrupted uploads and object deletion failures.

Export feed, latest-memory, and authorized-media queries.
Chat 05 adds the Memories tab and Today's latest memory.
Chat 06 extends cleanup for full account deletion and retention.

**Handoff:** `docs/handoffs/04-memories.md`.

## Prompt

```text
Implement Chat 04, Private memories, for Deseo.
Project: C:\Users\Corashina\Documents\Projects\deseo

Read AGENTS.md and docs/implementation/prompts/04-memories.md.
Read CHAT_GUIDE.md, its common materials, and docs/handoffs/01-core.md.
Use the saved design and master Tasks 13–14 as this chat's accepted scope.
Use superpowers:executing-plans inline. Do not create other chats or agents.

Verify the core baseline and recorded checks before coding.
Create or reuse an isolated Git worktree from that exact baseline.
Use branch codex/deseo-04-memories unless an existing assigned branch already serves this work.
Perform all product edits in that worktree.
Use a separate local Supabase project and available ports, following CHAT_GUIDE.md.
Inspect existing exports and dependencies. Apply the Supabase skill to backend work.

Implement private memory reservations, photo preparation, uploads, validation, and atomic finalization.
Apply DATA.md limits for photo count, bytes, dimensions, storage quota, and signed URLs.
Keep captions and upload retry state encrypted locally.
Build the dated feed, detail, author edits/deletion, and deliberate save-copy flow.
Add abandoned-upload and deleted-object cleanup with bounded retries.
Keep shared fetched content and image caches memory-only as specified.

Own only memories, feature routes, image functions, cleanup, migrations, tests, and your handoff.
Use the documented dependency and generated-type exceptions only when required.
Do not edit shared layouts, Today, core contracts, shared UI, or other feature modules.
Keep image preparation in memories until the account module provides a second caller.
Export tested screens and feed/media queries for Chat 05.
Test feature routes through native deep links without temporary navigation or fake data.
Leave the Memories tab and Today's latest memory to Chat 05.

Rate tests before writing them. Implement only tests rated at least 90.
Run relevant storage, database, worker, retry, native, and type checks.
Record actual results and unavailable device checks separately.
Do not edit shared status documents or master task checkboxes in this parallel branch.

Commit tested code, then write docs/handoffs/04-memories.md using the handoff template.
Include exact exports, storage rules, migrations, function dependencies, and integration instructions.
Commit the report separately. Report the final branch tip.
Leave this branch for Chat 05 to integrate. Do not merge other feature branches.
Do not provision remote services, deploy, submit builds, or contact real users.
```
