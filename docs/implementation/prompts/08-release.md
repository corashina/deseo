# Chat 08: Verification and release preparation

**Master tasks:** 19–20. **Start:** After 07. **Parallel work:** None.

**Output:** A verified release candidate, or an exact list of remaining release blockers.

## Materials

- [Execution guide](../CHAT_GUIDE.md) and all implementation handoffs.
- [Master Tasks 19–20](../../superpowers/plans/2026-10-04-deseo-implementation.md#task-19-device-accessibility-and-product-review).
- [Testing contract](../../engineering/TESTING.md).
- [Release checklist](../../engineering/RELEASE.md).
- [Product acceptance](../../superpowers/specs/2026-10-04-deseo-design.md).
- [Screen behavior](../../product/SCREENS.md), [style](../../../STYLE.md), and [data risks](../../architecture/DATA.md).

Needed materials: integrated code, signed-build access, both device platforms, consenting testers, and authorized operator credentials.
Backup drills need an isolated target. Production publication requires separate authorization.

## Ownership and checks

Own final CI, release runbooks, evidence, and fixes required by failed acceptance checks.
Do not expand product scope during this review.

Verify complete two-account flows, accessibility, permission denial, session expiry, network failure, and temporal behavior.
Use the planned large datasets to check paging and native performance.
Run the five-pair usability review only with available, consenting testers.

Prepare content-free monitoring, environment validation, restricted worker invocation, and backup recovery evidence.
Distinguish configuration written locally from infrastructure configured remotely.
Attach results to exact commits, builds, platforms, and devices.

If credentials, devices, or testers are missing, finish independent checks and list the remaining actions.
Never mark an unrun check as passed or an unsigned build as a signed release candidate.

**Handoff:** `docs/handoffs/08-release.md`.

## Prompt

```text
Implement Chat 08, Verification and release preparation, for Deseo.
Project: C:\Users\Corashina\Documents\Projects\deseo

Read AGENTS.md and docs/implementation/prompts/08-release.md.
Read CHAT_GUIDE.md, its common materials, and every implementation handoff.
Use the saved design and master Tasks 19–20 as this chat's accepted scope.
Use superpowers:executing-plans inline. Do not create other chats or agents.

Verify the integrated baseline and list all earlier pending checks.
Work serially on the recorded integration branch. Preserve unrelated changes.
Inspect actual scripts, CI, migrations, functions, native builds, and public output.
Apply the Supabase skill to database and operational checks.

Complete the planned end-to-end, accessibility, performance, security, and recovery checks.
Rate new tests before writing them. Implement only tests rated at least 90.
Fix failures in existing product scope and rerun affected checks.
Use real Android and iOS evidence when devices are available.
Run human usability checks only with available, consenting testers.
Do not fabricate reviews, device results, delivery evidence, or restore results.

Add CI, environment validation, restricted worker invocation, and release runbooks.
Prepare content-free alerts and backup recovery procedures.
Run restore drills only against an authorized isolated environment.
Do not alter live services or apply production migrations without separate authorization.
Validate store materials, disclosures, support details, legal inputs, and deletion requirements.
Build signed release candidates only when authorized credentials and build access are available.
Record exact artifacts, code commits, platforms, and checks.

Finish all independent local work when external inputs are missing.
List each remaining blocker, needed input, owner action, and verification step.
Do not describe the release as ready while required checks remain pending.
Update master task status and release evidence to match actual results.

Commit tested code, then write docs/handoffs/08-release.md using the handoff template.
Commit the report separately. Report the final integration tip and verified artifacts.
Present the candidate or blocker list for owner review.
Do not provision remote services, deploy, submit to stores, or contact real users.
```
