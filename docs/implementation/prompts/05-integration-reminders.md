# Chat 05: Integration and reminders

**Master tasks:** 8–10, plus deferred shared work from 6–7 and 11–14.
**Start:** After 02, 03, and 04 are ready. **Parallel work:** None.

**Output:** One app with five tabs, complete Today content, and durable notifications.

## Materials

- [Integration checklist](../CHAT_GUIDE.md#7-integration-checklist-for-chat-05).
- Read `docs/handoffs/01-core.md` through the three feature reports.
- [Master Tasks 8–10](../../superpowers/plans/2026-10-04-deseo-implementation.md#task-8-device-permission-and-notification-preferences).
- [Reminder and push contract](../../architecture/DATA.md#9-reminders-and-push).
- [Screen guide](../../product/SCREENS.md), shell, Today, permissions, and common states.
- [Style](../../../STYLE.md), [testing](../../engineering/TESTING.md), and [release inputs](../../engineering/RELEASE.md).

Needed materials: three feature branches, a disposable integration database, and authorized push credentials for device verification.
Real push checks need Android and iOS development builds.

## Ownership and checks

Own branch integration, dependency reconciliation, combined database types, shared navigation, and notification code.
Merge Planning, Messages, then Memories. Do not discard one branch's dependency or schema changes.

Finish the Tasks, Messages, and Memories tabs. Connect their queries to Today.
Add reminder actions, unread indicators, notification preferences, message alerts, and notification navigation.

Prove source edits cancel obsolete jobs. Prove disconnect blocks workers and notification navigation.
Cover token reassignment, quiet hours, DST, worker leases, retries, receipts, and duplicate provider submission risks.
Run the complete Stage B and Stage C checks against the combined app.

**Handoff:** `docs/handoffs/05-integration-reminders.md`.

## Prompt

```text
Implement Chat 05, Integration and reminders, for Deseo.
Project: C:\Users\Corashina\Documents\Projects\deseo

Read AGENTS.md and docs/implementation/prompts/05-integration-reminders.md.
Read CHAT_GUIDE.md, its common materials, and all handoffs from Chats 01–04.
Use the saved design, master Tasks 8–10, and deferred integration as this chat's accepted scope.
Use superpowers:executing-plans inline. Do not create other chats or agents.

Inspect actual branch tips, baseline ancestry, outstanding changes, and verification evidence.
Work on the recorded integration branch in its own checkout.
Do not reset feature worktrees or change unrelated files.
Follow CHAT_GUIDE.md's integration checklist in order.
Merge Chat 02, then Chat 03, then Chat 04.
Resolve conflicts from actual feature contracts and DATA.md.
Reconcile package manifests. Regenerate the lockfile and combined database types.
Resolve migration collisions before rebuilding a disposable integration database.
Never rewrite schema history already applied to a shared environment.

Finish all five tabs and Today's tasks, important date, pinned note, and latest memory.
Wire unread state, feature actions, route guards, and cache invalidation.
Implement master Tasks 8–10 using the integrated source records.
Apply the Supabase skill to backend work.
Add contextual permissions, preferences, device ownership, reminder jobs, and message alerts.
Implement quiet hours, leases, retries, receipt checks, expiry, and safe notification navigation.
Cancel obsolete jobs after source changes, completion, deletion, and disconnect.
Do not claim guaranteed or exactly-once push display.

Rate tests before writing them. Implement only tests rated at least 90.
Run combined feature, database, concurrency, worker, native, and type checks.
Check the Stage B and Stage C acceptance flows against this integrated build.
Use available authorized push credentials. Report missing credentials or devices without inventing success.
Update master checkboxes only for work with recorded evidence.

Commit tested code, then write docs/handoffs/05-integration-reminders.md using the handoff template.
Record the combined schema, exact account-module dependencies, results, and remaining device checks.
Commit the report separately. Report the final integration tip for Chat 06.
Do not provision remote services, deploy, submit builds, or contact real users.
```
