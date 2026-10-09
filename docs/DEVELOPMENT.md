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

Run Docker Desktop. Start the single `deseo` backend from the primary checkout.
Its API uses 55721, database 55722, mail 55724, and inspector 55728.

```powershell
npm run start:backend
```

Set CLI telemetry controls before direct commands:

```powershell
$env:DO_NOT_TRACK = '1'
$env:SUPABASE_TELEMETRY_DISABLED = 'true'
```

Start and Status save `.superpowers/backend/status.local.json` under the source checkout. Keep this ignored file private.

Refresh the saved status with `npm run status:backend`.

The helper resolves the primary checkout from registered Git worktrees.
Persistent services must belong to that checkout, with matching project, configuration, and port checks.
Only the primary checkout can run Start or Reset.
Registered worktrees can run Test and Status against the primary backend.
Test uses the worktree SQL source. Status reads the primary backend and saves status under the source checkout.
Reset destroys local data. Keep populated development data unless the owner requests a reset.

Create `apps/web/.env.local` from `.env.example` and use the local publishable key.

| Browser variable | Use |
|---|---|
| `VITE_SUPABASE_URL` | API address; local value `http://127.0.0.1:55721` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser key |

Browser invitations use `location.origin`. The portal has no separate site-URL environment setting.
Do not add the unused planned `VITE_SITE_URL` variable.

### One Edge origin

Start one Edge process in a separate terminal. Stop it before changing modes.
Run from the checkout whose Edge source you need.
The helper accepts the primary checkout or a registered worktree with matching Supabase configuration.
It verifies Kong, database, and existing Edge ownership before serving source from that checkout.
These checks cover local serving. Hosted bundling and runtime remain unverified.

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
An origin change requires no listener on the other mode's port.
The guard rejects any such listener. It does not classify processes or foreign Vite projects.
A source reload can retain that listener only when an owned, running Edge already has the target origin.
Its environment must contain exactly one `WEB_APP_ORIGIN` value matching that origin.
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
npm run typecheck:functions
npm run test:memories:functions
npm run test:notifications:functions
```

The single typecheck covers all six Edge entrypoints with Deno 2.9.6 and the shared frozen configuration.
Use `supabase/functions/deno.json` and its lockfile. Sensitive verification has no separate configuration.
Discover CLI options through the installed help before changing commands.

After you change a migration, regenerate the shared database types from a running local stack:

```powershell
npm run gen:types
```

The command writes `packages/domain/src/database.types.ts`. Mobile and web create their clients from it.
CI fails when the committed file differs from the schema.

### Continuous integration

`.github/workflows/ci.yml` runs on pushes to `master` and on each pull request.

- The apps job runs `verify:mobile`, domain tests, `test:architecture`, and the web typecheck, lint, and build.
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

Run `npm run verify:mobile`, `npm run test:domain`, `npm run test:architecture`, and `npm run verify:web` on final source.
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

Run `npm run typecheck:functions` and both function test commands with the shared frozen configuration.
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

The records below describe checks from 7 and 8 October 2026.
Use [Setup](#setup) for current commands. Each gallery covers its recorded source.
Later forms, controls, and message actions can differ from gallery images.
Git history retains the full task reviews and controller rulings at `e96ab62dcbc2a3929ce62a95ddc7346a829fc5ad`.

### Dated evidence

| Date and source | Confirmed result | Evidence and limit |
|---|---|---|
| 7 October; product `af1f109be95ba5f7b7ec3e63d3b8344ea12f7bab`; final web `261ae21` | Mobile 203 tests; domain 7; final web 244, two generation skips; both JavaScript exports passed | `.superpowers/frontend-design/evidence/2026-10-07`; original feature checkout and backend |
| 7 October; capture `701f078ed9384918d18287b687de92fb192a0d06` | 39 routes; 119 views; 238 viewport records; 321 page JPEGs and two named-failure JPEGs | [Gallery](../design/frontend-2026-10-07/web/index.html), [index](../design/frontend-2026-10-07/web/README.md), [verification](../design/frontend-2026-10-07/web/verification.json), [coverage](../design/frontend-2026-10-07/web/coverage.json) |
| 8 October; merge base `3428eae8cd6fcb7e6245ac4e6b364a15a16cc394`; feature `e96ab62dcbc2a3929ce62a95ddc7346a829fc5ad` | Web 272, two generation skips; mobile 205; domain 7; database 517 assertions; both JavaScript exports passed | `.superpowers/merge-frontend-2026-10-08`; existing migrations applied with stored content preserved |
| 8 October; UI/UX base `880bcb7173ff7221526214ff6e82a8287806840d` | Web 272, two skips; mobile 205; domain 7; both exports; 238 matched before/after pairs | [Comparison](../design/ui-ux-pro-max-2026-10-08/index.html), [verification](../design/ui-ux-pro-max-2026-10-08/verification.json); after diff SHA256 `fb872902a2f3a4fe19d0464206138408c7bb03801e541aa8160d8df3f2b86dad` |
| 8 October; Design Taste `a3caba651d8eaf09536518522407dc70d5199aee`; merge base `083ea55255251cdf08f701ba1b5205a877d4f9a8` | Final web 272, two skips; mobile 205; domain 7; both exports; 32 images and three comparisons | [Comparison](../design/design-taste-2026-10-08/index.html), [verification](../design/design-taste-2026-10-08/verification.json); 62 compiled assets without server values or native imports |
| 8 October; combined master base `0531c27fa7beef81cff80131afcd2f2904f60050` and Design Taste `a3caba6` | Web 272, two skips; mobile 205; domain 7; focused browser 18; repeated realtime 12; repeated photo publication 6; both exports | `.superpowers/design-taste/combined-*`; source fingerprint `cb683adbdb5d6c053bdc86688e3beb177fa999bf391da234ae8e0286906010ac` |

The source fingerprint covers 378 files. The Design Taste verification record retains its per-file hashes.
Historical checks used Windows, Europe/Warsaw, Node 24.18.0, npm 11.16.0, and the root lockfile.
Browser checks used real local Auth, PostgreSQL, private Storage, and controlled transport failures.
The historical source detector found no required design issue. It provides no browser or device acceptance.

### Gallery, fixtures, and privacy

Keep [the historical gallery](../design/web-portal/index.html) and its [coverage](../design/web-portal/coverage.json).
Galleries reuse identical hash-named JPEGs in `design/shared`.
Keep capture manifests, source hashes, real UTC timestamps, and fixture labels with their galleries.

| Record | Preserved evidence |
|---|---|
| Viewports | Desktop 1440 × 1000; phone browser 390 × 844 |
| Capture interval | `2026-10-07T14:34:54.196Z` to `2026-10-07T14:43:32.613Z` |
| Display clock | 5 October 2026, 10:00 Europe/Warsaw; Auth and backend used real time |
| Historical consolidation | All 327 historical hashes matched; shared files retained exact bytes |
| Fixture ownership | Historical final cleanup recorded 60 journals with `cleaned=true`; owned accounts removed; named pair retained |
| Privacy | Masked emails, invitation tokens, sign-in codes, and verification codes; capture URLs use `MASKED` |
| Private evidence | Sessions, keys, traces, failed logs, and ownership journals remain in ignored scratch |

The named-media preflight record remains at `.superpowers/frontend-design/capture/named-media-preflight.json`.
Normal photo views use owned disposable pairs with decoded-image checks.
Other views use named Anna/Marek content, disposable fixtures, or controlled request failures.
Remove fixtures only through their ownership records. Keep unknown rows and user edits.

### Failure records

| Failure or correction | Evidence and limit |
|---|---|
| Named media | Read-only preflight on `af1f109` found Today/feed/detail photo errors despite HTTP 200. Cause and repair remain unverified. |
| Named failure captures | Keep [desktop](../design/frontend-2026-10-07/web/named-media-failure-1440.jpg) and [phone](../design/frontend-2026-10-07/web/named-media-failure-390.jpg) images. Design Taste retains the demo error and Retry. |
| Initial capture | 10 passed, three failed, one skipped. Decode checks incorrectly included caption-only edit views; corrected capture passed. |
| Initial full feature web | 242 passed, two failed. Unchanged replays passed; tests then awaited verified session recovery. Fresh full run passed 244. |
| Journal collision | Secondary journal write could bypass cleanup. Importance-95 collision/recovery checks failed before correction, then passed 16 with two generation skips. |
| Expiry fixture identity | Fixed database naming could select the wrong stack. Endpoint/project/workdir checks now select the immutable database container ID. |
| Identity correction checks | Four regression cases failed before correction; 20 checks then passed, including both real expired-code cases. Types and lint passed. |
| UI/UX checks | Native timeout, fixture directory, results directory, and concurrent capture errors preceded successful full reruns. Raw `.superpowers/ui-ux-*` logs remain. |
| Design Taste full run | 271 passed before fixture setup failed during an Edge restart. Both unchanged Calendar replays and fresh full web verification passed. |
| Combined checks | Initial realtime timeout and photo-publication timeout remain in ignored logs. Subscription confirmation and bounded test budgets preceded repeated passes. |

Historical reviewers cleared the recorded branch after scoped corrections.
Corrections cover narrow date/file text, native message spacing, account-zone note timestamps, journal cleanup, and expiry target identity.
The implementers kept authority cleanup, immutable command inputs, and protected unknown outcomes.
A focused rerun proves its covered cases. Keep failed logs beside later full results.

### Native frontend evidence

Historical native source checks and Android/iOS JavaScript exports passed as listed above.
Exports remain ignored under `apps/mobile/dist`.
Native SDKs, simulators, and a native render harness were unavailable during the original frontend review.
Physical Android/iOS rendering, keyboard behavior, large fonts, safe areas, VoiceOver, and TalkBack remain unverified.
Camera/photo permissions, encrypted storage, push, native binaries, and stores need device checks.
Native export color warnings remain an environmental limit in the retained raw log.
No listed browser check or JavaScript export proves physical-device acceptance.

## Frontend merge record

The owner authorized the 8 October frontend merge into master.
The merged source retains current backend contracts, access guards, native theme hooks, and newer form/date/message controls.
It adds reviewed styles, Today reading order, task targets, photo Retry controls, message grouping, and note timestamps.
The combined design merge keeps both review galleries and their recorded-source limits.
The table above records merge checks and hashes. The galleries do not capture the final combined interface.
Named-photo repair remains excluded. Remote push, hosted deployment, and store publication remain unverified.

## Architecture optimization evidence: 9 October 2026

The branch implements the approved contract, calculation, asset, feature-seam, and local Edge changes.
The coordinator retains reports in ignored `.superpowers/sdd/DEVELOPMENT` and raw logs in `.superpowers/architecture-optimization`.

### Source and checked behavior

| Change | Revision | Confirmed behavior |
|---|---|---|
| Browser icon | `0223efa` | 288 × 288 PNG; 869,970 bytes reduced to 67,385; compiled browser excludes the source PNG |
| Shared Today | `ef31114` | Both clients parse the shared contract and existing `get_today`; browser keeps the separate latest Memory read |
| Calendar and Messages | `51efb2d` | One Important date scan; cached Calendar groups; one cached message Map and ordered rows |
| Feature interfaces | `8455431` | Static/type imports, re-exports, and literal dynamic imports obey feature and platform rules |
| Edge and worktree guards | `a549c57` | Six entrypoints use one frozen check; backend owner and registered Edge source remain distinct |

| Command or scope | Confirmed result | Limit |
|---|---|---|
| `npm run verify:mobile`, `npm run test:domain`, `npm run typecheck` | Native 211 tests; domain 19; workspace types passed | Physical devices remain unverified |
| `npm run test:architecture` | 42 passed | Installed ESLint engine checks |
| `node --test supabase/dev/workspace.test.mjs` | 23 passed | Real Git/PowerShell; controlled Docker/CLI inputs |
| `npm run typecheck:functions` | All six entrypoints passed | Shared frozen Deno 2.9.6 configuration |
| Both function test commands | 22 memory/origin/key tests and 15 notification tests passed | Direct function checks |
| `npm run test:web -- today.spec.ts session-isolation.spec.ts` and fixed replays | 18 initial passes; both corrected delayed-summary cases passed | Fresh full browser acceptance pending |
| `npm run test:web -- calendar.spec.ts messages.spec.ts` and fixed replay | 41 initial passes; corrected adjacent-month case passed | Fresh full browser acceptance pending |
| `npm run test:web -- gateway-origin.spec.ts pair-revocation.spec.ts` | Eight passed across both browser projects | Local gateway and authority revocation |
| Android/iOS JavaScript export command from Setup | Both passed | Native binaries and device behavior remain unverified |
| Worktree Edge serving | Source mount and label selected the worktree; database container ID unchanged | Exact Test origin retained; existing 5174 listener preserved |

The coordinator retained original failure logs and later replay results.
The Today gate first waited on a route with no summary request. Its correction navigates to Today before sign-out.
The narrow Calendar case now checks stable Event links, visible day counts, and selected-agenda rows.
Guard review removed the Vite classifier after it accepted an unsafe served-root assumption.
The corrected guard rejects other-mode listeners during origin changes and verifies existing origin identity for source reloads.
Final SQL verification passed: 14 files and 517 assertions, using worktree source without a database reset.
Final combined browser and release acceptance remain pending.
Hosted bundling/runtime, physical-device checks, push delivery, and store publication remain unverified.

### Local calculation measurements

Command: `node .superpowers/sdd/DEVELOPMENT/task-2-measure.cjs`.
Runtime: Node 24.18.0 and npm 11.16.0; seven measured rounds after three warm-up calls.
Selection used 1,000 fixed all-day rows and 500 calls per round.
Grid calculations used 100 Events, 35 cells, and three calls per round.
Both strategies retained identical date groups and Event ID order.

| Operation | Before, median ms/call | After, median ms/call |
|---|---:|---:|
| Important date selection | 0.2141294 | 0.0971312 |
| Grid calculation | 72.5477 | 2.3841333 |

These microbenchmarks measure calculation operations. They do not measure application rendering or browser interaction latency.
The Task 2 report retains repeat timings and fixture details.

### Important date workload

Source: existing database reads on `a549c571ea6c83f82c8d7bcfe6d3b708c7a717b2`; this branch changes no SQL read.
Input and output: `.superpowers/architecture-optimization/important-dates-serialization.sql` and `important-dates-serialization.log`.
The coordinator executed this command after backend identity checks:

```powershell
Get-Content -Raw .superpowers/architecture-optimization/important-dates-serialization.sql | docker exec -i supabase_db_deseo psql -X -v ON_ERROR_STOP=1 -U postgres
```

The synthetic range covers 9 October 2026 through 9 October 2027, with an exclusive end of 10 October.
The range contains 366 days. Fixtures include shared Events, partner-private Events, and February 29 yearly dates.
One-third of stored Events belong to the partner and remain private.
Each cohort used two warm-up calls, then seven measured calls under the authenticated fixture account.
The log records three savepoint rollbacks and the final transaction rollback.
The coordinator checked the reserved fixture-user prefix before and after; both counts were zero.

| Stored Events | Visible year Events | Important dates | Year array bytes | Important array bytes |
|---:|---:|---:|---:|---:|
| 30 | 20 | 2 | 11,922 | 1,218 |
| 300 | 200 | 20 | 119,408 | 12,194 |
| 3,000 | 2,000 | 200 | 1,196,062 | 122,128 |

| Stored Events | Year RPC median ms | Today RPC median ms | Year text conversion median ms | Important text conversion median ms |
|---:|---:|---:|---:|---:|
| 30 | 2.490 | 5.957 | 0.047 | 0.006 |
| 300 | 4.747 | 8.252 | 0.329 | 0.033 |
| 3,000 | 33.630 | 43.282 | 3.603 | 0.339 |

The tables use one measurement run. Timestamp metadata can change byte totals between runs.
The earlier `important-dates.sql` and `important-dates.log` remain in ignored evidence.
Bytes use `octet_length(jsonb::text)` for result arrays; they exclude the Result envelope and HTTP transport.
Text conversion medians measure that operation on completed JSONB arrays, including byte counting.
RPC medians include row selection, yearly expansion, and JSON construction; they do not measure HTTP transfer.
The Important array comes from existing `get_today`; this measurement adds no separate Important date RPC.

The nonrepeating Event plan uses `events_pair_date` with current Pair access and author/private filters.
At 3,000 stored Events, that ID-query plan took 2.328ms; the full year RPC plan took 31.882ms.
Text conversion was measured separately. The plan gap may include result construction and yearly expansion.
A separate narrow Important date design is justified by the measured bytes and full-read cost.
That design must preserve the complete 366-day range, overlap rules, leap-day expansion, and private Event access.
This plan implements no new Important date read.

### Realtime lifecycle workload

Source: `a549c571ea6c83f82c8d7bcfe6d3b708c7a717b2`; application source `8455431`.
Records: `.superpowers/sdd/DEVELOPMENT/task-6-realtime-report.md` and `.superpowers/architecture-optimization/realtime-measure.json`.
One importance-90 Playwright experiment passed in 13.6 seconds with fixture cleanup and zero page errors.
The harness used Chromium, one worker, a 1440 × 1000 viewport, and one owned disposable active Pair.
It used the existing production build, Test origin 4174, and local backend 55721.

```powershell
npx playwright test --config .superpowers/architecture-optimization/realtime-measure.config.ts
```

Each phase settled after successful joins, completed reads, network idle, and two animation frames.
The harness confirmed the same authenticated account and active Pair after each phase.

| Phase | Joins | Leaves | Socket opens / closes | Authenticated reads |
|---|---:|---:|---:|---:|
| Cold Today | 5 | 0 | 1 / 0 | 11 |
| Each of three same-Pair focus events | 4 | 8 | 0 / 0 | 15 |
| Ordinary offline → online | 4 | 8 | 0 / 0 | 15 |
| Offline, controlled socket disconnect, then online | 5 | 8 | 1 / 1 | 15 |

Cold Today joined membership, Messages, Memories, Tasks, and Calendar once each.
Each focus event left each feature channel twice and joined it once; membership remained subscribed.
The controlled disconnect added a fresh membership join.
Cold reads included session 1, Pair 1, unread count 2, Today 3, latest Memory 3, and media 1.
Each later phase read session 1, Pair 1, unread count 2, Today 5, latest Memory 5, and media 1.
All counted reads returned successful responses. All observed joins returned `ok`.

The routed WebSocket proxy forwarded frames without changing their contents.
It retained aggregate counts and no Auth value, frame payload, private content, signed URL, or fixture ID.
Counts exclude Auth codes, fixture requests, signed image downloads, and preflight requests.
Ordinary Chromium offline mode left the WebSocket open; that case checks online revalidation without a transport reconnect.
The controlled case closed both proxy endpoints with code 1001 while offline, then observed a fresh connection.
Proxy and response timing can change invalidation overlap. These counts do not set a fixed device read budget.
The experiment checks wire joins and completed reads; it does not prove each internal callback or authority epoch.
It covers one Pair and browser size, three focus events, and one run of each network case.
Native lifecycle, physical-device, and hosted behavior remain unverified.

The harness removed its Pair and both accounts and confirmed their absence.
Playwright stopped its preview. The existing 5174 listener remained active.
Initial harness failures and cleanup records remain beside the final report.
Repeated feature setup and Today reads justify a separate lifecycle design.
That design must retain authority checks, scope-abort channel closure, stale-callback rejection, and private-data cleanup.
This experiment implements no realtime consolidation.

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
