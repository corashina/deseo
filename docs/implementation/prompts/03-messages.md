# Chat 03: Messages and notes

**Master tasks:** 11–12. **Start:** After 01. **Parallel work:** 02 and 04.

**Output:** One durable conversation, unread state, and two possible pinned notes.

## Materials

- [Execution and ownership guide](../CHAT_GUIDE.md).
- Read the future core report at `docs/handoffs/01-core.md`.
- [Master Tasks 11–12](../../superpowers/plans/2026-10-04-deseo-implementation.md#stage-c-personal-content).
- [Messages and notes screens](../../product/SCREENS.md#9-messages-and-notes).
- [Data contract](../../architecture/DATA.md), sections 4, 6, and 7.
- [Message reference](../../design/mobile-messages.jpg), [style](../../../STYLE.md), and [testing](../../engineering/TESTING.md).

Needed materials: core auth/membership exports, encrypted draft storage, isolated database, and synthetic conversation fixtures.

## Ownership and checks

Own the messages module, its route, migrations, and tests.
Use one durable message record for conversation content and pinned notes.

Prove lost-response retries, duplicate sends, read cursors, reordered updates, and pagination during new arrivals.
Check draft restoration, keyboard behavior, own-note replacement, and cross-pair denial.

Export message, unread, and pinned-note queries.
Chat 05 adds the Messages tab, unread badge, Today note, and message alerts.
Do not implement push jobs or change shared layouts in this branch.

**Handoff:** `docs/handoffs/03-messages.md`.

## Prompt

```text
Implement Chat 03, Messages and notes, for Deseo.
Project: C:\Users\Corashina\Documents\Projects\deseo

Read AGENTS.md and docs/implementation/prompts/03-messages.md.
Read CHAT_GUIDE.md, its common materials, and docs/handoffs/01-core.md.
Use the saved design and master Tasks 11–12 as this chat's accepted scope.
Use superpowers:executing-plans inline. Do not create other chats or agents.

Verify the core baseline and recorded checks before coding.
Create or reuse an isolated Git worktree from that exact baseline.
Use branch codex/deseo-03-messages unless an existing assigned branch already serves this work.
Perform all product edits in that worktree.
Use a separate local Supabase project and available ports, following CHAT_GUIDE.md.
Inspect existing exports and dependencies. Apply the Supabase skill to backend work.

Implement durable messages, keyset paging, read cursors, and Sending/Sent/Failed states.
Preserve encrypted drafts and failed client IDs across restart.
Reconcile successful retries without duplicate messages.
Implement one own pinned message per member, with atomic replacement and deletion handling.
Build accessible message rows and a keyboard-safe composer using the existing UI controls.

Own only messages code, its route, migrations, tests, and your handoff.
Use the documented dependency and generated-type exceptions only when required.
Do not edit shared layouts, Today, core contracts, shared UI, or other feature modules.
Export tested screens and message, unread, and note queries for Chat 05.
Test feature routes through native deep links without temporary navigation or fake data.
Leave tab wiring, Today's note, unread badges, and push alerts to Chat 05.

Rate tests before writing them. Implement only tests rated at least 90.
Run relevant database, retry, pagination, storage, native, and type checks.
Record actual results and unavailable device checks separately.
Do not edit shared status documents or master task checkboxes in this parallel branch.

Commit tested code, then write docs/handoffs/03-messages.md using the handoff template.
Include exact exports, query keys, migrations, and integration instructions.
Commit the report separately. Report the final branch tip.
Leave this branch for Chat 05 to integrate. Do not merge other feature branches.
Do not provision remote services, deploy, submit builds, or contact real users.
```
