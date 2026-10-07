# Development

Read [Setup](#development-workflow), [Verification](#verification), [Remaining work](#remaining-work), or [Release](#release).
Keep each result tied to its source, command, environment, and platform.
Use [the frontend handoff](#frontend-design-handoff) for measured results and device limits.
The requirements below do not establish that a check passed.

<a id="development-workflow"></a>
## Development workflow
Use Node 24.18.0, npm 11.16.0, and the committed root lockfile.
Read AGENTS.md, STYLE.md, [the approved frontend design](README.md#frontend-design), and [the data contract](ARCHITECTURE.md#data-contract).

<a id="development-workflow-1-install-and-verify-source"></a>
### 1. Install and verify source

Run these commands from the repository root:

```powershell
npm ci
npm run verify:mobile
npm run test:domain
```

Mobile verification runs native TypeScript, lint, and Jest. It does not require Docker.
The domain suite checks shared schemas, payloads, and results.
Keep exact pins. Add packages only when a feature needs them.

<a id="development-workflow-2-local-browser-backend"></a>
### 2. Local browser backend

The checked-in prepare/start scripts use the dedicated `deseo-web` project under `.superpowers/web-backend`.
Run Docker Desktop before those scripts. Preserve any shared service already owned by another chat.
Its API uses 55721, database 55722, mail 55724, and inspector 55728.
The separate `deseo-integration` project uses 55620–55629.

```powershell
npm run prepare:web:backend
npm run start:web:backend
```

Set CLI telemetry controls before direct commands:

```powershell
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
```

Save this helper as `.superpowers/web-backend/save-status.cjs`:

```javascript
const { spawnSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const workdir = process.argv[2];
const run = spawnSync(process.execPath,
  ['node_modules/supabase/dist/supabase.js', '--workdir', workdir, 'status', '-o', 'json'],
  { encoding: 'utf8', windowsHide: true });
writeFileSync(join(workdir, 'status.stderr.local.log'), run.stderr ?? '');
if (run.error || run.status !== 0) throw new Error('Read the private status error log.');
writeFileSync(join(workdir, 'status.local.json'), run.stdout, 'utf8');
```

```powershell
node .superpowers/web-backend/save-status.cjs .superpowers/web-backend
```

The helper writes UTF-8 without a BOM. Keep the ignored files private; do not print keys.
Create `apps/web/.env.local` from `.env.example` and use the local publishable key.

| Browser variable | Use |
|---|---|
| `VITE_SUPABASE_URL` | API address; local value `http://127.0.0.1:55721` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser key |

Browser invitations use `location.origin`. The portal has no separate site-URL environment setting.
Do not add the unused planned `VITE_SITE_URL` variable.

<a id="development-workflow-3-one-edge-origin"></a>
### 3. One Edge origin

Start one Edge process in a separate terminal. Stop it before changing modes.

Development:

```powershell
npm run start:web:functions -- -Mode Development
npm run dev:web
```

Tests:

```powershell
npm run start:web:functions -- -Mode Test
npm run verify:web
```

Run each second command in another terminal while Edge remains active.
Development uses `http://127.0.0.1:5174`. Tests use `http://127.0.0.1:4174`.
Stop the other portal server before switching modes. The guarded script rejects the conflicting listener.
Playwright starts and stops its own preview. Run Windows browser checks elevated for Docker and owned process teardown.

| Server variable | Use |
|---|---|
| `WEB_APP_ORIGIN` | One exact browser origin selected by mode |
| `PUBLIC_SUPABASE_URL` | Reachable public API address for signed media links |
| `SUPABASE_URL` | Runtime-injected internal address for server calls |

Keep injected internal configuration intact. A deployed public API address must also be reachable by mobile devices.

Local Kong intercepts OPTIONS and stamps wildcard CORS headers.
The handler rejects unknown and null origins before work. Native calls can omit Origin.
See [the handoff](DEVELOPMENT.md#portal-handoff) for live measurements and deployment limits.

<a id="development-workflow-4-named-pair-and-gallery"></a>
### 4. Named pair and gallery

With the local backend and Edge process running:

```powershell
npm run seed:web
```

The command creates or reuses Anna and Marek with stable content IDs.
Their emails are `anna@deseo.example.test` and `marek@deseo.example.test`.
Use the ordinary sign-in screen and codes from the local mail inbox at `http://127.0.0.1:55724`.

Open [the gallery](../design/web-portal/index.html) for route, state, viewport, and fixture evidence.
Use disposable fixtures for failures, end-pair actions, and destructive tests.
Remove only IDs recorded by ownership journals. Preserve unknown rows and user edits.

<a id="development-workflow-5-backend-checks-and-clean-replay"></a>
### 5. Backend checks and clean replay

Check the populated web database without resetting it:

```powershell
npm run test:web:db
```

SQL suites use fixed fixture IDs inside transactions and roll back their changes.
Do not run race workers alongside browser fixtures. Global worker claims need their own test window.
Race harnesses accept only supported loopback projects; notification races also require an empty notification table.

Use a new project for a clean replay. Copy config, migrations, tests, and templates into its `supabase` directory.
Before starting, inspect Docker containers, volumes, project labels, workdir, and ports.
Do not reuse a populated project or volume.

The final replay used project `deseo-web-replay` with database 55822 and shadow database 55820.
It copied the current config, changed the project ID and ports, and disabled the absent seed file.
It used supported Postgres-only commands:

```powershell
npx supabase --workdir <fresh-replay-directory> db start
npx supabase --workdir <fresh-replay-directory> db reset --local
npx supabase --workdir <fresh-replay-directory> test db --local
```

Keep replay logs before removing only its verified container and volume.
The final replay did not reset `deseo-web` or `deseo-integration`.

The memory race harness removes claimed objects. Use the isolated replay project when populated stacks contain unknown cleanup jobs.
The final memory race target used replay API 55821.
The CLI short-circuits `start` while its Postgres-only container runs.
Stop only that verified replay project with data preservation, then start its required services:

```powershell
npx supabase --workdir <fresh-replay-directory> stop --project-id deseo-web-replay
npx supabase --workdir <fresh-replay-directory> start -x realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit
node .superpowers/web-backend/save-status.cjs <fresh-replay-directory>
```

Verify the new services' project labels, workdir, and API address before testing.
The exclusions keep Edge runtime off. The original Edge process remains separate.
Core and notification races can use API 55721 during their dedicated test window.
Load each target's keys inside the Node test process and pass them only through its child environment.

Save this helper as `.superpowers/web-backend/run-races.cjs`:

```javascript
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const suites = {
  core: ['pairing-races', 'planning-races', 'messages-races'],
  memories: ['memories-races'],
  notifications: ['notification-races'],
};
const suite = process.argv[2];
const status = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
assert(suites[suite]);
assert.equal(status.API_URL, suite === 'memories'
  ? 'http://127.0.0.1:55821' : 'http://127.0.0.1:55721');
assert(status.PUBLISHABLE_KEY && status.SERVICE_ROLE_KEY);
const run = spawnSync(process.execPath, ['--experimental-strip-types', '--test',
  ...suites[suite].map(name => 'supabase/tests/' + name + '.test.ts')], {
  stdio: 'inherit',
  env: { ...process.env,
    SUPABASE_TEST_URL: status.API_URL,
    SUPABASE_TEST_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    SUPABASE_TEST_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  },
});
if (run.error) throw run.error;
process.exit(run.status ?? 1);
```

Run it from the repository root after verifying each stack's identity:

```powershell
node .superpowers/web-backend/run-races.cjs core .superpowers/web-backend/status.local.json
node .superpowers/web-backend/run-races.cjs notifications .superpowers/web-backend/status.local.json
node .superpowers/web-backend/run-races.cjs memories <fresh-replay-directory>/status.local.json
```

These calls match the root race scripts. Their keys stay inside the Node process and its child.

Run Edge checks from the root:

```powershell
npm run test:memories:functions
npm run typecheck:memories:functions
npm run test:notifications:functions
npm run typecheck:notifications:functions
npm exec --yes --package deno@2.9.6 -- deno check --frozen --config supabase/functions/verify-sensitive-action/deno.json supabase/functions/verify-sensitive-action/index.ts
```

The sensitive function has its own committed dependency map. Use its config for standalone checks.
Discover CLI options through the installed help before changing commands.

<a id="development-workflow-6-expo-mobile"></a>
### 6. Expo mobile

Copy `apps/mobile/.env.example` to its `.env.local` before connecting a native build.
Use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for that backend.
Native links use `EXPO_PUBLIC_SITE_URL`; configured development push uses `EXPO_PUBLIC_EAS_PROJECT_ID`.
These values are public build configuration. Keep server keys out of them.

A phone's loopback address refers to that phone. Use an API address the device can reach.
Android emulators can use `10.0.2.2`; physical devices need a reachable host address.

```powershell
npm run dev:mobile
npm run android --workspace @deseo/mobile
npm run ios --workspace @deseo/mobile
npm exec --workspace @deseo/mobile -- expo export --platform android --platform ios --output-dir dist
```

MMKV needs a development build. Expo Go cannot run its native storage.
Android requires installed Android tooling. iOS local builds require macOS and Xcode.
JavaScript exports verify bundling; physical device, push, native binary, and store checks remain separate.

<a id="development-workflow-7-implementation-rules"></a>
### 7. Implementation rules

Rate tests before writing them. Implement only tests scoring at least 90.
Use feature public interfaces and shared domain contracts. Keep database calls out of screens.
Run focused checks during a fix, then one fresh full check on final source.
Preserve failed logs and state each rerun's scope.
Generate database types after schema changes. Test fresh replay and populated fixtures.
Keep account, pair, and private-state cleanup contracts intact.

The [portal handoff](DEVELOPMENT.md#portal-handoff) records current results, dependency findings, and remaining acceptance work.


<a id="verification"></a>
## Verification
Status: Automated source, browser, backend, and bundle checks have measured evidence in the [portal handoff](DEVELOPMENT.md#portal-handoff).
Physical Android and iOS acceptance remains unverified.

<a id="verification-portal-verification"></a>
### Portal verification

Run `npm run verify:mobile`, `npm run test:domain`, and `npm run verify:web` on final source.
Browser verification runs TypeScript, scoped lint, production build, and the complete Playwright suite.
Use real local Auth, pair transactions, private media, and durable writes.
Controlled transport failures cover unknown outcomes, replay, conflicts, focus, remount, and authority changes.

Run SQL suites on the populated local web stack and a clean isolated replay.
Scope test reads, updates, and assertions to fixture IDs. Keep real cross-pair and disabled-session denial checks.
SQL transactions roll back. Cleanup worker assertions select their fixture from bounded claims.
Preserve populated data and unknown rows. Fixture cleanup requires ownership records and checked deletion results.

Run pairing, planning, messages, memory, and notification race harnesses in a separate test window.
Do not overlap global worker claims with browser fixture setup.
Notification races require an empty notification table and never call Expo.

Check modified Edge functions with their committed Deno config and frozen dependency locks.
The sensitive function uses `supabase/functions/verify-sensitive-action/deno.json`.
Record live gateway behavior separately from direct handler tests.
Valid-user unknown/null-origin requests must reject before action work. Native no-Origin requests remain supported.

Export Android and iOS JavaScript after final shared changes. Record device checks separately.
Scan compiled web assets for server values, fixture tokens, native imports, and obsolete paths.
Check reachable compiled dependencies against the lockfile audit. Workspace audit flags alone do not isolate web production.

Verify gallery links, JPEG bytes, viewport dimensions, and route/view coverage.
The current gallery contains 39 routes, 119 views, 238 records, and 321 page JPEGs.
Two extra JPEGs record the named-media failure.
Check 320px, 768px, and 1024px layouts, keyboard controls, drawer focus, and 200% text sizes.
Normal non-photo captures use Anna and Marek. Normal photo captures use owned disposable accounts with decoded photos.
Failure and destructive states use disposable accounts.
Mask invitation tokens, verification codes, and proof values in evidence.

Verify named users through normal email-code UI. Save new content, read it as the partner, and remove only that record.
Keep earlier failed runs separate. A focused rerun does not replace the required fresh full suite.

The remaining sections describe product acceptance, including separate account, site, and native delivery work.

<a id="verification-1-test-selection"></a>
### 1. Test selection

Rate importance before implementation. Implement only scores of 90 or higher, as AGENTS.md requires.

Test user behavior, security rules, and failure recovery. Avoid tests that repeat markup or internal function bodies.

| Suite | Importance | Required cases |
|---|---:|---|
| Pair isolation | 100 | Foreign pair IDs, private events, media, views, direct calls, live subscriptions |
| Pair transaction | 100 | Simultaneous joins, self-join, one account joining two pairs, regeneration race |
| Account disable/delete | 100 | Valid old JWT, session revocation, partial cleanup, deleted account restore |
| Disconnect | 100 | Open screens, app resume, writes, export, upload, and push races |
| Sensitive verification | 100 | Forged, expired, wrong-account, wrong-action, and replayed proof |
| Message durability | 100 | Lost acknowledgement, duplicate UUID, reconnect, paging while new rows arrive |
| Photo access | 100 | Pending access, forged file type, metadata, quota race, stale media links |
| Event changes | 98 | Conflicts, duplicate creates, changing visibility, deleted sources |
| Time semantics | 98 | All-day dates, DST gaps/overlaps, partner timezone differences, travel |
| Reminder delivery | 100 | Duplicate workers, crashes, timeout ambiguity, quiet hours, stale versions, bad tokens |
| Encrypted local data | 98 | Large session, key loss, storage failure, restart, account switch, cleanup |
| Important dates/ideas | 96 | Leap days, yearly expansion, atomic planning, deleted linked event |
| Shared tasks | 95 | Assignment, concurrent edits, repeat completion, Undo, stale version |
| Notes | 94 | Own-note replacement, partner pin attempt, deleted source message |
| Native navigation | 95 | Deep links, Back, keyboard, restore, expired session |
| Accessibility | 95 | VoiceOver, TalkBack, large text, focus, labels, status announcements |
| Public site | 96 | Mobile layout, download handoff, privacy links, independent account deletion |
| Feed performance | 90 | Bounded queries, paging, image memory, long text |
| Decorative snapshots | 25 | Skip; inspect visual evidence instead |
| Trivial getter tests | 20 | Skip; test the owning feature behavior |

<a id="verification-2-fixtures"></a>
### 2. Fixtures

Use four synthetic accounts: A and B in one pair, C in another pair, and D unpaired.

Also create a disabled account, an ended pair, an expired invitation, and a pending photo.

Use Europe/Warsaw and America/New_York for ordinary cross-zone checks.

Use a DST spring gap and autumn overlap from the installed timezone data. Pin expected instants in the test.

Use February 29 in both leap and non-leap years. Preserve dates independently of UTC offsets.

Seed 1,000 messages, 200 memories, and a 366-day agenda for pagination checks.

Use generated or licensed test photos. Include metadata, invalid extension, large size, and malformed file fixtures.

<a id="verification-3-test-surfaces"></a>
### 3. Test surfaces

**Database:** Use real PostgreSQL policies, grants, constraints, and transactions. Do not replace access tests with client mocks.

**Concurrent writes:** Use separate clients or connections. Sequential calls cannot prove invitation or worker race safety.

**Feature modules:** Test commands and screens through their public interfaces. Mock external transport only when testing local failure presentation.

**Workers:** Use recorded provider outcomes and bounded test clocks. Verify database state before and after crashes.

**Native:** Use development and release builds on both platforms. Expo Go is insufficient for storage and push evidence.

**Portal:** Test the production preview through real browser routes and local authenticated data.

**Public site:** Test the generated static site when that separate delivery starts.

<a id="verification-4-complete-journeys"></a>
### 4. Complete journeys

1. A creates an account and invitation; B joins; C cannot retrieve their data.
2. A creates a shared event; B sees it; A creates a private event; B cannot retrieve it.
3. Both edit the same event; the second save preserves a draft and reports a conflict.
4. A adds a task; B completes it; a failed Undo restores the confirmed state.
5. A enables reminders; B declines permission; both still use the app.
6. A sends a message; the response is lost; retry creates one message.
7. B pins a message; Today shows it; deleting the message removes the note.
8. A uploads photos; one upload fails; retry preserves the caption and creates one memory.
9. A ends the pair during an upload and export; shared access stops and pending work cannot publish.
10. B joins a new pair; no old content enters it.
11. A deletes the account with an old session still open; that session cannot retrieve data.
12. A verified user deletes the account through the public page without reinstalling the app.

<a id="verification-5-manual-checks"></a>
### 5. Manual checks

Inspect 320–430dp phones, a tablet-sized native viewport, and 360/768/1440px public pages.

Test system font scaling to 200%, long names, long titles, screen readers, keyboards, and safe areas.

Check offline drafting, denied photo access, limited photo access, missing notification permission, and operating system termination.

Verify image metadata removal from an actual uploaded object. A picker setting alone is not evidence.

Verify an expired media URL stops working. Record the permitted 60-second access window after revocation.

<a id="verification-6-evidence"></a>
### 6. Evidence

Record app version, commit, platform, operating system, device, environment, command, and result.

Capture screenshots or recordings for native flows and public pages. Redact test tokens and email codes.

A passing unit suite does not prove push delivery, operating system behavior, or store readiness.

The existing [visual review](../design/REVIEW.md#) covers only the static reference.


<a id="remaining-work"></a>
## Remaining work

Physical Android/iOS acceptance remains unverified. Test keyboard, large text, safe areas, VoiceOver, TalkBack, and final-item clearance.
Device photo permissions, encrypted storage, process termination, deep links, push, native binaries, and stores need separate acceptance.
Hosted Auth, SMTP, Edge configuration, public URLs, and deployment need hosted verification.
Other browser engines and operating-system screen readers remain unverified.
Account export, deletion, avatar backend work, pair-timezone writes, and public pages remain separate delivery work.
Confirm audience limits, launch languages, pricing, legal operator, policies, domain, and support contact before release.
Named fixture photos fail decoding despite HTTP 200 responses; do not change their bytes during frontend work.
The controller's final whole-branch review remains pending.

<a id="frontend-implementation-plan"></a>
## Frontend implementation plan status

The owner approved the 7 October spec, plan, and sequential subagent execution.
The approved full plan and spec remain in Git history and ignored review scratch.
The six product layers have clean independent or scoped review outcomes.

| Layer | Status |
|---|---|
| 1. Foundation and controls | Complete; reviewed |
| 2. Entry and settings | Complete; reviewed |
| 3. Today and calendar | Complete; reviewed |
| 4. Tasks and notifications | Complete; reviewed |
| 5. Memories and photo forms | Complete; form correction reviewed |
| 6. Messages and notes | Complete; native grouping/time correction reviewed |
| 7. Final gallery, checks, and evidence | Verified; native physical and whole-branch gates remain |
| Native physical acceptance | Unverified; no device tools |
| Whole-branch review | Pending; controller owns this gate |

Current artifacts: root design/frontend-2026-10-07/web and the frontend handoff section below.
Current documentation paths replace the plan's former docs folders.
New documentation belongs in these three canonical files. Keep visual assets in root design.

<a id="portal-handoff"></a>
## Earlier portal evidence

The 5 October delivery established the existing browser routes, data rules, and local fixture workflow.
At d1bd51e, complete verify:web passed 236 tests with two capture skips; types, lint, and build passed.
Earlier populated and isolated SQL checks passed 505 assertions at their recorded revisions.
These historical checks do not prove current backend, hosted, or device acceptance.
Use Git history for the dated raw reports and completed plans.
Keep the historical gallery as its recorded-source evidence.
Use the frontend handoff below for this update's fresh source, browser, and export results.

<a id="release"></a>
## Release
Status: Future release checklist. No environment has been provisioned or published.

<a id="release-1-required-owner-inputs"></a>
### 1. Required owner inputs

| Input | Required before |
|---|---|
| Legal operator, launch regions, intended audience, and reviewed policies | Public beta |
| Production domain and support address | App links, email, and store listing |
| Apple and Google developer accounts | Signed distribution |
| Stable bundle/package identifiers | Production push credentials and association files |
| Hosting regions and verified backup retention | Privacy disclosures |
| Consenting beta testers | Usability sessions |
| Final store descriptions and screenshots | Submission |

These inputs are external release dependencies. Do not replace them with invented names, claims, or URLs.

<a id="release-2-environments"></a>
### 2. Environments

Use isolated local, staging, and production data. Restrict production secrets to approved build and backend contexts.

Use verified SMTP with tested code delivery. Check sender identity, expiry copy, resend behavior, and junk-folder outcomes.

Configure APNs and FCM through the chosen Expo build setup. Test production credentials on signed preview builds.

Use restricted scheduled-worker credentials. Check JWTs for user calls and reject public worker calls.

Apply migrations to staging first. Rebuild a fresh local database from history and run access tests before production changes.

<a id="release-3-operational-checks"></a>
### 3. Operational checks

| Area | Initial target / action |
|---|---|
| Reminder claim interval | One minute; alert when due jobs remain unclaimed for five minutes |
| Message persistence | Show Sent only after database acknowledgement |
| Orphan uploads | Remove abandoned reservations after 24 hours |
| Account deletion | Revoke access immediately; alert if active-data purge exceeds 24 hours |
| Ended pair | Author-only export for 30 days, then purge |
| Export files | Private, split into bounded parts, expire after 24 hours |
| Media links | At most 60 seconds; never log them |
| Delivery history | Keep notification records for 30 days |
| Backup restore | Test in an isolated environment before release |

Push timing is best effort. Operating systems, device settings, and provider outages can delay display.

Use content-free metrics: command failures, queue age, invalid tokens, export failures, purge lag, and storage usage.

Do not collect message text, captions, event titles, invitation tokens, or browsing trails for analytics.

Use manual consenting-test observations for early product validation. Add product analytics only for a defined question.

<a id="release-4-incident-handling"></a>
### 4. Incident handling

For suspected cross-pair access, disable the affected path, preserve content-free evidence, and stop related jobs.

Reproduce the access failure with synthetic accounts. Fix policies and run direct-request regression tests before reopening the path.

For push outages, retain bounded pending jobs and expire stale event reminders. Do not retry indefinitely.

For partial deletion, keep the account disabled and continue the stored cleanup phase. Do not restore access to bypass an error.

For storage failures, preserve upload drafts and reservations. Do not mark a memory published before validation.

For schema rollback, protect existing data. Prefer a reviewed corrective change over restoring an old database onto live writes.

<a id="release-5-release-candidate"></a>
### 5. Release candidate

- [ ] Pin dependencies and commit the lockfile.
- [ ] Run typecheck, lint, database tests, feature tests, worker tests, and public-site tests.
- [ ] Run the pairing and worker concurrency tests.
- [ ] Run SQL security advisors and resolve material findings.
- [ ] Test exact signed artifacts on physical Android and iOS devices.
- [ ] Complete VoiceOver, TalkBack, large-text, keyboard, permission, and timezone checks.
- [ ] Complete the five-pair usability review and fix core-flow failures.
- [ ] Confirm no sample content or inactive feature controls appear in production.
- [ ] Verify universal links and app links from email and a messaging app.
- [ ] Test installation handoff without the app installed.
- [ ] Verify in-app and independent web account deletion.
- [ ] Check privacy disclosures against actual SDKs, processors, storage, and retention.
- [ ] Replace prototype landing imagery with screenshots of the release candidate.
- [ ] Verify support links and support handling.
- [ ] Verify backups, restoration, queue alerts, and deletion alerts.
- [ ] Review the release candidate with the owner before publishing.

<a id="release-6-store-preparation"></a>
### 6. Store preparation

Prepare app name, subtitle, description, screenshots, icon exports, content rating, support URL, and privacy URL.

Describe only working features. Do not claim therapy, guaranteed reminders, complete calendar synchronization, or end-to-end encryption.

Provide review access to a synthetic pair without exposing real users.

Ensure the store privacy labels match the exact build and enabled SDK configuration.

Review current [Apple deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/) and [Google deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).

<a id="release-7-after-launch"></a>
### 7. After launch

Review failures, queue age, storage usage, and support reports daily during the initial beta.

Fix blocked core actions before adding features. Record a new scope decision for calendar sync, subscriptions, or offline writes.

Keep draft documentation status distinct from shipped behavior. Update the README only after the release evidence exists.


<a id="frontend-design-handoff"></a>
## Frontend design handoff

Date: 7 October 2026. Status: full capture and source checks passed; whole-branch review remains pending.

The owner approved the frontend spec, plan, and sequential subagent execution.
Tasks 1–6 passed independent or scoped review. The controller owns final whole-branch review.
Implementation base: aaa066d483b547252a3b9a33927d0e296363c2f7.
Product revision: af1f109be95ba5f7b7ec3e63d3b8344ea12f7bab.
Capture writer commits: 5b21b1a and e4fd34c. Canonical paths: 701f078.
Captured source: 701f078ed9384918d18287b687de92fb192a0d06.

I used C:/Users/Corashina/.codex/worktrees/deseo-frontend-design/deseo for this task.
I preserved the original checkout, named local data, shared Test runtime, and product source.
I added no package, render harness, query cache, backend configuration, or named-media repair.

### Final checks

Environment: Windows, Europe/Warsaw, Node 24.18.0, npm 11.16.0, root lockfile.
The existing API serves 127.0.0.1:55721 in Test mode for origin 127.0.0.1:4174.
Another Deseo chat owns that service. Playwright owns each temporary preview.
This run used the existing `deseo` service, rather than starting the documented `deseo-web` launcher.
I changed no backend configuration or service process.
Browser batches run in sequence. I check listeners before each batch.

| Command | Result | Exit |
|---|---|---:|
| npm run verify:mobile | Native types/lint; 45 suites, 203 tests passed | 0 |
| npm run test:domain | 2 suites, 7 tests passed | 0 |
| npm exec --workspace @deseo/mobile -- expo export --platform android --platform ios --output-dir dist | Android/iOS Hermes JavaScript exports passed | 0 |
| npm run test:web -- screenshot-coverage.spec.ts screenshot-cleanup.spec.ts, DESEO_CAPTURE=1 | 13 passed; one intentional skip; 9.5 minutes | 0 |
| npm run verify:web | Types/lint/build passed; 242 tests passed, two failed, two generation skips; 29.7 minutes | 1 |
| Unchanged deleted-send test replay, both projects | 2 passed; 12.1 seconds | 0 |
| Unchanged same-account pair-change replay, both projects | 2 passed; 7.8 seconds | 0 |
| Corrected recovery cases, both projects | 4 passed; 21.5 seconds; types/lint passed | 0 |
| Fresh npm run verify:web on 261ae21 | Types/lint/build passed; 244 passed, two generation skips; 29.5m | 0 |
| Built web asset review | 62 text assets; four private values absent; no native module imports | 0 |
| git diff --check | Passed for writer and canonical path changes | 0 |

Mobile/domain source from af1f109 was present when checks and exports ran. Those trees remain unchanged through Task 7.
Task 7 changes capture tests, fixture verification, documentation, and gallery paths. Product source remains unchanged.
The bundle contains Supabase runtime and key-prefix comparisons. Those strings are vendor checks, not native imports or credentials.
Ignored scratch retains failed/passing logs, ownership journals, and private local sessions.
These files stay outside Git.

### Mechanical detector

I ran the installed Impeccable detector once after Tasks 1–6 finished.
Command: impeccable.cmd detect --json followed by 37 changed web source paths from aaa066d to af1f109.
Actual output: [] . Exit: 0. No findings.
I kept the approved fonts, palette, corners, control sizes, and motion rules.
This result does not establish browser rendering or device acceptance.

### Gallery, fixtures, and privacy

Use [the current gallery](../design/frontend-2026-10-07/web/index.html), [capture index](../design/frontend-2026-10-07/web/README.md), and [verification record](../design/frontend-2026-10-07/web/verification.json).
Keep [the historical gallery](../design/web-portal/index.html) as its recorded-source evidence.
The manifest remains 39 routes and 119 views. Full coverage requires 238 viewport records.
Capture sizes: desktop 1440 × 1000; phone 390 × 844. Long pages include full-page images.
The fresh set has 238 records, 236 distinct viewport images, and 85 full-page images: 321 page JPEGs.
Two extra JPEGs show named-media failures.
Real capture interval: 2026-10-07T14:34:54.196Z–2026-10-07T14:43:32.613Z.
The desktop capture assertion skips while the narrow set is incomplete. The narrow assertion validates both completed sets.
Final verify:web passed both viewport gallery assertions.
The root route shares the Welcome image after redirect.
The writer checks JPEG bytes, browser decoding, exact viewport dimensions, and full-page dimensions.
The display clock stays at 5 October 2026, 10:00 Europe/Warsaw.
coverage.json records real UTC capture time and tested source revision separately.
Backend and Auth clocks keep real time.

I mask email addresses, invitation codes, sign-in codes, and verification codes in images.
I replace invitation query tokens with MASKED in coverage URLs.
Local Auth sessions, keys, traces, and fixture journals remain outside the gallery.
The cleanup suite retains ownership and checks partial setup, failed deletion, disposal, and recovery.
All 40 retained journals report cleaned=true; all owned accounts are recorded removed.
The named pair remains intact.
Before and after path consolidation, all 327 historical hashes matched at design/web-portal.

### Named media limit and capture correction

The read-only preflight ran at 2026-10-07T14:15:10.599Z on af1f109.
Today showed one photo error; Memories two; the named memory detail one.
Media and Storage returned HTTP 200, but no photo decoded.
I reported this evidence before full capture. I did not assign a cause or repair stored bytes.
I save separate [desktop](../design/frontend-2026-10-07/web/named-media-failure-1440.jpg) and [phone](../design/frontend-2026-10-07/web/named-media-failure-390.jpg) failure images.

The controller approved owned disposable pairs for normal Today and memory photo views.
Their records carry exact fixture labels. Normal photo views check decoding, bounds, and absent photo errors.
Other normal planning, task, message, and account views retain named fixtures.
Error, conflict, pending, and unavailable states use disposable fixtures or controlled request failures.
These captures provide local fixture evidence.

The first full capture failed my new image-count assertion on the existing caption/date-only memory edit page.
Result: 10 passed, three failed, one skipped; exit 1.
Both projects failed at memory-edit/default; the incomplete-gallery check then failed.
I scoped decoding to photo-bearing views. Typecheck, lint, and diff checks passed before e4fd34c.
I retained failed logs and all cleanup journals. Product behavior stayed unchanged.

### Full web recovery-test results

The full run failed desktop deleted-send recovery and phone same-account pair-change invitation generation.
The unchanged focused replay passed each case on both projects. These replays do not replace a passing full run.
Both failures overlapped privacy-triggered session revalidation.
The first retained a pending send after reconciliation lost its query scope.
The second cleared the old token, adopted the new pair, then retained an unconfirmed new invitation command.
Trace evidence proves overlapping requests and protected pending state. Exact realtime event delivery is inferred from source.
The original feature implementer committed the narrow fixture observer in 261ae21.
It forwards realtime frames unchanged and observes joined channels, expected own signals, and fresh session/new-pair responses.
All pending-state, no-resend, deleted-result, old/new-token, and isolation assertions remain.
The final four covering checks and browser types/lint passed. Product privacy guards remain unchanged.
The fresh full run passed all 244 checks. Two generation tests skipped because capture mode was disabled.
Both gallery assertions passed. The prior full-run failure remains in ignored evidence.

### Layer evidence

| Layer | Commit | Scoped test summary | Review |
|---|---|---|---|
| Foundation | 8519e94 | Browser 12; native Field 2; types/lint | Clean |
| Entry/settings | 49d2095 | Browser 70; native auth/pair 17; types/lint | Clean |
| Today/calendar | 467d545 | Browser 46; native 15 plus calendar 29; types/lint | Clean |
| Tasks/notifications | 44ee848 | Browser 56 plus copy 12; native 39; types/lint | Clean |
| Memories | e6eed64, 503a536 | Browser 46; form fix 14; native 7; types/lint | Scoped fix clean |
| Messages/notes | 8f3be6d, af1f109 | Browser 36; native 15; fix 21; types/lint | Scoped fix clean |

Task 1's header assertion passed at baseline. The implementer kept that honest result.
Task 2 baseline had 60 passes and two failures against an obsolete container name.
The scoped disposable expiry helper then passed both cases against the verified existing deseo container.
Task 3's Today order assertion failed before restructuring and passed afterward.
Task 4's full-row completion assertion failed before its change and passed afterward.
Task 5's photo recovery and browser-widget readability failures passed after scoped corrections.
Task 6's account-timezone pin assertions failed before the fix and passed afterward.
Task 2's CSS zoom probe does not prove doubled-computed-text acceptance.

### Browser review

I reviewed all 119 views at both widths in one batched pass through 15 contact sheets.
The review checked hierarchy, reading order, controls, wrapping, masks, dialogs, photo recovery, and sender labels.
No new required UI issue was found. No product source changed during Task 7.
The controller also checked Today planning on phone and the desktop conversation.

| Route | Reviewed views, each at 1440px and 390px | Result |
|---|---|---|
| entry-root | resolved-entry | No required issue |
| entry-welcome | default, invited, global-signout-failure | No required issue |
| entry-email | default, error | No required issue |
| entry-verify | default, invalid-code | No required issue |
| entry-profile | new-account | No required issue |
| pair-start | default | No required issue |
| pair-invite | default, generated-code, delivery-unconfirmed, already-delivered | No required issue |
| pair-join | default, review, unavailable | No required issue |
| pair-waiting | default, cancel-dialog | No required issue |
| pair-welcome | default | No required issue |
| pair-ended | default | No required issue |
| invite-entry | valid, invalid | No required issue |
| calendar | month, agenda, compare, empty, error | No required issue |
| event-new | default, validation, plan-date | No required issue |
| event-detail | shared, private, delete-dialog, unavailable, request-error, pending-deletion | No required issue |
| event-edit | default, conflict, share-dialog | No required issue |
| today | planning, empty, error | No required issue |
| memories | month-feed, empty, error | No required issue |
| memory-new | default, selected, upload-error | No required issue |
| memory-detail | author, partner, delete-dialog, unavailable, media-error, request-error, pending-deletion | No required issue |
| memory-edit | default, conflict | No required issue |
| messages | conversation, notes, empty, error, pending-send, delete-dialog, pending-action | No required issue |
| tasks | general, groceries, completed, completion-error | No required issue |
| task-new | default, validation | No required issue |
| task-detail | default, delete-dialog, unavailable, request-error, pending-deletion | No required issue |
| task-edit | default, conflict | No required issue |
| task-lists | default, create | No required issue |
| task-list-detail | general, nonempty, empty, move-dialog, remove-dialog | No required issue |
| ideas | saved, planned, archived, empty | No required issue |
| idea-new | default, validation | No required issue |
| idea-detail | saved, planned, archived, archive-dialog, unavailable, request-error | No required issue |
| idea-edit | default, conflict | No required issue |
| notifications | list, empty, unavailable, error | No required issue |
| settings | default, unpaired, ended | No required issue |
| settings-profile | default, conflict | No required issue |
| settings-pair | default, verification, end-dialog, ended | No required issue |
| settings-notifications | default, quiet-hours, conflict | No required issue |
| settings-account | default, unpaired, ended | No required issue |
| unknown-route | not-found | No required issue |

The existing importance-92 suite checks 320, 390, 768, 1024, and 1440px with long and doubled computed text.
Importance-93 checks cover keyboard access, dialog focus trap, Escape, and focus return.
Importance-95 navigation checks cover draft retention.
Browser confirmation prompts sit outside page images. Navigation tests check dismissal and acceptance.

<a id="native-frontend-evidence"></a>
### Native frontend evidence

Native verification passed: 45 suites, 203 tests, types, and lint. Both JavaScript exports passed.
Android bundle: entry-60c8670ebc76930b5c32fe1e2b5f71cb.hbc, 5.2 MB.
iOS bundle: entry-5c5b1464c595fb2b254763798f712cdf.hbc, 5 MB.
Both exports and metadata.json remain ignored in apps/mobile/dist.
No device, native SDK, simulator, or native render harness was available here.
I installed no harness and captured no native device screenshot.
Physical keyboard, large-font, safe-area, final-item clearance, VoiceOver, and TalkBack checks remain unverified.
Camera/photo permissions, push, native binaries, store delivery, and deployment remain separate acceptance work.
Source checks and JavaScript exports cannot close those gates.

The controller requested compact live guides after the first consolidation.
I removed obsolete prompts, templates, and completed raw plans. Git history retains those records.
Current contracts, setup, checks, requirements, approved scope, rulings, reviews, and remaining work stay in these guides.

### Controller rulings

Ruling: Use the approved committed source in the managed checkout, leaving unrelated live backend edits in the original checkout. Use ignored local environment files to test the existing fixture readers. Reason: isolate design work without committing another task's changes. Cost if wrong: baseline checks may require environment adjustment.
Ruling: If a new behavior assertion already passes at baseline, keep its honest baseline result. Reason: a required check can confirm existing behavior. Cost if wrong: a latent case could need a more specific assertion during review.

Task 2 baseline concern: the expired-email-code fixture references supabase_db_deseo-web while the running verified project is deseo. Ruling: update only the disposable fixture expiry helper to verified supabase_db_deseo, after confirming the failure cause and container identity. Reason: required browser verification must use the existing local backend without changing its configuration or copying another task's dirty files. Cost if wrong: expiry checks could fail or address the wrong local stack; container identity and disposable fixture scope must be checked. Preserve baseline failure evidence and include this helper change in review.

Task 4 baseline: 44 browser and 11 native passed. New full-row title completion test rated 95 failed before the change and passed after it. Native focused feature suites passed 27. Initial 27-view desktop/phone capture batch passed. Ruling: add a local read-only Retry for failed native permission reads using the existing read function and Status action props, with an importance-95 recovery test. Reason: the approved error-state design requires an available recovery action. Keep app-focus recovery and public props; do not request permissions, register devices, write backend data, or add a listener. Cost if wrong: an extra permission read or recovery-state race, covered by the component test and scoped review.

Task 5 review /root/review5_memories: spec and quality need fixes for clipped date/file status at 320px doubled text. Required photo recovery itself approved. Ruling: fix readable native browser form controls now rather than defer them. Reason: the approved enlarged-text requirement overrides the generic two-round polish ceiling and the earlier deferral. Preserve native picker semantics, values, focus, prepared bytes, and public props; no new packages. Cost if wrong: extra scoped review time or altered widget presentation; verify only affected form/crop/recovery behavior and exact narrow screenshots. Task 5 fix round 1/5 starts from e6eed64e104d210d65944584163fcbda80c63735.

Task 6 review needs fixes for inverted-list native group gap placement and inconsistent account/device pin-time formatting. Ruling: native NoteCard may receive required explicit account timezone/locale props, with all callers updated, if needed to keep display components data-explicit. Reason: consistent user time settings override literal signature preservation in the plan; do not add optional compatibility defaults or read hidden account state inside the card. Cost if wrong: an extra internal UI prop contract; covering caller/type/time-setting tests must verify it. Task 6 fix round 1/5 starts from 8f3be6d72cd4ff81cbd09e0f3dcc1e16efc02bfe.

Task 7 named-media preflight: fresh check at 2026-10-07T14:15:10Z found Today 1 photo error, Memories 2, named detail 1. Media and Storage HTTP 200, no decoded photos. Safe record .superpowers/frontend-design/capture/named-media-preflight.json. Ruling: retain named failed-media evidence separately and use verified owned disposable pairs for normal Today and memory feed/detail/edit/author/partner/delete captures, with exact fixture labels. Keep named content elsewhere and change no named data, bytes, or infrastructure. Reason: normal coverage must show real decoded private images without falsifying state or repairing unrelated stored data. Cost if wrong: gallery's normal photo views differ from named demo content; explicit provenance and separate failed-media evidence preserve that limit.

Task 7 documentation ruling: current AGENTS requires exactly README.md, ARCHITECTURE.md, and DEVELOPMENT.md inside docs, with no subfolders. Ruling: consolidate this worktree's current docs and evidence into those three; move visual assets to root design. The current rule replaces the plan's artifact paths. Preserve approved full spec/plan in ignored scratch for final review. Keep original checkout untouched. Reason: honor the current contributor rule while preserving approved scope and historical bytes. Cost if wrong: documentation rework, no product behavior change. Original canonical docs serve as layout references only where source contracts match; their newer start:backend command/status path does not match this worktree. New gallery: design/frontend-2026-10-07/web. Native checks, handoff, rulings, and review evidence belong in canonical docs sections.

Task 7 deleted-send recovery: Ruling: preserve the existing privacy-triggered session revalidation and query abort; stabilize the deleted-send test by waiting for verified session recovery after fixture deletion before Retry. Reason: deletion's profile signal legitimately interrupts the read; the test currently races that required privacy mechanism. Cost if wrong: the test could hide a recovery defect, so preserve the pending-state, no-resend, deleted-result assertions and use observed responses/state, never sleeps.
Original Messages implementer owns the test correction after the full suite and unchanged focused replay. No product source change authorized.

Task 7 pair-change recovery: Ruling: apply the deleted-send recovery ruling to same-account pair-change. Await its own membership/profile signals and verified new-pair recovery before generating. Retain old/new-token and isolation assertions. Reason: pair cancellation privacy signals can interrupt the new invitation request. Cost if wrong: hiding early-attempt recovery defects; existing unknown-outcome tests and unchanged assertions must remain. No product/privacy guard change.

### Preserved review verdicts

#### task-1-review

Reviewer: /root/review1_foundation, gpt-6.1-sol/high.
Spec compliance: Approved for verified changes. No Critical, Important, or Minor findings.
Task quality: Approved.
Focused stylesheet risk check confirmed direct messages.css imports in TodayPage and MessagesPage.
Cannot verify: native visual/device behavior; unchanged controls rely on test evidence.
Controller resolution: device checks remain explicit final limitations; no device acceptance claim. Browser and native Field log summaries confirm the reported control/focus checks. The diff preserves component interfaces and behavior.
No tests rerun by the reviewer.

#### task-2-review

Reviewer: /root/review2_entry_settings, gpt-6.1-sol/high.
Spec compliance: Approved for source changes. Task quality: Approved.
Critical, Important, Minor findings: None.
Verified named risks: native account gate, removed selector callers, native section/screen composition, fixture ID/email restrictions.
Final evidence logs: 70 browser tests and 17 native tests passed without warning output. No tests rerun.
Cannot verify: unchanged screen composition and native devices; final-source captures remain with Task 7.
Controller resolution: reports cover compliant unchanged screens and 72 browser views; controller inspected six representative captures. Final Welcome 16px body is verified in source and final browser checks, with fresh image evidence retained for Task 7. Native device acceptance remains unverified, not claimed complete.

#### task-3-review

Reviewer: /root/review3_planning, gpt-6.1-sol/high.
Spec compliance: Approved for changed source. Task quality: Approved.
Critical, Important, Minor findings: None.
Verified: Today source/keyboard order and absolute date, desktop columns, form callback/validation preservation, native idea action placement, phone owner headings and shared row placement.
Logs checked: 46 browser tests, 15 required native tests, 29 additional native tests; final typecheck/lint clean. Reviewer repeated no tests.
Cannot verify: unchanged screens/EventRow and physical-device accessibility. Controller resolution: report coverage plus browser/native feature tests cover unchanged behavior; native visual/device acceptance remains unverified. Controller inspected normal-photo desktop Today and phone comparison captures.
Cross-task gate: Task 5 must fix the existing failed-photo Retry clipping at 320px doubled text. Named media failure remains separate from the passing disposable-media path and must remain explicit in final evidence.

#### task-4-review

Reviewer: /root/review4_tasks_notifications, gpt-6.1-sol/high.
Spec compliance: Approved. Task quality: Approved. No Critical, Important, or Minor findings.
Verified: full-row completion and separate Details, account-zone notification dates, item-local source errors, preserved completion/reminder/quiet-hour behavior.
Concrete permission-risk check: existing reader only calls getPermissionsAsync; Retry retains public props and one AppState listener. Existing Status supports the action.
Tests inspected: 56 browser, 12 affected notification-copy, 39 native checks passed without warnings. No tests repeated.
Cannot verify: unchanged native screens/draft internals and physical-device rendering/accessibility. Controller resolution: reviewed file coverage and existing feature suites cover unchanged behavior; native device acceptance remains unverified. Final-source header captures remain with Task 7.

#### task-5-review

Reviewer: /root/review5_memories, gpt-6.1-sol/high.
Spec compliance: Needs fixes. Task quality: Needs fixes.
Required Today recovery is implemented: valid sibling controls, expandable error content, 3:2 crop, detail proportions, meaningful browser/native regression.
Important finding: MemoryFormPage.tsx:146 and PhotoSelection.tsx:10 display clipped date/file status at 320px doubled computed text. Stored/accessibility values do not satisfy visual date readability. Fix before acceptance.
No other Critical, Important, or Minor findings. Native device and unchanged-data internals remain explicit evidence limits.
Reviewer inspected final doubled-text capture and widget-evidence.json. Test evidence: browser 46, confirmation 6, native 7, clean types/lint. No tests rerun.

#### task-5-fix-1-review

Reviewer: /root/rereview5_forms, gpt-6.1-sol/medium.
Clipped date/file controls at 320px doubled text: ADDRESSED.
Date input area expanded with scoped phone insets. File input remains native with wrapping prepared-photo status.
Preserved 16px baseline, labels, focus, disabled state, file callbacks, prepared bytes, crop/recovery behavior.
Covering logs: 14 browser checks passed; clean web typecheck/lint. Test covers all twelve dates, actual file selection, full values, focus, status bounds, and overflow.
New Critical/Important/Minor breakage: None. Out-of-scope observations: None. No tests rerun.
Controller inspected the final selected-320-text-2-narrow capture; complete date and selected count visible.

#### task-6-review

Reviewer: /root/review6_messages, gpt-6.1-sol/high.
Spec compliance: Needs fixes. Task quality: Needs fixes.
Important 1: MessagesScreen.tsx:78,257 computes group start against older neighbor in newest-first data, but applies bottom padding. This creates a gap inside same-sender chronology. Use top padding or newer-neighbor comparison.
Important 2: NoteCard.tsx:17 formats new pin times using device timezone/locale while conversation uses account preferences. Align both.
Strengths: browser sender classes/alignment, growing bounded conversation, unchanged props/data identities, direct route checks. Browser 36/native 15 and types/lint passed. No suites rerun.
Physical native acceptance remains unverified.

#### task-6-fix-1-review

Reviewer: /root/rereview6_native, gpt-6.1-sol/medium.
Native group spacing: ADDRESSED. Top padding matches older-neighbor boundary in counter-inverted RN cells.
Account pin timestamps: ADDRESSED. Required explicit timezone/locale passed by MessagesScreen and TodayScreen; no compatibility defaults.
New Critical/Important/Minor breakage: None. Out-of-scope observations: None.
Logs: two timestamp tests failed before fix, then four covering suites/21 tests passed. Native typecheck clean. Empty lint log plus implementer reported success; Task 7 recorded fresh full native lint exit 0.
No tests or source mutations by reviewer. Device acceptance remains unverified.

### Native source coverage

| Native screen | Source review | Device review |
|---|---|---|
| apps/mobile/src/features/today/screens/TodayScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/messages/screens/MessagesScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/auth/screens/WelcomeScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/auth/screens/VerifyScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/auth/screens/ProfileScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/auth/screens/EmailScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/calendar/screens/IdeaListScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/calendar/screens/IdeaFormScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/calendar/screens/IdeaDetailScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/calendar/screens/EventFormScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/calendar/screens/EventDetailScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/calendar/screens/CalendarScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/memories/screens/MemoryFormScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/memories/screens/MemoryDetailScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/memories/screens/MemoriesScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/tasks/screens/TasksScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/tasks/screens/TaskFormScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/tasks/screens/TaskDetailScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/tasks/screens/ListDetailScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/pair/screens/WelcomeScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/pair/screens/WaitingScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/pair/screens/StartScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/pair/screens/SettingsScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/pair/screens/JoinScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/pair/screens/InviteScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/pair/screens/EntryScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/pair/screens/EndedScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/notifications/screens/NotificationPreferencesScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
| apps/mobile/src/features/notifications/screens/NotificationListScreen.tsx | Source reviewed in completed task | Unverified: device tools absent |
