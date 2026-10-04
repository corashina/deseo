# Chat 02: Shared planning

## Identity

- Scope: shared lists, tasks, important dates, and saved date ideas.
- Master Tasks 6–7: implementation has not started.
- Branch: `codex/deseo-02-planning`.
- Worktree: `C:\Users\Corashina\Documents\Projects\deseo\.worktrees\deseo-02-planning`.
- Base commit: `7564cd0e13bfa9df492603f5e1f6a0919aeddfcf`.
- Core code commit: `118fdf553ed3c37ffe2ff01a9cf2b68e2de08485`.
- Integration branch: `codex/deseo-integration`.

The base adds two handoff documents to the core code commit. It changes no product code.
This report records setup and the remaining prerequisite. It does not approve the core baseline.

## Status

- Code status: **Blocked**. Core security and transaction checks remain unrun.
- Device status: **Pending**, Android and iOS.
- Release status: **Blocked**.
- Immediate dependency: restart Windows to complete Virtual Machine Platform setup.

The owner approved resuming Docker setup and core validation on 2026-10-04.
This approval replaces the earlier Docker deferral recorded in the core handoff.
The [execution guide](../implementation/CHAT_GUIDE.md#8-handoff-contract) still requires passing core security and transaction checks before feature coding.

## Implemented behavior

No Chat 02 product behavior exists yet.
Two agents reviewed the core baseline and feature boundaries. Neither agent changed files.

The controller created the isolated worktree from the recorded integration tip.
The app worktree tool returned `Not a git repository`, so the controller used Git.
The controller preserved the integration checkout and its branch.

## Changed files

- This report is the only tracked change.
- Setup scripts and logs remain under the ignored `.superpowers/docker-setup/` directory in this worktree.
- Package installation changed no manifests or lockfiles.

## Public interfaces

Chat 02 adds no exports in this checkpoint.
Use the exact core interfaces in [01-core.md](01-core.md).

After core validation, assign these files to separate agents:

| Owner | Files and work |
|---|---|
| Tasks agent | Tasks module, task/list routes, tasks migration, General lists, and task tests |
| Calendar agent | Calendar module, event/idea routes, dates-and-ideas migration, and date/idea tests |
| Controller | Migration names, permitted dependency changes, generated types, combined checks, and this handoff |

Keep shared layouts, Today, shared UI, and frozen core interfaces outside Chat 02 changes.
Chat 05 owns tab navigation, Today sections, and reminders.

## Database and dependencies

- Windows: Windows 11 Education, build `26300.9457`, x64.
- WSL: `2.7.13.0`, installed from Microsoft's verified package.
- Docker Desktop: `4.93.0`, installed for the current user with the WSL backend.
- Docker directory: `C:\Users\Corashina\AppData\Local\Programs\DockerDesktop`.
- Virtual Machine Platform: setup returned `restartNeeded: true`.
- The controller suppressed the restart. The user must restart Windows.
- Worktree dependencies: `npm ci --ignore-scripts --no-audit --no-fund`, then `npm rebuild --no-audit --no-fund` passed.
- No local Supabase stack, test accounts, keys, or feature migrations exist for this worktree yet.

After restart, assign a separate Supabase project ID and verify ports `55320–55339` before use.
Keep local overrides outside integration commits. Inspect CLI help before selecting the override method.
Do not reset or reuse another chat's database.

## Verification

The controller ran the mobile check in the integration checkout at base commit `7564cd0`.
The worktree contains identical product source. Setup introduced no product changes.
No new tests were written.

| Check | Importance | Exact command or action | Actual result |
|---|---|---|---|
| Mobile types, lint, and behavior | Existing tests: 93–100 | `npm run verify:mobile` | Passed: types, lint, 14 suites, 60 tests |
| Baseline ancestry | Required | `git diff --name-only 118fdf5..7564cd0` | Only two core handoff documents differ |
| WSL installation | Required | `wsl --version` | Reported `2.7.13.0` and kernel `6.18.33.2-2` |
| Windows feature setup | Required | `Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart` | Completed; restart required |
| Docker Desktop installation | Required | Verified WinGet package `Docker.DockerDesktop`, version `4.93.0` | Installer reported success |
| Docker engine | Required | Installed `docker.exe --version` and `docker.exe version --format '{{.Server.Version}}'` | CLI reported `29.8.1`; engine request failed because its named pipe was absent |
| Core SQL assertions and Auth races | 100 | Backend checks in [01-core.md](01-core.md#verification) | Not run in this chat; engine setup needs a restart |
| Advisors and generated types | Required | Commands in [backend guide](../../supabase/README.md#commands) | Not run in this chat |
| Native feature routes and restart behavior | 93–100 | Android/iOS device checks | Not run; no feature code or native device |

WSL setup evidence is in `.superpowers/docker-setup/wsl-result.json` and `wsl-install.log`.
Docker setup evidence is in `%LOCALAPPDATA%\Docker\install-log.txt`.
These local logs are not part of the commit.

## Integration instructions

1. Restart Windows, then resume this chat in the existing planning worktree.
2. Verify the Docker engine responds and configure an isolated local Supabase stack.
3. Complete core SQL, Auth race, advisor, OTP, session, and Realtime validation.
4. Generate database types after verifying the schema.
5. Record a verified core baseline before implementing Tasks 6–7.
6. Preserve the required ownership boundaries during feature work.
7. Commit verified feature code, then replace this checkpoint with the completed handoff.

Do not treat this branch as ready for Chat 05 integration.

## Remaining work

- Core automated security and transaction checks, plus any required fixes.
- All Chat 02 feature implementation and its tests rated at least 90.
- Isolated database setup, local ports, synthetic accounts, and generated types.
- Android/iOS feature routes, two-account updates, and encrypted restart checks.
- Final feature exports, migration list, integration instructions, and tested code commit.

The next eligible work is core validation after the Windows restart.
