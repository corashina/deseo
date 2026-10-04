# Chat 06: Account controls

**Master tasks:** 15–17. **Start:** After 05. **Parallel work:** None.

**Output:** Complete settings, profile controls, export, disconnect, and account deletion.

## Materials

- [Execution guide](../CHAT_GUIDE.md).
- Read `docs/handoffs/05-integration-reminders.md` and its referenced feature interfaces.
- [Master Tasks 15–17](../../superpowers/plans/2026-10-04-deseo-implementation.md#stage-d-public-beta-and-complete-account-control).
- [Settings screens](../../product/SCREENS.md#11-settings).
- [Export and deletion contract](../../architecture/DATA.md#10-export-disconnect-and-deletion).
- [Photo contract](../../architecture/DATA.md#8-photos), [testing](../../engineering/TESTING.md), and [release](../../engineering/RELEASE.md).

Needed materials: the integrated content schema, private image pipeline, fresh verification, and synthetic export/deletion fixtures.

## Ownership and checks

Own account screens, profile commands, exports, deletion jobs, and complete retention cleanup.
Extract shared image preparation only when avatar and memory callers both use it.

Prove fresh verification, stale JWT denial, export scope, interrupted cleanup, and account switching.
Check timezone changes without shifting saved event instants.
Verify exports contain the expected records and files.
Verify deletion removes authored records and objects within the defined lifecycle.

Give Chat 07 the actual verified deletion interface, error states, origin controls, and status receipt contract.
Do not build a second deletion backend for the website.

**Handoff:** `docs/handoffs/06-account.md`.

## Prompt

```text
Implement Chat 06, Account controls, for Deseo.
Project: C:\Users\Corashina\Documents\Projects\deseo

Read AGENTS.md and docs/implementation/prompts/06-account.md.
Read CHAT_GUIDE.md, its common materials, and docs/handoffs/05-integration-reminders.md.
Read earlier feature handoffs when their interfaces affect export, images, or deletion.
Use the saved design and master Tasks 15–17 as this chat's accepted scope.
Use superpowers:executing-plans inline. Do not create other chats or agents.

Verify the integrated baseline and checks before coding.
Work serially on the recorded integration branch. Preserve unrelated changes.
Inspect current dependencies, schema, functions, and account/session checks.
Apply the Supabase skill to backend work.

Implement profile, pair, notification, help, version, and account settings.
Add private avatar upload using the validated image pipeline.
Extract shared image preparation now that avatars and memories both need it.
Implement verified email changes and timezone changes under the existing identity contract.
Keep disconnect and account deletion as distinct, deliberate actions.

Implement paired exports and ended-pair author-only exports for every existing content type.
Use bounded private export parts, resumable jobs, and access checks at each step.
Implement immediate account disabling, session revocation, and bounded deletion jobs.
Complete retention, object cleanup, deletion receipts, and expiry behavior from DATA.md.
Preserve the former partner's permitted own-content export period.
Use the existing fresh verification contract. Do not trust cached membership or stale JWTs alone.

Rate tests before writing them. Implement only tests rated at least 90.
Run account, export, deletion, storage, race, worker, native, and type checks.
Verify synthetic export integrity and final deletion of authored files.
Record actual results and unavailable physical checks separately.

Commit tested code, then write docs/handoffs/06-account.md using the handoff template.
Document the real external deletion interface needed by Chat 07.
Include verification, endpoint, origin, receipt, error, and rate-limit contracts without secrets.
Commit the report separately. Report the final integration tip for Chat 07.
Do not provision remote services, deploy, submit builds, or contact real users.
```
