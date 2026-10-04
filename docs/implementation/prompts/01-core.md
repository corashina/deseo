# Chat 01: Core app

**Master tasks:** 1–5. **Start:** First. **Parallel work:** None.

**Output:** Two accounts can sign in, pair, share an event, and disconnect.

## Materials

- [Execution guide](../CHAT_GUIDE.md), especially the core contract.
- [Master Tasks 1–5](../../superpowers/plans/2026-10-04-deseo-implementation.md#stage-a-two-people-share-one-event).
- [Architecture and target folders](../../architecture/ARCHITECTURE.md).
- [Data contract](../../architecture/DATA.md), sections 1–6 and fresh verification.
- [Screens](../../product/SCREENS.md), sections 3–7 and common states.
- [Style](../../../STYLE.md), [selected icon](../../design/icons-round-2/icon-05-two-voices.png), and [mobile reference](../../design/mobile.jpg).
- [Development setup](../../engineering/DEVELOPMENT.md) and [testing](../../engineering/TESTING.md).

Needed tools: Node/npm, Expo development builds, local Supabase, and Docker.
Android and iOS checks need suitable build and device access.

## Ownership and checks

Establish the integration branch, workspace, native theme, shared controls, auth, pairing, calendar, and Today.
Create only folders needed by these tasks. Later chats add the other features.

Record exact shared exports before parallel work starts. Include result types, paging, sessions, drafts, membership, routes, and query keys.

Prove these cases:

- Verified account restoration and encrypted storage failure.
- Concurrent invitation acceptance with two slots and a third account.
- Private-event access, shared-event updates, dates, and conflicts.
- Access revocation after disconnect, sign-out, and account change.
- Native rendering, safe areas, keyboard use, and large text.

Automated security checks must pass before Chats 02–04 start.
Record unavailable physical checks as pending.

**Handoff:** `docs/handoffs/01-core.md`.

## Prompt

```text
Implement Chat 01, Core app, for Deseo.
Project: C:\Users\Corashina\Documents\Projects\deseo

Read AGENTS.md and docs/implementation/prompts/01-core.md first.
Read docs/implementation/CHAT_GUIDE.md and its common materials.
Use the saved design and master Tasks 1–5 as this chat's accepted scope.
Use superpowers:executing-plans for inline execution.
Do not repeat product brainstorming or create other chats or agents.

Inspect current files, Git state, installed tools, and package versions.
Preserve existing work and design assets.
Initialize Git if this project still has no repository.
Commit the relevant documentation baseline before product changes. Exclude secrets and unrelated files.
Create or reuse the integration branch described in CHAT_GUIDE.md.
Record its actual name and starting commit.

Implement the native foundation, email-code authentication, encrypted sessions, pairing, calendar, and Today.
Complete one working flow before adding the next layer.
Apply STYLE.md and the selected icon 05.
Check current official Expo and Supabase documentation before installing dependencies.
Apply the Supabase skill to backend work.

Resolve core dependencies in order.
Create verification records and command receipts before commands use them.
Start with self-only profile access. Add partner access after membership tables exist.
Do not reference task lists from pairing before Chat 02 introduces them.
Export the concrete core contracts required by CHAT_GUIDE.md.
Define Page<T> with items and nextCursor.
Do not add shells for unimplemented features.

Rate tests before writing them. Implement only tests rated at least 90.
Run the plan's relevant database, race, native, and type checks.
Use real local test accounts. Do not fake persistence or verification results.
Record unavailable device checks separately and continue independent work.

Commit tested code, then write docs/handoffs/01-core.md using the handoff template.
Commit that report separately. Include exact exports, commands, results, and remaining inputs.
Report the final branch tip and the shared baseline for Chats 02, 03, and 04.
Do not provision remote services, deploy, submit builds, or contact real users.
```
