# Development

Read [Setup](#setup), [Verification](#verification), [Remaining work](#remaining-work), or [Release](#release).
Keep check results tied to the tested commit, command, environment, platform, and device.
The requirements below do not establish that a check passed. Record unrun checks as pending.

## Setup

Use Node 24.18.0, npm 11.16.0, and the committed root lockfile.
Read [Contributor rules](../AGENTS.md), [Style](../STYLE.md), [Screens](README.md#screens), and [Architecture](ARCHITECTURE.md) before product work.

### Install and verify source

Run these commands from the repository root:

```powershell
npm ci
npm run verify:mobile
npm run test:domain
```

Mobile verification runs native TypeScript, lint, and Jest. It does not require Docker.
The domain suite checks shared schemas, payloads, and results.
Keep exact pins. Add packages only when a feature needs them.

### Local browser backend

Run Docker Desktop. Use one `deseo` project from the repository root.
Its API uses 55721, database 55722, mail 55724, and inspector 55728.

```powershell
npm run start:backend
```

Set CLI telemetry controls before direct commands:

```powershell
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
```

The start command saves status in `.superpowers/backend/status.local.json`. Keep this ignored file private.

Refresh the saved status with `npm run status:backend`.

Create `apps/web/.env.local` from `.env.example` and use the local publishable key.

| Browser variable | Use |
|---|---|
| `VITE_SUPABASE_URL` | API address; local value `http://127.0.0.1:55721` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser key |

Browser invitations use `location.origin`. The portal has no separate site-URL environment setting.
Do not add the unused planned `VITE_SITE_URL` variable.

### One Edge origin

Start one Edge process in a separate terminal. Stop it before changing modes.

Development:

```powershell
npm run start:functions -- -Mode Development
npm run dev:web
```

Tests:

```powershell
npm run start:functions -- -Mode Test
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
### Named pair and gallery

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

### Backend checks

Run SQL checks against the combined development database:

```powershell
npm run test:db
```

The SQL suites use fixture IDs and roll back their transactions. Preserve development records and unknown rows.
Run race tests separately from browser tests. Set test keys from the ignored backend status file.
All race harnesses use API 55721. Notification races require an empty notification table.
Memory races require empty memory and cleanup tables because their workers claim jobs across the database.
Do not reset the development database to satisfy these requirements.

On 2026-10-07, the `deseo` backend combined the web and integration development data.
The private backups and transfer checks are in `.superpowers/consolidation`.
Docker retains the original database and storage volumes as backups.
Use `npm run start:backend` for the single current project.

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

After you change a migration, regenerate the shared database types from a running local stack:

```powershell
npm run gen:types
```

The command writes `packages/domain/src/database.types.ts`. Mobile and web create their clients from it.
CI fails when the committed file differs from the schema.

### Continuous integration

`.github/workflows/ci.yml` runs on pushes to `master` and on each pull request.

- The apps job runs `verify:mobile`, domain tests, and the web typecheck, lint, and build.
- The backend job starts Supabase. It runs SQL suites, the type check, three race harnesses, and Deno function checks.

Playwright portal tests need the seeded development backend and its Edge functions. Run them locally with `npm run test:web`.

### Expo mobile

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

The app follows the device appearance. Read colors from `useTheme()` and build styles with `makeStyles()` from `src/theme`.

### Phone preview build

A preview build installs on both phones without a store. Android gets an APK; iOS needs a registered device.

1. Sign in once: `npm exec --yes --package eas-cli@24.11.0 -- eas login`.
2. In `apps/mobile`, link the project: `npm exec --yes --package eas-cli@24.11.0 -- eas init`.
3. Save the project ID as `EXPO_PUBLIC_EAS_PROJECT_ID`.
4. Add the `EXPO_PUBLIC_*` values to the EAS `preview` environment. Use a backend both phones can reach.
5. Run `npm run build:mobile:preview` and open the install links on both phones.

### Crash reporting

The app sends crashes to Sentry only when `EXPO_PUBLIC_SENTRY_DSN` is set.
It sends no default personal data and drops console, request, and navigation breadcrumbs.
To upload source maps from EAS, set `SENTRY_ORG`, `SENTRY_PROJECT`, and the secret `SENTRY_AUTH_TOKEN` in that EAS environment.

### Implementation rules

Rate tests before writing them. Implement only tests scoring at least 90.
Use feature public interfaces and shared domain contracts. Keep database calls out of screens.
Run focused checks during a fix, then one fresh full check on final source.
Preserve failed logs and state each rerun's scope.
Generate database types after schema changes. Test fresh replay and populated fixtures.
Keep account, pair, and private-state cleanup contracts intact.

## Verification

Physical Android and iOS acceptance remains unverified.

### Portal verification

Run `npm run verify:mobile`, `npm run test:domain`, and `npm run verify:web` on final source.
Browser verification runs TypeScript, scoped lint, production build, and the complete Playwright suite.
Use real local Auth, pair transactions, private media, and durable writes.
Controlled transport failures cover unknown outcomes, replay, conflicts, focus, remount, and authority changes.

Run SQL suites on the combined `deseo` development database. Preserve its data.
Scope test reads, updates, and assertions to fixture IDs. Keep real cross-pair and disabled-session denial checks.
SQL transactions roll back. Cleanup worker assertions select their fixture from bounded claims.
Preserve populated data and unknown rows. Fixture cleanup requires ownership records and checked deletion results.

Run pairing, planning, messages, memory, and notification race harnesses in a separate test window.
Do not overlap global worker claims with browser fixture setup.
Notification races require an empty notification table and never call Expo.
Memory races require empty memory and cleanup tables. Do not reset development data to run them.

Check modified Edge functions with their committed Deno config and frozen dependency locks.
The sensitive function uses `supabase/functions/verify-sensitive-action/deno.json`.
Record live gateway behavior separately from direct handler tests.
Valid-user unknown/null-origin requests must reject before action work. Native no-Origin requests remain supported.

Export Android and iOS JavaScript after final shared changes. Record device checks separately.
Scan compiled web assets for server values, fixture tokens, native imports, and obsolete paths.
Check reachable compiled dependencies against the lockfile audit. Workspace audit flags alone do not isolate web production.

Verify gallery links, JPEG bytes, viewport dimensions, and route/view coverage.
The gallery records 39 routes, 119 views, and 238 viewport records. Galleries reuse identical images from `design/shared`.
Check 320px, 768px, and 1024px layouts, keyboard controls, drawer focus, and 200% text sizes.
Use Anna and Marek for planning, tasks, messages, and settings. Use owned disposable pairs for normal media and destructive states.
Mask invitation tokens, verification codes, and proof values in evidence.

Verify named users through normal email-code UI. Save new content, read it as the partner, and remove only that record.
Keep earlier failed runs separate. A focused rerun does not replace the required fresh full suite.

The remaining sections describe product acceptance, including separate account, site, and native delivery work.

### Test selection

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

### Fixtures

Use four synthetic accounts: A and B in one pair, C in another pair, and D unpaired.

Also create a disabled account, an ended pair, an expired invitation, and a pending photo.

Use Europe/Warsaw and America/New_York for ordinary cross-zone checks.

Use a DST spring gap and autumn overlap from the installed timezone data. Pin expected instants in the test.

Use February 29 in both leap and non-leap years. Preserve dates independently of UTC offsets.

Seed 1,000 messages, 200 memories, and a 366-day agenda for pagination checks.

Use generated or licensed test photos. Include metadata, invalid extension, large size, and malformed file fixtures.

### Test surfaces

**Database:** Use real PostgreSQL policies, grants, constraints, and transactions. Do not replace access tests with client mocks.

**Concurrent writes:** Use separate clients or connections. Sequential calls cannot prove invitation or worker race safety.

**Feature modules:** Test commands and screens through their public interfaces. Mock external transport only when testing local failure presentation.

**Workers:** Use recorded provider outcomes and bounded test clocks. Verify database state before and after crashes.

**Native:** Use development and release builds on both platforms. Expo Go is insufficient for storage and push evidence.

**Portal:** Test the production preview through real browser routes and local authenticated data.

**Public site:** Test the generated static site when that separate delivery starts.

### Complete journeys

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

### Manual checks

Inspect 320–430dp phones, a tablet-sized native viewport, and 360/768/1440px public pages.

Test system font scaling to 200%, long names, long titles, screen readers, keyboards, and safe areas.

Check offline drafting, denied photo access, limited photo access, missing notification permission, and operating system termination.

Verify image metadata removal from an actual uploaded object. A picker setting alone is not evidence.

Verify an expired media URL stops working. Record the permitted 60-second access window after revocation.

### Evidence

Record app version, commit, platform, operating system, device, environment, command, and result.

Capture screenshots or recordings for native flows and public pages. Redact test tokens and email codes.

A passing unit suite does not prove push delivery, operating system behavior, or store readiness.

The [historical visual review](README.md#visual-review) covers only the static reference.

## Remaining work

Account export, account deletion, avatar backend work, pair-timezone writes, and public pages remain separate delivery work.
Inspect current code and verified interfaces before starting each item.

| Work | Requirements |
|---|---|
| Account controls | Complete profile, private avatars, verified email changes, and timezone changes without shifting saved instants |
| Export | Cover all content types; verify paired scope, author-only scope, resumable parts, expiry, and file integrity |
| Deletion | Disable access, revoke sessions, finish retention cleanup, and verify authored records and objects are gone |
| Public pages | Build landing, support, policies, invitations, and independent deletion using the same verified backend |
| Native acceptance | Test signed Android and iOS builds, storage, photos, push, permissions, and lifecycle changes on devices |
| Release | Complete CI, access and recovery checks, monitoring, store materials, and the five-pair usability review |

Finish account deletion before connecting the public deletion page.
Document the verified endpoint, origin rules, proof, receipt, errors, and rate limits beside its development instructions.
Share image preparation when avatar and memory callers both need it.
Keep invitation tokens out of logs, analytics, referrers, and public output.
Use real operator, support, domain, store, and signing values. Record missing publication inputs before release.

### Recording results

Record changed behavior, public interfaces, migrations, commands, results, and remaining work in the relevant section of this file.
Include the tested commit and exact build or device. Distinguish code integration, automated checks, and physical-device acceptance.
List each blocker with its required input, owner action, and verification step.
Preserve failed-run evidence. Never mark an unrun check as passed.
Keep secrets, invitation codes, and private content out of reports.

## Release

Use this checklist for future release work. Local setup does not establish hosted deployment or publication.

### Required owner inputs

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

### Environments

Use isolated local, staging, and production data. Restrict production secrets to approved build and backend contexts.

Use verified SMTP with tested code delivery. Check sender identity, expiry copy, resend behavior, and junk-folder outcomes.

Configure APNs and FCM through the chosen Expo build setup. Test production credentials on signed preview builds.

Use restricted scheduled-worker credentials. Check JWTs for user calls and reject public worker calls.

Apply migrations to staging first. Rebuild a fresh local database from history and run access tests before production changes.

### Operational checks

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

### Incident handling

For suspected cross-pair access, disable the affected path, preserve content-free evidence, and stop related jobs.

Reproduce the access failure with synthetic accounts. Fix policies and run direct-request regression tests before reopening the path.

For push outages, retain bounded pending jobs and expire stale event reminders. Do not retry indefinitely.

For partial deletion, keep the account disabled and continue the stored cleanup phase. Do not restore access to bypass an error.

For storage failures, preserve upload drafts and reservations. Do not mark a memory published before validation.

For schema rollback, protect existing data. Prefer a reviewed corrective change over restoring an old database onto live writes.

### Release candidate

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

### Store preparation

Prepare app name, subtitle, description, screenshots, icon exports, content rating, support URL, and privacy URL.

Describe only working features. Do not claim therapy, guaranteed reminders, complete calendar synchronization, or end-to-end encryption.

Provide review access to a synthetic pair without exposing real users.

Ensure the store privacy labels match the exact build and enabled SDK configuration.

Review current [Apple deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/) and [Google deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).

### After launch

Review failures, queue age, storage usage, and support reports daily during the initial beta.

Fix blocked core actions before adding features. Record a new scope decision for calendar sync, subscriptions, or offline writes.

Keep draft documentation status distinct from shipped behavior. Update the README only after the release evidence exists.

## Frontend design handoff

Historical record: 7 October 2026. The owner approved the spec, plan, and sequential subagent execution.
All seven task reviews and the final review passed after scoped corrections and one final fix wave.
These results apply to the listed revisions and original feature checkout.
Use [Setup](#setup) for current commands and [the merge record](#frontend-merge-record) for combined-source limits.
The 8 October merge preserves the eleven controller rulings and original verdicts below.

| Source | Revision or location |
|---|---|
| Implementation base | `aaa066d483b547252a3b9a33927d0e296363c2f7` |
| Product revision | `af1f109be95ba5f7b7ec3e63d3b8344ea12f7bab` |
| Capture writer | `5b21b1a`, `e4fd34c` |
| Canonical paths and captured source | `701f078ed9384918d18287b687de92fb192a0d06` |
| Managed checkout | `C:/Users/Corashina/.codex/worktrees/deseo-frontend-design/deseo` |
| Ignored evidence | `.superpowers/frontend-design/evidence/2026-10-07` |

The implementers preserved the original checkout, named data, shared Test runtime, and product source during Task 7.
They added no package, render harness, query cache, backend configuration, or named-media repair.

### Final checks

Environment: Windows, Europe/Warsaw, Node 24.18.0, npm 11.16.0, root lockfile.
Another Deseo chat owned the existing `deseo` API at `127.0.0.1:55721`, with Test origin `127.0.0.1:4174`.
Playwright owned temporary previews. The implementer checked listeners and ran browser batches in sequence.
The run did not use the documented `deseo-web` launcher or change backend configuration or service processes.

| Command | Result | Exit |
|---|---|---:|
| `npm run verify:mobile` | Types/lint; 45 suites, 203 tests passed | 0 |
| `npm run test:domain` | 2 suites, 7 tests passed | 0 |
| `npm exec --workspace @deseo/mobile -- expo export --platform android --platform ios --output-dir dist` | Both Hermes JavaScript exports passed | 0 |
| `npm run test:web -- screenshot-coverage.spec.ts screenshot-cleanup.spec.ts`, `DESEO_CAPTURE=1` | 13 passed; one intentional skip; 9.5 minutes | 0 |
| Initial `npm run verify:web` | Types/lint/build passed; 242 passed, two failed, two generation skips; 29.7 minutes | 1 |
| Unchanged deleted-send replay, both projects | 2 passed; 12.1 seconds | 0 |
| Unchanged same-account pair-change replay, both projects | 2 passed; 7.8 seconds | 0 |
| Corrected recovery cases, both projects | 4 passed; 21.5 seconds; types/lint passed | 0 |
| Fresh `npm run verify:web` on `261ae21` | Types/lint/build passed; 244 passed, two generation skips; 29.5 minutes | 0 |
| Built asset review | 62 text assets; four private values absent; no native module imports | 0 |
| `git diff --check` | Writer and canonical path changes passed | 0 |

Mobile/domain checks used `af1f109`; those trees remained unchanged through Task 7.
Task 7 changed capture tests, fixture verification, documentation, and gallery paths.
Vendor Supabase runtime and key-prefix comparisons in the bundle are neither native imports nor credentials.
The implementer retained failed/passing logs, ownership journals, and private sessions in ignored scratch outside Git.

### Mechanical detector

After Tasks 1–6, the implementer ran `impeccable.cmd detect --json` against 37 changed web paths, `aaa066d` to `af1f109`.
Result: `[]`, exit 0. The implementer kept approved fonts, palette, corners, targets, and motion rules.
The detector result provides no rendering or device acceptance.

### Gallery, fixtures, and privacy

Use [the gallery](../design/frontend-2026-10-07/web/index.html), [capture index](../design/frontend-2026-10-07/web/README.md), and [verification record](../design/frontend-2026-10-07/web/verification.json).
Keep [the historical gallery](../design/web-portal/index.html) as evidence of its recorded source.

| Recorded capture fact | Value or check |
|---|---|
| Coverage | 39 routes, 119 views, 238 viewport records |
| Viewports | Desktop 1440 × 1000; phone 390 × 844 |
| Original outputs | 236 distinct viewport images plus 85 full-page images: 321 page JPEGs; two named-failure JPEGs |
| Real capture interval | `2026-10-07T14:34:54.196Z` to `2026-10-07T14:43:32.613Z` |
| Display clock | 5 October 2026, 10:00 Europe/Warsaw; backend/Auth retained real time |
| Provenance | `coverage.json` records real UTC capture time and tested source revision |
| Validation | JPEG bytes, decoding, exact viewport/full-page dimensions; root redirects to the shared Welcome image |
| Gallery assertions | Desktop skipped during incomplete narrow capture; narrow validated both sets; final `verify:web` passed both |
| Historical preservation | All 327 hashes matched before and after path consolidation |
| Cleanup | All 60 retained journals recorded `cleaned=true` and removal of owned accounts; named pair intact |

Shared hash-named files preserve exact image bytes. Manifests retain source revisions, timestamps, and view coverage.
Original output counts describe capture evidence; galleries can reference shared files outside their own folders.
The implementer masked emails, invitation codes, sign-in codes, and verification codes; coverage URLs use `MASKED` invitation tokens.
Sessions, keys, traces, and fixture journals stay outside galleries.
Cleanup checks cover partial setup, failed deletion, disposal, and journal recovery.

### Named media limit and capture correction

| Evidence | Result and correction |
|---|---|
| Read-only preflight on `af1f109`, `2026-10-07T14:15:10.599Z` | Today: one photo error; Memories: two; named detail: one. Media/Storage: HTTP 200; no decoded photo. |
| Named failure captures | Separate [desktop](../design/frontend-2026-10-07/web/named-media-failure-1440.jpg) and [phone](../design/frontend-2026-10-07/web/named-media-failure-390.jpg) images. No assigned cause or byte repair. |
| Normal photo coverage | Controller-approved owned disposable pairs; exact fixture labels; decoding, bounds, and absent-error checks. |
| Other views | Named planning/task/message/account fixtures; disposable or controlled failure fixtures for error/conflict/pending/unavailable states. |
| First full capture | 10 passed, three failed, one skipped; exit 1. Both projects failed `memory-edit/default`, then incomplete-gallery validation. |
| Capture correction | Limit decoding to photo-bearing views; existing edit page contains only caption/date. Types/lint/diff passed before `e4fd34c`. |

The implementer reported preflight failures before full capture and retained failed logs and cleanup journals.
Product behavior stayed unchanged. Disposable normal-photo captures provide local fixture evidence, with separate named-media limits.

### Full web recovery-test results

The initial full run failed desktop deleted-send recovery and phone same-account pair-change invitation generation.
Unchanged replays passed both projects; these replays did not replace a passing full run.
Both failures overlapped privacy-triggered session revalidation.

| Case | Observed state | Correction in `261ae21` |
|---|---|---|
| Deleted send | Pending send remained after reconciliation lost query scope | Await verified session recovery before Retry; retain pending, no-resend, and deleted-result assertions. |
| Same-account pair change | Old token cleared; new pair adopted; new invitation remained unconfirmed | Await own signals and verified new-pair recovery; retain old/new-token and isolation assertions. |

The original Messages implementer added a fixture observer, forwarding realtime frames unchanged.
It observes joined channels, expected own signals, and fresh session/new-pair responses.
Traces prove overlapping requests and protected pending state. Exact realtime event delivery remains an inference from source.
Four covering checks and browser types/lint passed. Product privacy guards stayed unchanged.
Fresh full verification passed 244 checks and both gallery assertions; two generation checks skipped outside capture mode.
The implementer retained the prior full-run failure in ignored evidence.

### Layer evidence

| Layer | Commit | Scoped result | Baseline or correction |
|---|---|---|---|
| Foundation | `8519e94` | Browser 12; native Field 2; types/lint | Header assertion already passed; implementer retained that result. |
| Entry/settings | `49d2095` | Browser 70; native auth/pair 17; types/lint | Baseline: 60 passed, two obsolete-container failures. Scoped expiry helper passed both cases. |
| Today/calendar | `467d545` | Browser 46; native 15 plus Calendar 29; types/lint | Today order failed before restructuring, then passed. |
| Tasks/notifications | `44ee848` | Browser 56 plus copy 12; native 39; types/lint | Baseline: browser 44/native 11. Importance-95 row completion failed, then passed; focused native 27; capture batch 27 views. |
| Memories | `e6eed64`, `503a536` | Browser 46; form fix 14; native 7; types/lint | Photo recovery and widget readability failed, then passed scoped corrections. |
| Messages/notes | `8f3be6d`, `af1f109` | Browser 36; native 15; fix 21; types/lint | Account-zone pin assertions failed, then passed. |

Task 2's CSS zoom probe does not prove doubled-computed-text acceptance.
Reviewers approved each layer after its recorded corrections; see [the verdicts](#preserved-review-verdicts).

### Browser review

The implementer reviewed 119 views at both widths through 15 contact sheets; no new required UI issue.
The review covered hierarchy, order, controls, wrapping, masks, dialogs, photo recovery, and sender labels.
The controller checked phone Today planning and the desktop conversation.

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

Existing suites cover five widths and long/doubled computed text (92), keyboard/dialog focus (93), and draft retention (95).
Widths: 320, 390, 768, 1024, and 1440px.
Browser confirmation prompts sit outside page images; navigation checks cover dismissal and acceptance.

<a id="native-frontend-evidence"></a>
### Native frontend evidence

Native types/lint and 45 suites/203 tests passed. Both JavaScript exports passed.

| Platform | Ignored bundle in `apps/mobile/dist` |
|---|---|
| Android | `entry-60c8670ebc76930b5c32fe1e2b5f71cb.hbc`, 5.2 MB |
| iOS | `entry-5c5b1464c595fb2b254763798f712cdf.hbc`, 5 MB |

Exports and `metadata.json` remain ignored. The implementer installed no harness and captured no native device screenshot.
Device tools, native SDKs, simulators, and a native render harness were unavailable.
Physical keyboard, large fonts, safe areas, final-item clearance, VoiceOver, and TalkBack remain unverified.
Camera/photo permissions, push, native binaries, stores, and deployment require separate acceptance.
Source checks and JavaScript exports provide no device acceptance.
The controller requested compact live guides; the implementer removed completed prompts, templates, and raw plans.
Git history retains those records. Current guides retain contracts, scope, checks, rulings, reviews, and remaining work.

### Controller rulings

The controller made ten task rulings, then corrected the fixture identity ruling during final review.
These historical decisions retain their original context; ruling 11 supersedes ruling 3's fixed database name.

| # | Context and ruling | Reason and risk |
|---|---|---|
| 1 | Use approved committed source in the managed checkout; retain unrelated backend edits in the original checkout. Use ignored fixture environment files. | Isolate design work. Baseline checks may need environment adjustment. |
| 2 | Retain honest baseline results when a new assertion already passes. | Confirm existing behavior. A latent case may need a more specific assertion. |
| 3 | Task 2: verify identity, then change only disposable expiry from `supabase_db_deseo-web` to the running `supabase_db_deseo`. Retain baseline failures and review the helper. | Use the existing backend without configuration changes or dirty-file copies. A fixed name could select the wrong stack; see correction 11. |
| 4 | Task 4: add read-only permission Retry through the existing reader and Status props; importance 95. Retain focus recovery, public props, and one listener. | Recover failed reads. Extra reads/races need scoped checks. No permission requests, device registration, backend writes, or new listener. |
| 5 | Task 5: fix browser date/file readability at 320px doubled text, overriding earlier deferral and the two-round polish ceiling. | Approved text requirement controls. Preserve picker semantics, values, focus, prepared bytes, props, and packages. Verify affected forms/crops/recovery and narrow captures. |
| 6 | Task 6: allow required account timezone/locale props on native NoteCard; update all callers. | Account preferences control display. Preserve explicit data; add no compatibility defaults or hidden state. Check callers, types, and time settings. |
| 7 | Task 7: retain named failures and use verified owned disposable pairs for normal Today/feed/detail/edit/author/partner/delete photo captures. Keep exact fixture labels and named content elsewhere. | Show decoded private photos with honest provenance. Change no named data, bytes, or infrastructure. Normal photo content differs from named demo content. |
| 8 | Task 7: consolidate into three canonical docs; move assets to root `design`. Retain approved spec/plan in ignored scratch; preserve the original checkout. | Current AGENTS replaces old artifact paths. Original docs supply layout references only where contracts match; their backend command/status differs. New gallery: `design/frontend-2026-10-07/web`. |
| 9 | Task 7: original Messages implementer awaits verified session recovery before deleted-send Retry, after the full failure and unchanged replay. | Preserve privacy revalidation/query abort. Keep pending/no-resend/deleted assertions and observed responses/state; use no sleeps or product changes. |
| 10 | Task 7: apply ruling 9 to same-account pair change; await own membership/profile signals and verified new-pair recovery before generating. | Privacy signals can interrupt invitations. Retain old/new-token, isolation, and unknown-outcome checks; change no product/privacy guard. |
| 11 | Final review: derive SQL target from fixture `API_URL`/`DB_URL` status endpoints; reject ambiguous or mismatched identity. | Fixed names proved only the current run's target. Controlled rejection and real expiry checks guard wrong-database writes and blocked valid checks. |

Fix bases: Task 5 `e6eed64e104d210d65944584163fcbda80c63735`; Task 6 `8f3be6d72cd4ff81cbd09e0f3dcc1e16efc02bfe`.
Named preflight record: `.superpowers/frontend-design/capture/named-media-preflight.json`.

### Preserved review verdicts

Reviewers repeated no tests. These verdicts cover their recorded source and saved checks, with the limits below.
Original task reviewers used `gpt-6.1-sol/high`; scoped reviewers used `gpt-6.1-sol/medium`.

| Original verdict and reviewer | Evidence, correction, and limit |
|---|---|
| <a id="task-1-review"></a>Task 1: spec Approved for verified changes; quality Approved. `/root/review1_foundation` | No Critical/Important/Minor. Checked direct `messages.css` imports in TodayPage/ MessagesPage. Field/focus logs support unchanged controls and interfaces. Native visuals/devices unverified. |
| <a id="task-2-review"></a>Task 2: spec Approved for source changes; quality Approved. `/root/review2_entry_settings` | No findings. Checked native account gate, selector callers, composition, fixture UUID/email guards. Browser 70/native 17 passed without warnings. Controller inspected six captures from 72 browser views and Welcome 16px source/checks. Unchanged composition and devices remain limits; final images belonged to Task 7. |
| <a id="task-3-review"></a>Task 3: spec Approved for changed source; quality Approved. `/root/review3_planning` | No findings. Checked Today order/date/columns, form callbacks/validation, native idea actions, phone owner headings/shared rows. Browser 46/native 15+29 and types/lint passed. Controller inspected disposable-photo Today and phone comparison. Unchanged EventRow/screens and devices remain limits. Task 5 must fix failed-photo Retry clipping; retain named failures. |
| <a id="task-4-review"></a>Task 4: spec Approved; quality Approved. `/root/review4_tasks_notifications` | No findings. Checked row completion/Details, account-zone dates, local errors, reminders/quiet hours. Permission reader calls only `getPermissionsAsync`; Retry keeps props and one AppState listener. Browser 56/copy 12/native 39 passed without warnings. Unchanged drafts/screens and devices remain limits; final headers belonged to Task 7. |
| <a id="task-5-review"></a>Task 5: spec Needs fixes; quality Needs fixes. `/root/review5_memories` | Important: `MemoryFormPage.tsx:146` and `PhotoSelection.tsx:10` clip date/file status at 320px doubled text. Accessibility values do not prove readability. Required recovery approved: sibling controls, expandable errors, 3:2 crops/detail proportions. Browser 46/confirmation 6/native 7 and types/lint passed; reviewer inspected capture and `widget-evidence.json`. No other findings; devices/unchanged data remain limits. |
| <a id="task-5-fix-1-review"></a>Task 5 fix: ADDRESSED. `/root/rereview5_forms` | Scoped date insets and native file input with wrapping status retain 16px text, labels, focus, disabled state, callbacks, bytes, and crops/recovery. Browser 14/types/lint passed; checks cover twelve dates, real file selection, values, bounds, and overflow. Controller inspected `selected-320-text-2-narrow`. No new findings or outside-scope observations. |
| <a id="task-6-review"></a>Task 6: spec Needs fixes; quality Needs fixes. `/root/review6_messages` | Important: `MessagesScreen.tsx:78,257` uses older-neighbor boundaries with bottom padding in newest-first data. `NoteCard.tsx:17` uses device preferences instead of account preferences. Browser sender layout, bounded conversation, props/identities, and direct routes passed review. Browser 36/native 15/types/lint passed. Devices remain unverified. |
| <a id="task-6-fix-1-review"></a>Task 6 fix: both findings ADDRESSED. `/root/rereview6_native` | Top padding matches counter-inverted cells. MessagesScreen/TodayScreen pass required timezone/locale without defaults. Two timestamp checks failed before correction; four suites/21 checks and native types passed. Empty lint log plus implementer success preceded Task 7's fresh lint exit 0. No new findings, outside-scope observations, or reviewer source mutations. Devices remain unverified. |

### Native source coverage

Reviewers checked the following files under `apps/mobile/src/features/`. Physical-device review remains unverified for each file.

| Feature | Reviewed files in `screens/` |
|---|---|
| today | `TodayScreen.tsx` |
| messages | `MessagesScreen.tsx` |
| auth | `WelcomeScreen.tsx`, `VerifyScreen.tsx`, `ProfileScreen.tsx`, `EmailScreen.tsx` |
| calendar | `IdeaListScreen.tsx`, `IdeaFormScreen.tsx`, `IdeaDetailScreen.tsx`, `EventFormScreen.tsx`, `EventDetailScreen.tsx`, `CalendarScreen.tsx` |
| memories | `MemoryFormScreen.tsx`, `MemoryDetailScreen.tsx`, `MemoriesScreen.tsx` |
| tasks | `TasksScreen.tsx`, `TaskFormScreen.tsx`, `TaskDetailScreen.tsx`, `ListDetailScreen.tsx` |
| pair | `WelcomeScreen.tsx`, `WaitingScreen.tsx`, `StartScreen.tsx`, `SettingsScreen.tsx`, `JoinScreen.tsx`, `InviteScreen.tsx`, `EntryScreen.tsx`, `EndedScreen.tsx` |
| notifications | `NotificationPreferencesScreen.tsx`, `NotificationListScreen.tsx` |

### Task 7 review and fix round 1

Reviewer: `/root/review7_evidence`, `gpt-6.1-sol/high`. Original spec and quality: Needs fixes. Critical: None.
Important: `screenshot-coverage.spec.ts:74-75` writes the second journal after fixtures exist, before cleanup protection at 128/188.
An exclusive-write failure could bypass cleanup. Minor deferred: repeated native `NO_COLOR`/`FORCE_COLOR` warnings; retain the raw log.
The reviewer checked clocks, masks, recovery, 39 routes/119 views/238 records, 323 original JPEGs, 327 historical hashes, and three docs.
Saved logs: browser 244/two skips, mobile 203, domain 7, both exports. Reviewer repeated no tests.
The reviewer checked the outside-diff journal failure and read the truncated gallery-validation tail.
Devices remained unverified; original-checkout/live-data preservation required controller evidence.
The controller confirmed managed-worktree edits/commits, no original-source writes, preserved populated runtime, and read-only named photos.
At that review, 40 journals were clean; concurrent original-checkout changes belonged to other chats.

| Fix round 1/5 | Result |
|---|---|
| Base | `e1a2ddd94d7e5cc7bbb0a13617df844bb508e62a`; original Task 7 implementer |
| Correction | Clean main fixtures after secondary setup failure; retain both errors and main journal if cleanup fails. |
| Importance 95 | Real EEXIST after 11 accounts; disposal, unchanged secondary ownership, failed cleanup, saved-journal recovery. |
| Baseline and fixed batch | Two failures before fix; 16 passed, two generation skips; 1.8 minutes; exit 0. |
| Other checks | Both existing-gallery assertions, web types, and lint passed. Prior full result remains `261ae21`: 244/two skips. |
| Preservation | All 60 journals clean; 327 historical hashes and 323 original JPEGs unchanged. |

The fix required no broad suite, native export, capture, package, product source, or runtime change.
The controller retained export warnings as a deferred Minor. Final whole-branch review later passed.

### Task 7 scoped review

Reviewer: `/root/rereview7_cleanup`, `gpt-6.1-sol/medium`. Secondary journal cleanup: ADDRESSED.
The reviewer checked saved importance-95 collision/recovery evidence: two baseline failures, then 16 passes/two skips; types/lint passed.
No new Critical or Important; no repeated tests. Native color warnings: environmental, nonblocking Minor.
Task 7 completed; physical-device acceptance remained unverified.

### Final whole-branch review and fixture identity correction

Reviewer: `/root/final_review`, `gpt-6-astra/high`. Original assessment: With fixes. Critical: None.
Reviewed range: `aaa066d483b547252a3b9a33927d0e296363c2f7..a2fba9b23c2a37ba7f643554c547ac1fb923c524`.
Strengths: Today order, separate photo recovery, scoped styles, unchanged domain/dependencies, evidence boundaries, and journal cleanup.
Important: the fixed `supabase_db_deseo` expiry target conflicts with documented `deseo-web` setup; controller ruling 11 corrects ruling 3.

The helper resolves `API_URL`/`DB_URL` from selected running Docker labels and published ports.
It requires one owner per endpoint, matching project/workdir labels, and gateway/database roles.
It uses the verified immutable database container ID, retains UUID/disposable-email guards, and fails unmatched guarded updates.
Fix wave base: `a2fba9b23c2a37ba7f643554c547ac1fb923c524`. New identity checks rate 100.

| Command or condition | Result | Exit |
|---|---|---:|
| Docker identity preflight | Daemon and endpoint ports absent; raw failure retained | 1 |
| `npm run test:web -- fixture-identity.spec.ts`, before fix | Four expected regression failures | 1 |
| `npm run test:web -- fixture-identity.spec.ts entry.spec.ts --grep "fixture database\|expired email code does not restore a session"` | 20 passed; 9.0 seconds | 0 |
| `npm run typecheck --workspace @deseo/web` | Passed | 0 |
| `npm run lint --workspace @deseo/web` | Passed | 0 |

The controller restored Docker Desktop and verified resumed `deseo` API, database, mail, and Auth health.
The implementer started no service and reset no data. Backend setup/schema, product source, and named data stayed unchanged.
Controlled Docker inputs covered documented `deseo-web`; no second stack. Both real expired-code cases passed on the shared stack.
The fix required no broad suite, export, or gallery rerun. Ignored evidence retains the raw logs.
The controller verified the preserved export log's SHA256: `.superpowers/frontend-design/evidence/2026-10-07/task-7-native-export.log`.
Minor triage: color warnings are environmental and nonblocking. Use one color setting during the next required export.
The controller declined device acceptance and named-photo repair. Disposable normal photos and named failures retain separate provenance.
One scoped final review passed with no new Critical or Important findings.

### Final scoped review and delivery

Reviewer: `/root/final_rereview`, `gpt-6.1-sol/medium`. Database mismatch: ADDRESSED; endpoint owners and immutable ID verified.
Saved checks: 20 passed, including two real expired-code cases; types/lint passed. UUID/email guards and unmatched-update rejection remain.
No new Critical/Important or outside-scope observations; reviewer repeated no tests. Final review cleared after one fix wave.
Native color warnings remain nonblocking. Physical native and named-data acceptance remain unverified.
The controller preserved the detached worktree pending the owner's integration choice; [the later merge](#frontend-merge-record) records that choice.

## Frontend merge record

Date: 8 October 2026. The owner authorized merging the reviewed frontend branch into master.
Master before merge: `3428eae8cd6fcb7e6245ac4e6b364a15a16cc394`.
Reviewed feature: `e96ab62dcbc2a3929ce62a95ddc7346a829fc5ad`.

The merge keeps the current backend, domain contracts, access rules, Today summary query, and native theme hooks.
It retains field errors, timezone controls, task date labels, memory virtualization, and message action menus from master.
It adds the reviewed control styles, Today reading order, task targets, memory Retry controls, grouping, and note timestamps.
The guarded expiry helper reads the current backend status and resolves one API/database identity before SQL.
It uses the immutable database container ID and rejects unmatched fixture updates.

The gallery retains captured source `701f078`. Its records prove only that recorded interface.
The merged forms, date labels, and message actions can differ from those images.
The merge does not regenerate the gallery or repair named photos.

Both application typechecks and root lint passed after installation from the unchanged master lockfile.
Full merged browser, mobile, backend, and export results require separate checks.
Physical Android and iOS acceptance remains unverified.
The historical feature handoff above keeps its original revisions, eleven controller rulings, and review verdicts.

## Frontend merge verification — 8 October 2026

Merged reviewed frontend source e96ab62 into master from baseline3428eae.
All 39 conflicts were resolved. Current backend, access guards, theme hooks, and newer product behavior were retained.
Source review found no Critical, Important, or Minor issue.

| Check | Result |
|---|---|
| Browser verification | 272 passed; two capture-generation skips; exit 0 |
| Native verification | 46 suites; 205 tests passed; exit 0 |
| Domain contracts | 7 passed; exit 0 |
| Local database | 14 files; 517 assertions passed; exit 0 |
| Android and iOS JavaScript exports | Both passed; exit 0 |
| Types, lint, and staged diff | Passed |

The existing local master migrations for read policies and Today were applied. Stored content was preserved.
Browser startup failures were traced to cache visibility. The successful run used a project-local headless browser cache.
Raw merge logs remain in the ignored .superpowers/merge-frontend-2026-10-08 directory.
Earlier feature raw logs remain in .superpowers/frontend-design/evidence/2026-10-07.
The frontend gallery describes its recorded source. It does not claim to capture the merged interface.
Physical native acceptance remains unverified. Named photo repair remains excluded.
The merge is local. No remote push was requested.

## UI/UX Pro Max frontend review

Worktree: `codex/ui-ux-pro-max`. Baseline: `880bcb7`.
The baseline preserves the staged project from the original checkout.

I used [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) at revision `1a2c459`.
The product-wide searches returned marketing patterns. React and React Native searches provided the applicable control guidance.
STYLE.md remains the visual authority for the pastel colors, system fonts, shapes, and platform navigation.

I increased secondary and button text sizes. I mapped shared geometry and added control feedback.
You can see both partners in the browser header. You open the phone account menu through its named control.
I kept 48dp native targets. I used the shared palette for event borders, captions, notes, and tab selection.
I used a div for browser status messages to keep multi-paragraph HTML valid.

Open [the comparison](../design/ui-ux-pro-max-2026-10-08/index.html) for 238 matched before/after pairs.
Both sets cover 39 routes and 119 views at 1440×1000 and 390×844.
Each capture produced 323 JPEGs, including full-page images and named-media failure evidence.
The capture checks and an independent image read verified matching coverage and physical image dimensions.
Normal photo views use owned disposable fixtures. Failure views use controlled requests and owned accounts.
Emails, invitation codes, and verification values remain masked.
Fixture timestamps and unread counts can change between captures.

The after records identify the baseline and SHA256 of the exact frontend diff.
Read [verification.json](../design/ui-ux-pro-max-2026-10-08/verification.json) for source and skill revisions.

| Check | Result |
|---|---|
| Browser TypeScript, lint, production build | Passed |
| Complete browser acceptance | 272 passed; 2 capture-generation checks skipped |
| Native TypeScript, lint, Jest | 46 suites, 205 tests passed |
| Shared domain | 7 tests passed |
| Android and iOS JavaScript exports | Passed |
| Before and after gallery checks | Passed; 238 matched pairs |
| Comparison controls and image links | Passed; importance 90 |

No new acceptance tests were added. The updated shell identity check rates 95 and verifies header partners and account colors.
The realtime profile check rates 100 and reads the verified name from its new header location.
The layout suite checks five widths and 200% text sizes.

The browser checks use an isolated preview on 4184 and a local relay on 4185.
The relay forwards requests to the existing backend and its selected 4174 Edge origin.
It changes transport headers, without inventing backend responses. Gateway-origin checks call the backend directly.
The original preview and Edge process retain their configuration.

A native test timed out during the first run. Its eight-test suite and the full native rerun passed.
Initial browser runs hit a fixture working-directory error and a shared results-folder error.
One concurrent capture failed with ERR_NO_BUFFER_SPACE. Separate capture runs completed without source changes.
Failed logs remain in the ignored `.superpowers/ui-ux-*` files. The final browser run uses a separate results folder.
The final run passed with the corrected tests loaded before collection. Read `.superpowers/ui-ux-web-complete.log`.
A browser alignment check found a reserved scrollbar gutter. Removing it restored the message edge.
The design detector's one warning identifies the settings chevron's two-pixel stroke, rather than a card accent.

Phone captures show the browser portal. Native device screenshots, safe areas, keyboard behavior, and screen readers remain unverified.
Android emulator tools were unavailable in PATH. JavaScript exports do not establish physical-device acceptance.

## Design Taste update

Date: 8 October 2026. Work stays on `codex/design-taste` in a separate managed worktree.

The owner approved preserving Deseo's pastel brand, icon, system fonts, routes, and working actions.
Browser changes cover page headings, navigation groups, account identity, controls, forms, calendar, messages, tasks, memories, and settings.
Native changes cover the shared theme, screen spacing, sections, fields, tabs, event rows, task rows, memory cards, and messages.
Browser navigation uses pinned Phosphor icons through individual imports. Native screens retain Ionicons.

Design Taste settings: variance 4, motion 3, density 5. Feedback uses the existing 140ms duration.
The online skill excludes native and dense product screens. STYLE.md controls those surfaces.
Native device screenshots and physical-device acceptance remain unverified. Browser captures do not prove native rendering.

Open [the before and after comparison](../design/design-taste-2026-10-08/index.html).
The capture records identify the demo account, display time, viewport, and capture time.
Both sets retain the observed photo error and Retry. Stored photos remain unchanged.

### Design Taste checks

| Check | Result |
|---|---|
| Browser types, lint, and build | Passed |
| Native types, lint, and tests | 46 suites, 205 tests passed |
| Android and iOS JavaScript exports | Passed |
| Browser UI | 24 passed; two account-avatar failures corrected; four focused checks then passed |
| Layout | Five widths and doubled text passed |
| Design detector | No findings |
| Captures | 32 individual images and three comparison images; no page overflow |

The complete browser run stopped to release the shared test port for the master merge.
Focused UI checks used port 4175. The pair-termination check requires the reserved Test Edge origin and was excluded.
Initial after captures used port 4175. The merge refresh captured them on port 4174 with a verified demo session.
Both sets show Calendar Agenda. Each after capture checks its expected heading before saving.
Read [the verification record](../design/design-taste-2026-10-08/verification.json) for the exact checks and limits.

### Design Taste merge verification

Date: 8 October 2026. The design branch starts from master commit `083ea55`.

| Check | Result |
|---|---|
| Fresh full browser verification | 272 passed, two capture-generation skips |
| Native verification | 46 suites, 205 tests passed |
| Domain contracts | 7 passed |
| Android and iOS JavaScript exports | Passed on unchanged native source |
| Compiled browser assets | 62 files scanned; no server values or native imports |
| Before and after captures | 32 individual images, three comparisons; both origins use port 4174 |

The first complete browser run passed 271 checks. Photo fixture setup failed before the remaining calendar check ran.
The Edge runtime log records a restart during that failure. Both unchanged calendar replays passed.
The final fresh full run passed. No backend, fixture, domain, or product logic change was required.
Raw attempts remain in the ignored `.superpowers/design-taste` directory.
The refreshed comparison retains the observed demo photo error and Retry control.
Physical native acceptance remains unverified.

### Combined frontend review merge

Date: 8 October 2026. Master advanced to `0531c27` while the Design Taste verification ran.
I resolved the 20 overlapping paths in the isolated design worktree.
The result keeps Design Taste headings, navigation groups, icon components, and welcome layout.
It also keeps the newer readable control sizes, paired header identity, valid status markup, and shared geometry.
Both review records and their galleries remain in the project. Each gallery shows its recorded source.

| Combined check | Result |
|---|---|
| Complete browser verification | 272 passed; two capture-generation skips |
| Native types, lint, and tests | 46 suites; 205 passed |
| Domain contracts | 7 passed |
| Focused identity, layout, and realtime checks | 18 passed |
| Repeated realtime subscription checks | 12 passed |
| Repeated one- and five-photo publication checks | 6 passed |
| Android and iOS JavaScript exports | Passed |

The focused checks cover both partner colors, the current account, five widths, doubled text, focus, and profile signals.
The two existing realtime tests now wait for PostgreSQL subscription confirmation before changes.
Their importance rating remains 100. The repeated check covers both browser widths.
A 60-second budget covers cold fixture setup, sign-in, subscription, and reconciliation.
The first repeated run exhausted the former 30-second budget; its evidence remains in ignored files.
The existing importance-98 photo test now allows 15 seconds for sequential photo publication.
The failed five-second check still showed photo five uploading. It returned no application error.
That partial run and its failure evidence remain in ignored files.
Docker was unavailable after an interruption. I restored the existing stack without resetting data.
The stale runtime socket folder remains under a backup name.
Backend and domain source remain unchanged. Physical native acceptance remains unverified.
Combined logs remain in the ignored `.superpowers/design-taste/combined-*` files.

## Architecture optimization implementation plan: 9 October 2026

> For agentic workers: use superpowers:subagent-driven-development for implementation and independent task review.
> Read the approved design before each task. Track completed steps with checkboxes.

**Goal:** Improve architecture and runtime cost, then remove code each replacement makes unused.

**Architecture:** Share the Today contract and use existing server reads.
Keep UI, clients, storage, and request lifecycle inside each application.
Complete each stage before starting dependent work.

**Tech stack:** React, Expo, TypeScript, TanStack Query, Zod, Luxon, ESLint, Supabase, Jest, and Playwright.

**Spec:** [Approved architecture design](ARCHITECTURE.md#architecture-optimization-design-9-october-2026), commit `761553e`.

**Status:** Written design approved. Implementation plan review pending.

### Global constraints

- Work in `C:/Users/Corashina/.codex/worktrees/architecture-optimization/deseo`.
- Use branch `codex/architecture-optimization`; preserve the original checkout.
- Use Node 24.18.0, npm 11.16.0, and the root lockfile.
- Use existing dependencies and exact pins; add no product dependency.
- Keep native and browser UI separate.
- Keep one backend, one root npm lockfile, and exactly three Markdown files in docs.
- Keep shared rows and browser drafts in memory.
- Keep current authority checks, immutable commands, and stale-callback rejection.
- Remove replaced code; add no compatibility exports or fallback paths.
- Use stop-slop for text. Keep instructions at 20 words or less.
- Rate new tests before writing them. Implement only scores of at least 90.
- Store private logs and local keys in ignored files. Do not print keys.
- Keep native device, push, deployment, and store acceptance separate.
- Commit each completed task after its checks and independent review pass.

### Review focus

1. A delayed Today result after sign-out must expose no former Pair content. Task 1 owns this check.
2. A timed Event ending now must not displace the next plan. Task 1 owns this check.
3. Calendar cells outside the selected month must retain overlapping Events. Task 2 owns this check.
4. Literal dynamic imports must obey the same feature seam as static imports. Task 4 owns this check.
5. Worktree Edge serving must preserve the populated database and reject unrelated source paths. Task 5 owns this check.

### File responsibilities and execution

| Task | Main files | Responsibility |
|---|---|---|
| 1 | Domain Today schema; native and browser Today queries | One result contract and existing summary read |
| 2 | Domain calendar dates; Calendar grids; Messages page | Reuse derived data and remove repeated selection work |
| 3 | Browser icon; AppShell; Welcome | Smaller approved brand asset |
| 4 | ESLint config and its behavior test | Enforce feature interfaces |
| 5 | Edge import; root commands; CI; backend helpers | Frozen Edge checks and verified worktree serving |
| 6 | Development and ignored measurement records | Measure candidates and remove obsolete narrative |
| 7 | Final branch and acceptance results | Verify combined behavior and review the branch |

Tasks 1, 2, and 3 may run together after baseline checks.
Their implementers own separate files.
Run Tasks 4 and 5 after those changes pass review.
The coordinator owns root commands, shared documentation, backend processes, and final checks.
Give each subagent the design, its task, allowed files, and required checks.
Do not give agents overlapping file ownership.
A fresh reviewer checks each completed task.
Use no database race harness while browser fixtures or global workers run.

### Task 1: Share Today and replace browser aggregation

**Create:** `packages/domain/src/today/schema.ts`, `packages/domain/src/today/index.ts`, `packages/domain/tests/today-summary.test.ts`.
**Modify:** `packages/domain/package.json`; both applications' `features/today/queries.ts`; native `features/today/index.ts`.
**Modify:** browser `features/today/pages/TodayPage.tsx`, `features/tasks/queries.ts`, `tests/today.spec.ts`, `tests/support/screenshot-render.ts`.
**Extend:** native `features/today/today.test.ts` and `features/today/screens/TodayScreen.test.tsx`.
**Remove:** native `features/today/types.ts` after replacing its imports.

**Interfaces:** Export `todaySummarySchema`, `todayResultSchema`, and `TodaySummary` through `@deseo/domain/today`.
The schema parses `agenda`, `important_dates`, `due_tasks`, and `notes`.
It returns `agenda`, `importantDates`, `dueTasks`, and `notes`.
Native `getToday(pairId: string, date: string): Promise<TodaySummary>` returns the summary.
Browser returns `Promise<TodaySummary & { memory: Memory | null }>`.
Keep `todayKeys.day(accountId, pairId, date)` unchanged.

- [ ] Install with `npm ci` in the worktree. Run baseline mobile verification, domain tests, and browser build.
- [ ] Prepare ignored local environment files from verified local configuration without changing the original checkout.
- [ ] For Tasks 1–4, use original-checkout Test Edge serving; Edge source remains unchanged during those tasks.
- [ ] Rate contract and authority tests 100; presentation tests 98.
- [ ] Add a shared-contract test before exporting the new schema.

```ts
const empty = { agenda: [], important_dates: [], due_tasks: [], notes: [] };
expect(todayResultSchema.parse({ ok: true, data: empty })).toEqual({
  ok: true, data: { agenda: [], importantDates: [], dueTasks: [], notes: [] },
});
expect(todaySummarySchema.safeParse({ ...empty, notes: null }).success).toBe(false);
```

- [ ] Run `npm run test --workspace @deseo/domain -- --runTestsByPath tests/today-summary.test.ts`. Expect failure before the export exists.
- [ ] Reuse existing row schemas. Cap due Tasks at three and Notes at two; keep the full agenda.
- [ ] Extend tests for the caps using complete valid rows from the existing contract fixtures.
- [ ] Parse the existing Result envelope. Reject malformed data rather than returning an empty result.
- [ ] Change both clients to the existing `get_today` RPC with UUID/date validation and captured request scope.
- [ ] Reject foreign Pair rows in all four arrays before filtering timed Events.
- [ ] Filter timed Events whose end is at or before the current instant.
- [ ] Keep browser summary and latest Memory reads together; preserve native's independent Memory query.
- [ ] Render browser `agenda.slice(0, 3)`, `dueTasks`, `notes[0]`, and the existing Important date selector.
- [ ] Preserve native full agenda counts, account display timezones, Pair query dates, and section order.
- [ ] Remove browser Pair/Event/Task/Note aggregation, `listDueTasks`, `taskKeys.due`, and their unused imports.
- [ ] Remove native Today schema/type copies and the obsolete `TodayView` export.
- [ ] Change only Today failure interceptions from `list_agenda` to `get_today`.
- [ ] Extend native query checks for foreign rows in each array and stale scope after a delayed result.
- [ ] Extend browser Today checks for combined Memory failure and a delayed summary released after sign-out.

```ts
await expect(page.getByRole('link', { name: 'Continue with email' })).toBeVisible();
await expect(page.locator('body')).not.toContainText('Marek');
```

- [ ] Keep existing limit, due-date, overlapping Event, Note, and independent native Memory assertions.
- [ ] Run domain tests, mobile verification, workspace TypeScript, and browser build. Expect exit zero.
- [ ] With the existing Test Edge runtime, run `npm run test:web -- today.spec.ts session-isolation.spec.ts`.
- [ ] Verify replaced declarations have no callers with `rg`; obtain task review; commit `refactor: share the Today summary contract`.

### Task 2: Reuse Calendar and Messages calculations

**Modify:** `packages/domain/src/calendar/dates.ts`, `packages/domain/tests/calendar-dates.test.ts`.
**Modify:** browser `features/calendar/pages/CalendarPage.tsx`, `features/calendar/components/MonthGrid.tsx`.
**Modify:** native `features/calendar/screens/CalendarScreen.tsx`.
**Modify:** browser `features/messages/pages/MessagesPage.tsx`.
**Extend:** browser `tests/calendar.spec.ts` and `tests/messages.spec.ts`.

**Interfaces:** Keep `nextImportantDate(items: AgendaItem[], pairTimezone: string, now?: DateTime): AgendaItem | undefined`.
Keep `agendaDates` and `compareMessageCursors` unchanged.
Derived Maps remain internal to their current screens.

- [ ] Rate Important date tests 96, Calendar tests 95, and message paging checks 100.
- [ ] Extend Important date tests for first-item ties, past dates, timezone boundaries, and unchanged input.
- [ ] Run these behavior checks before refactoring. Existing behavior must pass.
- [ ] Replace filter/sort selection with one scan. Update the candidate only for an earlier eligible date.
- [ ] Cache browser owner-filtered Events by query data and owner, so MonthGrid receives stable inputs.
- [ ] Cache grid dates by month. Group Events once across the complete grid range, including adjacent-month cells.
- [ ] Keep Event order and exclusive end dates; use direct date lookups in each cell.
- [ ] Keep native grouping Map and sorted agenda groups together. Cache month dates by month.
- [ ] Cache the browser message Map and ordered rows by query pages.
- [ ] Retain the highest version per ID; retain the first encountered item on equal versions.
- [ ] Use `compareMessageCursors` for display order and the same Map for read observation.
- [ ] Extend Calendar acceptance with an Event spanning an adjacent-month cell and its exclusive end.
- [ ] Extend message acceptance with duplicate paged IDs, version precedence, and new Messages while reading history.
- [ ] Assert each Message appears once and the reader's position remains stable.
- [ ] Run `npm run test:domain`, `npm run verify:mobile`, and `npm run build:web`. Expect exit zero.
- [ ] With the existing Test Edge runtime, run `npm run test:web -- calendar.spec.ts messages.spec.ts`.
- [ ] Record selection and grid calculation costs against the baseline using identical input sizes.
- [ ] Obtain task review; commit `perf: reuse calendar and conversation calculations`.

### Task 3: Reduce browser icon bytes

**Create:** `brand/icon-web.png`.
**Modify:** browser `app/AppShell.tsx` and `features/auth/pages/WelcomePage.tsx`.
**Interfaces:** Keep existing image imports, CSS dimensions, and alternative text; change the asset path only.

- [ ] Use the lockfile's installed `jimp-compact@0.16.1` to derive a 288×288 PNG from `brand/icon-source.png`.
- [ ] Keep the source intact. Add no dependency or runtime image preparation.
- [ ] Verify output dimensions, transparency, and a size below 100,000 bytes.
- [ ] Compare the rendered icon at 40px, 64px, and 96px.
- [ ] Rate a standalone decorative asset test 25; skip it. Use byte and visual checks.
- [ ] Update the two browser imports and run `npm run build:web`.
- [ ] Confirm compiled browser assets exclude the 869,970-byte source PNG.
- [ ] Obtain task review; commit `perf: use a browser-sized brand icon`.

### Task 4: Enforce feature seams

**Modify:** `eslint.config.mjs`; root `package.json` for `test:architecture`; `.github/workflows/ci.yml`.
**Create:** `eslint.config.test.mjs`.
**Interfaces:** Keep the exported ESLint configuration.
Test helper `restricted(filePath: string, source: string): Promise<string[]>` returns restricted-rule messages from `ESLint.lintText`.

- [ ] Rate seam checks 95. Test the installed ESLint engine rather than matching configuration text.
- [ ] Add failing cases for cross-feature static/type imports, re-exports, and literal dynamic imports.
- [ ] Add failing cases for browser native imports and UI control imports of feature data.
- [ ] Add passing cases for same-feature internals, public feature imports, domain imports, and route page imports.
- [ ] Run `node --test eslint.config.test.mjs`; the new missing seam coverage must fail.
- [ ] Cover the eight native features and browser Settings.
- [ ] Apply static import/re-export rules and matching ImportExpression selectors for dynamic imports.
- [ ] Preserve domain platform rules and browser native-isolation rules when composing feature configuration.
- [ ] Keep routes free to import feature pages/screens and providers free to own session client access.
- [ ] Resolve any violation through the existing public interface; add no forwarding module.
- [ ] Add `test:architecture` as `node --test eslint.config.test.mjs`.
- [ ] Run test:architecture in the apps CI job.
- [ ] Run `npm run test:architecture` and `npm run lint`; expect exit zero.
- [ ] Obtain task review; commit `chore: enforce feature interfaces in both apps`.

### Task 5: Consolidate Edge checks and support verified worktree sources

**Modify:** `supabase/functions/verify-sensitive-action/index.ts`, root `package.json`, `.github/workflows/ci.yml`.
**Remove:** sensitive verification's `deno.json` and `deno.lock`.
**Create:** `supabase/dev/workspace.ps1`, `supabase/dev/workspace.test.mjs`.
**Modify:** `supabase/dev/backend.ps1`, `supabase/dev/serve-web-functions.ps1`, `supabase/dev/save-status.mjs`.
**Modify:** current Edge and backend instructions in Development.

**Interfaces:** `Get-DeseoWorkspace -SourceRoot <path>` returns canonical `SourceRoot`, `BackendRoot`, and `WorktreeRoots`.
`Assert-DeseoContainerOwner -Workspace <value> -Name <name> -Project <project> -Workdir <path>` throws on mismatched identity.
The shared helper performs reads only.
`save-status.mjs <BackendRoot>` writes status under its source checkout's ignored backend folder.

- [ ] Rate workspace identity checks 100. Use registered Git worktrees and rejected unrelated paths.
- [ ] Write failing checks for foreign project labels, unregistered Edge sources, and worktree Start/Reset.
- [ ] Include passing checks for primary persistent services and registered-worktree Edge sources.
- [ ] Run node --test supabase/dev/workspace.test.mjs before implementing the helper; expect the new checks to fail.
- [ ] Require canonical paths, the same Git common directory, current registration, and no prunable worktree.
- [ ] Resolve BackendRoot from the primary Git worktree record.
- [ ] Require identical source/backend Supabase configuration for shared serving.
- [ ] Require persistent containers' project `deseo` and workdir BackendRoot.
- [ ] Permit the Edge runtime workdir only when it matches a verified WorktreeRoot.
- [ ] Keep exact container names, API 55721, database 55722, and foreign-port rejection.
- [ ] Reject worktree Start/Reset actions. Permit verified Test/Status actions.
- [ ] Run Test with SourceRoot, and Status with BackendRoot. Save status in SourceRoot.
- [ ] Check Kong, database, and any existing Edge identity before serving.
- [ ] Keep origin-mode and conflicting-listener checks; run the source CLI with `--workdir SourceRoot`.
- [ ] Use `npm:@supabase/supabase-js@2.117.2` in sensitive verification.
- [ ] Add one `typecheck:functions` command using Deno 2.9.6, `--frozen`, and the common configuration.
- [ ] Check finalize-memory, get-memory-media, cleanup, dispatch-notifications, check-push-receipts, and verify-sensitive-action.
- [ ] Remove the two old function typecheck commands. Update verify, CI, and current documentation.
- [ ] Keep existing function test commands and frozen dependency versions.
- [ ] Remove the separate sensitive config/lock after shared resolution passes.
- [ ] Run `node --test supabase/dev/workspace.test.mjs`, `npm run typecheck:functions`, and both function test commands.
- [ ] Record the database container ID before serving; start Test Edge from the worktree.
- [ ] Inspect the new Edge source mount and label. Confirm the database container ID remains unchanged.
- [ ] Run `npm run test:web -- gateway-origin.spec.ts pair-revocation.spec.ts`.
- [ ] Record deployed bundling/runtime as unverified. Do not reset data or deploy.
- [ ] Obtain task review; commit `chore: unify Edge checks and verified worktree serving`.

### Task 6: Measure remaining candidates and remove obsolete documentation

**Modify:** `docs/DEVELOPMENT.md`, with necessary link corrections in root README, docs README, and STYLE.
**Records:** ignored `.superpowers/architecture-optimization`; visual evidence belongs in design.
**Interfaces:** No new product interface. Record exact commands, inputs, source revision, and check limits.

- [ ] Record websocket channel joins/leaves and authenticated reads during focus, reconnect, and same-Pair revalidation.
- [ ] Use owned fixtures and redact Auth values. Retain authority cleanup behavior.
- [ ] Measure Important date results at 30, 300, and 3,000 synthetic Events in the 366-day range.
- [ ] Record Event counts, returned bytes, serialization time, and database query plans.
- [ ] Use fixture IDs and a rollback transaction for database measurements. Keep private Events in the cases.
- [ ] Compare any measured candidate with current semantics. Document whether a separate design is justified.
- [ ] Implement neither realtime consolidation nor a new Important date read under this plan.
- [ ] Remove repeated historical review narrative; retain current results, source references, failure limits, and open delivery work.
- [ ] Scan code callers and recorded asset references before deleting any additional file.
- [ ] Keep active features, SQL migration history, gallery sources, and fixture ownership records.
- [ ] Check internal documentation links and gallery asset references.
- [ ] Verify exactly three Markdown files and no folders inside docs.
- [ ] Obtain task review; commit `docs: record optimization evidence and remove obsolete narrative`.

### Task 7: Verify the combined branch

**Modify:** Development acceptance results and plan checkboxes.
**Interfaces:** No product change. Fix review findings through the task that owns them.

- [ ] Run `npm run verify:mobile`, `npm run test:domain`, `npm run test:architecture`, and `npm run typecheck`.
- [ ] Run `npm run typecheck:functions` and both function test commands with frozen locks.
- [ ] Run `npm run verify:web` against verified Test Edge. Expect the complete suite to pass.
- [ ] Run `npm run test:db` against the verified populated backend. Preserve records and rolled-back fixtures.
- [ ] Run `npm exec --workspace @deseo/mobile -- expo export --platform android --platform ios --output-dir dist`.
- [ ] Check changed screens at 320px, 768px, and 1024px, with enlarged text and keyboard controls.
- [ ] Check compiled browser output for server values, native imports, and obsolete paths without printing secret matches.
- [ ] Verify gallery links and image references after documentation cleanup.
- [ ] Obtain an independent whole-branch review against `b4fffcd`.
- [ ] Fix actionable findings, then rerun only affected checks unless the final source requires a fresh complete run.
- [ ] Record actual acceptance and any unavailable check. Do not claim physical-device or deployment acceptance.
- [ ] Confirm the original checkout remains unchanged and the worktree has no unintended files.
- [ ] Commit final evidence. Leave the branch ready for review; do not merge or publish.

### Plan self-review

The tasks cover the approved shared contract, calculations, asset, feature seams, Edge checks, and verified cleanup.
Task 5 adds required worktree-aware backend identity checks discovered during planning.
Existing persistent-service ownership stays strict; Edge source ownership requires registered worktree identity.
The five review-focus cases have owning tasks and importance ratings.
Tasks use the same Today field names and existing date/message interfaces.
The measured candidates require separate designs before implementation.
Execution will use subagents for independent work and coordinator-owned integration.
